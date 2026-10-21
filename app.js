/* Unified Inbox front end.
 *
 * Views: Today (grouped list), Calendar, Tasks, Settings, plus a full-screen
 * focus view that works through items one at a time. Every interaction goes
 * through the click handler near the bottom via data-action attributes.
 *
 * Design rules live in DESIGN.md; [n] in comments refers to its decision table.
 */

// ------------------------------------------------------------------ helpers
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The server sends naive local times ("2026-10-23T14:00:00"); JS parses those as local.
const toDate = (iso) => new Date(iso);
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayDiff = (iso) => Math.round((startOfDay(toDate(iso)) - startOfDay(new Date())) / 86400000);
const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

function fmtTime(iso) {
  return toDate(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase();
}
function fmtDay(iso) {
  const n = dayDiff(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const d = toDate(iso);
  if (n > 1 && n < 7) return d.toLocaleDateString('en-AU', { weekday: 'long' });
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
const fmtRange = (s, e) => `${fmtDay(s)}, ${fmtTime(s)} – ${fmtTime(e)}`;
function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function ago(iso) {
  const mins = Math.round((Date.now() - toDate(iso)) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (dayDiff(iso) === 0) return `${Math.floor(mins / 60)}h`;
  if (dayDiff(iso) === -1) return 'Yesterday';
  return toDate(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const ORG = window.ORG_NAME || 'Acme';   // the user's own company, for "outside X" warnings
const api = {
  async req(method, path, body) {
    // Hosted demo: demo-api.js answers every request in the browser, no server needed.
    if (window.DEMO_API) return window.DEMO_API.handle(method, path, body);
    const r = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${method} ${path} failed: ${r.status}`);
    return r.json();
  },
  get: (p) => api.req('GET', p),
  post: (p, b) => api.req('POST', p, b || {}),
  del: (p) => api.req('DELETE', p),
};

// ------------------------------------------------------------------ icons
const ICON = {
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  task: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  people: '<svg class="people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5zM16.5 13.6c3 .2 5.5 2.4 5.5 5.9V20h-4.5c0-2.6-.4-4.6-1-5.9z"/></svg>',
};
// Small white glyphs for the channel badge on each avatar [18]
const CHANNEL_GLYPH = {
  imessage: '<path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6L4.5 21l4.2-2.2c1 .3 2.1.4 3.3.4 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>',
  whatsapp: '<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/>',
  mail: '<path d="M2 6.6V18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6.6l-10 6.5zM2.6 5L12 11.1 21.4 5z"/>',
};
const AVATAR_COLOURS = ['#5E5CE6', '#A550A7', '#C2185B', '#0071E3', '#1E8E3E', '#B25000', '#00796B', '#6D4C41'];

function avatarHTML(m, ch, large = false) {
  const clean = m.sender.replace(/\(.*?\)/g, '').trim();
  const letters = clean.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  let hash = 0;
  for (const c of clean) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const bg = m.group_size ? '#636366' : letters ? AVATAR_COLOURS[hash % AVATAR_COLOURS.length] : '#8E8E93';
  const face = m.group_size ? ICON.people : esc(letters || '?');
  const glyph = CHANNEL_GLYPH[ch.id.startsWith('gmail') ? 'mail' : ch.id];
  return `<span class="avatar ${large ? 'lg' : ''}" style="background:${bg}" aria-hidden="true">${face}
    <span class="badge" style="background:${ch.colour}"><svg viewBox="0 0 24 24">${glyph}</svg></span></span>`;
}

// ------------------------------------------------------------------ preferences (kept on the phone)
const prefs = Object.assign(
  { ai: true, undoSeconds: 10, doneTaps: 0, swiped: false, tipDismissed: false },
  JSON.parse(localStorage.getItem('unified-inbox-prefs') || '{}'),
);
const savePrefs = () => localStorage.setItem('unified-inbox-prefs', JSON.stringify(prefs));

// ------------------------------------------------------------------ state
const LANES = [
  ['needs_you', 'Needs you'],
  ['updates', 'Updates'],
  ['new_senders', 'New senders'],
  ['reading', 'Reading'],
];
const state = {
  tab: 'today',
  filter: 'all',            // all | work | personal [2]
  calFilter: 'all',         // all | work | family
  loaded: false,
  readingOpen: false,       // Reading lane starts collapsed [1]
  feed: [], agenda: [], tasks: [], meta: { channels: [], calendars: [], planned: [] },
  ui: {},                   // per-message: { cal, eventAdded, eventSlot, taskAdded }
  session: null,            // focus view: { ids, i, total, handled }
};
const ui = (id) => (state.ui[id] ||= {});
const calMeta = (id) => state.meta.calendars.find((c) => c.id === id) || { label: id, colour: '#8E8E93' };
const findItem = (id) => state.feed.find((i) => i.message.id === id);
/** Show an AI summary only where it saves reading: email, or long messages. Short texts speak for themselves [10]. */
const useSummary = (item) => prefs.ai && (item.channel.id.startsWith('gmail') || item.message.body.length > 140);

function matches(item) {
  return state.filter === 'all' || item.channel.account === state.filter;
}
/** Visible items in display order: by lane, then oldest first so the most recent sits at the bottom (chat order). */
function visibleFeed() {
  const order = Object.fromEntries(LANES.map(([k], i) => [k, i]));
  return state.feed.filter(matches)
    .sort((a, b) => (order[a.suggestion.lane] - order[b.suggestion.lane])
      || (toDate(a.message.received_at) - toDate(b.message.received_at)));
}
const needsYouCount = () => state.feed.filter((i) => i.suggestion.lane === 'needs_you').length;

async function load() {
  const [meta, feed, agenda, tasks] = await Promise.all([
    api.get('/api/meta'), api.get('/api/feed'), api.get('/api/agenda'), api.get('/api/tasks'),
  ]);
  Object.assign(state, { meta, feed, agenda, tasks, loaded: true });
  render();
}
const reloadAgenda = async () => { state.agenda = await api.get('/api/agenda'); };
const reloadTasks = async () => { state.tasks = await api.get('/api/tasks'); };

// ------------------------------------------------------------------ toast with undo [15]
let toast = null;
function showToast(text, { commit, undo, ms = 5000, countdown = false } = {}) {
  flushToast();                                   // a new toast commits the previous one
  const el = $('#toast');
  el.innerHTML = `<div class="t-row"><span class="t-text">${esc(text)}</span>${undo ? '<button data-toast-undo>Undo</button>' : ''}</div>
    ${countdown ? '<div class="countdown"></div>' : ''}`;
  el.classList.add('show');
  if (countdown) {
    $('.countdown', el).animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
  }
  const t = { commit, undo };
  t.timer = setTimeout(() => finishToast(t, true), ms);
  toast = t;
}
function finishToast(t, doCommit) {
  if (!t || toast !== t) return;
  clearTimeout(t.timer);
  toast = null;
  $('#toast').classList.remove('show');
  if (doCommit && t.commit) t.commit();
}
const flushToast = () => toast && finishToast(toast, true);
// Never lose a pending send if the app is closed or backgrounded.
document.addEventListener('visibilitychange', () => { if (document.hidden) flushToast(); });
window.addEventListener('pagehide', flushToast);

// ------------------------------------------------------------------ removing and restoring items
/** Re-render whichever surfaces are showing. */
function refresh() {
  render();
  if (state.session) renderFocus();
}

/** Take an item out now (optimistic, under 100ms [20]); returns a function that puts it back. */
function removeItem(id) {
  const idx = state.feed.findIndex((i) => i.message.id === id);
  if (idx < 0) return () => {};
  const [item] = state.feed.splice(idx, 1);
  if (state.session) state.session.handled++;
  refresh();
  return () => {
    if (!findItem(id)) state.feed.splice(Math.min(idx, state.feed.length), 0, item);
    if (state.session) {
      state.session.handled--;
      const at = state.session.ids.indexOf(id);
      if (at >= 0) state.session.i = at;
    }
    refresh();
  };
}

function markDone(id) {
  const restore = removeItem(id);
  prefs.doneTaps++; savePrefs();
  showToast('Cleared', { commit: () => api.post(`/api/messages/${id}/done`).catch(onError), undo: restore });
}

function snooze(id, until, label) {
  const restore = removeItem(id);
  showToast(`Later: ${label}`, {
    commit: () => api.post(`/api/messages/${id}/snooze`, { until }).catch(onError),
    undo: restore,
  });
}

// ------------------------------------------------------------------ replies [9][14][15]
const recipientName = (m) => m.thread || m.sender;
/** Short name for labels: a person's first name ("Dave"), an organisation's full name ("Smile Dental"). */
const shortName = (m) => {
  const words = m.sender.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return words.length === 1 ? words[0] : m.sender.replace(/\(.*?\)/g, '').trim();
};

/** Suggested replies. If the event was moved to the free slot, lead with a counter-proposal. */
function repliesFor(item) {
  const s = item.suggestion, u = ui(item.message.id);
  if (!prefs.ai) return [];
  if (u.eventSlot === 'alt' && item.alternative && s.replies.length) {
    const a = item.alternative.start;
    return [`${fmtTime(s.event.start)} doesn't work for me. Could we do ${fmtTime(a)} instead?`, ...s.replies.slice(0, 2)];
  }
  return s.replies.slice(0, 3);
}

/** Send = one tap for every recipient (owner's decision), then the undo window [15].
 *  Groups and outside addresses get no confirm step; the toast names them instead. */
function requestSend(id, text) {
  text = (text || '').trim();
  if (!text) return;
  const item = findItem(id), m = item.message;
  const who = m.group_size ? `${recipientName(m)} (group of ${m.group_size})`
    : m.external ? `${recipientName(m)} (outside ${ORG})` : recipientName(m);
  const restore = removeItem(id);
  showToast(`Sending to ${who} · ${item.channel.label}`, {
    ms: prefs.undoSeconds * 1000,
    countdown: true,
    commit: () => api.post(`/api/messages/${id}/reply`, { text }).catch(onError),
    undo: restore,
  });
}

// ------------------------------------------------------------------ proposals: events and tasks [11][12][13]
function proposedEvent(item, slot) {
  const ev = item.suggestion.event, u = ui(item.message.id);
  const useAlt = slot === 'alt' && item.alternative;
  return {
    title: ev.title,
    start: useAlt ? item.alternative.start : ev.start,
    end: useAlt ? item.alternative.end : ev.end,
    calendar: u.cal || ev.calendar,
    location: ev.location,
  };
}

/** True when every proposal on the item is handled and there is nothing to reply to. */
function itemComplete(item) {
  const s = item.suggestion, u = ui(item.message.id);
  return !(s.event && !u.eventAdded) && !(s.task && !u.taskAdded) && repliesFor(item).length === 0;
}

async function addEvent(id, slot) {
  const item = findItem(id), u = ui(id);
  const ev = proposedEvent(item, slot);
  const created = await api.post(`/api/messages/${id}/event`, ev);
  u.eventAdded = created; u.eventSlot = slot;
  if (slot === 'alt') delete u.draft;             // let the counter-proposal become the draft
  await reloadAgenda();
  const undoEvent = async () => {
    await api.del(`/api/events/${created.calendar}/${created.id}`);
    delete u.eventAdded; delete u.eventSlot;
    await reloadAgenda();
  };
  const label = `Added to ${calMeta(ev.calendar).label} calendar`;
  if (itemComplete(item)) {
    // One tap finishes the item: one toast, and Undo reverses both [4]
    const restore = removeItem(id);
    showToast(`${label} · Cleared`, {
      commit: () => api.post(`/api/messages/${id}/done`).catch(onError),
      undo: async () => { await undoEvent(); restore(); },
    });
  } else {
    refresh();
    showToast(label, { undo: async () => { await undoEvent(); refresh(); } });
  }
}

async function addTask(id) {
  const item = findItem(id), u = ui(id);
  const created = await api.post(`/api/messages/${id}/task`, item.suggestion.task);
  u.taskAdded = created;
  await reloadTasks();
  const undoTask = async () => { await api.del(`/api/tasks/${created.id}`); delete u.taskAdded; await reloadTasks(); };
  if (itemComplete(item)) {
    const restore = removeItem(id);
    showToast('Added to Tasks · Cleared', {
      commit: () => api.post(`/api/messages/${id}/done`).catch(onError),
      undo: async () => { await undoTask(); restore(); },
    });
  } else {
    refresh();
    showToast('Added to Tasks', { undo: async () => { await undoTask(); refresh(); } });
  }
}

// ------------------------------------------------------------------ focus view [3][4][6]
function startSession(fromId) {
  const ids = visibleFeed().map((i) => i.message.id);
  if (!ids.length) return;
  state.session = { ids, i: Math.max(0, ids.indexOf(fromId)), total: ids.length, handled: 0 };
  renderFocus();
  $('#focus').classList.add('open');
  document.body.classList.add('focus-open');
}
function closeFocus() {
  state.session = null;
  $('#focus').classList.remove('open');
  document.body.classList.remove('focus-open');
  render();
}
/** The item at the session cursor. If it was cleared, move forward. Past the last item: the finish screen. */
function currentItem() {
  const s = state.session;
  while (s.i < s.ids.length && !findItem(s.ids[s.i])) s.i++;
  return s.i < s.ids.length ? findItem(s.ids[s.i]) : null;
}
/** Items from this session still on Today (skipped = left for later). */
const sessionLeft = () => state.session.ids.filter((id) => findItem(id)).length;
/** Can we move that way? Forward from the last item goes to the finish screen; back needs an earlier item. */
const canGo = (dir) => (dir === 1 ? state.session.i < state.session.ids.length : neighbour(-1) >= 0);
/** Index of the next (dir 1) or previous (dir -1) item still to handle, or -1. */
function neighbour(dir) {
  const s = state.session;
  for (let j = s.i + dir; j >= 0 && j < s.ids.length; j += dir) if (findItem(s.ids[j])) return j;
  return -1;
}
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Move between items: dir 1 = next, -1 = previous. Slides in from the side it came from. */
function navigate(dir) {
  // Moving on never clears anything: a skipped item stays on Today for later.
  let j = neighbour(dir);
  if (j < 0 && dir === 1 && canGo(1)) j = state.session.ids.length;   // past the last item: finish screen
  const body = $('#focus .focus-body');
  if (j < 0) {                                    // nothing further that way: small bounce
    if (body && !reduceMotion()) body.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 24}px)` }, { transform: 'translateX(0)' }], { duration: 220 });
    return;
  }
  state.session.i = j;
  renderFocus();
  const next = $('#focus .focus-body');
  if (next && !reduceMotion()) {
    next.animate([{ transform: `translateX(${dir * 40}%)`, opacity: 0.3 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

function renderFocus() {
  const s = state.session;
  const item = currentItem();
  const done = s.ids.filter((id) => !findItem(id)).length;
  const pct = Math.round((done / s.total) * 100);
  const label = item ? `${s.i + 1} of ${s.total}` : (sessionLeft() ? 'Done for now' : 'Finished');
  const hasPrev = canGo(-1), hasNext = canGo(1);
  const top = `<div class="focus-top">
      <button class="close" data-action="close-focus">Close</button>
      <div class="progress-label">${label}</div>
      <div class="nav">${item || hasPrev ? `
        <button data-action="nav-prev" aria-label="Previous item" ${hasPrev ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button data-action="nav-next" aria-label="Next item" ${hasNext ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>` : ''}</div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    </div>`;
  const focus = $('#focus');
  const prevId = focus.dataset.itemId;
  const scrollTop = $('.focus-scroll', focus)?.scrollTop || 0;
  focus.innerHTML = top + (item ? focusItemHTML(item) : allClearHTML());
  focus.dataset.itemId = item ? item.message.id : '';
  // Same item re-rendered (e.g. calendar switched): keep the scroll position.
  if (prevId === focus.dataset.itemId) $('.focus-scroll', focus).scrollTop = scrollTop;
}

function focusItemHTML(item) {
  const m = item.message, s = item.suggestion, ch = item.channel;
  const firstName = shortName(m);
  const isEmail = ch.id.startsWith('gmail');
  const where = [ch.label, m.thread ? `in ${m.thread}` : m.address].filter(Boolean).join(' · ');

  const summary = useSummary(item) ? `<div class="summary">
      <div class="caption"><span class="ai-glyph" aria-hidden="true">✦</span>Summary</div>
      <p class="ai">${esc(s.summary)}</p></div>` : '';
  const warning = s.warning ? `<div class="warning" role="alert"><span aria-hidden="true">⚠︎</span><span>${esc(s.warning)}</span></div>` : '';
  const original = `<div class="original"><div class="caption">${esc(firstName)} wrote</div>
      ${isEmail
        ? `<div class="mail-body">${m.subject ? `<div class="subject">${esc(m.subject)}</div>` : ''}${esc(m.body)}</div>`
        : `<div class="bubble-in">${esc(m.body)}</div>`}</div>`;

  const proposals = prefs.ai ? (eventCardHTML(item) + taskCardHTML(item)) : '';
  const respond = s.lane === 'new_senders' ? screenerHTML(item) : replyHTML(item);
  const suggested = proposals ? `<div class="block-title"><span class="caption">Suggested</span></div>${proposals}` : '';
  // The reply comes first, straight under the message; calendar and task proposals follow.
  const actions = respond + suggested;

  return `<div class="focus-scroll"><div class="focus-body">
      <div class="who">${avatarHTML(m, ch, true)}
        <div><div class="name">${esc(m.sender)}</div>
          <div class="footnote muted">${esc(where)} · ${ago(m.received_at)}</div></div></div>
      ${warning}${summary}${original}
      ${actions}
    </div></div>
    <div class="focus-actions">
      <button class="btn filled" data-action="done" data-id="${m.id}" aria-label="Clear: remove from Today, no action">Clear</button>
    </div>`;
}

function eventCardHTML(item) {
  const id = item.message.id, ev = item.suggestion.event, u = ui(id);
  if (!ev) return '';
  if (u.eventAdded) {
    const a = u.eventAdded;
    return `<div class="card proposal"><span class="ic">${ICON.cal}</span><div class="grow">
      <div class="title">${esc(a.title)}</div><div class="subhead muted">${fmtRange(a.start, a.end)}</div>
      <div class="added">✓ Added to ${esc(calMeta(a.calendar).label)} calendar</div></div></div>`;
  }
  const cal = u.cal || ev.calendar;
  const seg = state.meta.calendars.map((c) =>
    `<button aria-pressed="${cal === c.id}" data-action="set-cal" data-id="${id}" data-cal="${c.id}">${esc(c.label)}</button>`).join('');
  let actions;
  if (item.clashes.length) {
    // Low confidence: two choices, no single Add button [12]
    const alt = item.alternative;
    actions = `<div class="row"><div class="segmented" role="group" aria-label="Calendar">${seg}</div></div>
      ${alt ? `<button class="btn tinted choice" data-action="add-event" data-id="${id}" data-slot="alt">
        <span>Add at ${fmtTime(alt.start)}</span><small>Free</small></button>` : ''}
      <button class="btn plain choice" data-action="add-event" data-id="${id}" data-slot="orig">
        <span>Add at ${fmtTime(ev.start)}</span><small style="color:var(--red)">Clashes with ${esc(item.clashes.join(', '))}</small></button>`;
  } else {
    actions = `<div class="row"><div class="segmented" role="group" aria-label="Calendar">${seg}</div>
      <button class="btn tinted" data-action="add-event" data-id="${id}" data-slot="orig">Add</button></div>`;
  }
  return `<div class="card proposal"><span class="ic">${ICON.cal}</span><div class="grow">
      <div class="title">${esc(ev.title)}</div>
      <div class="subhead muted">${fmtRange(ev.start, ev.end)}${ev.location ? ` · ${esc(ev.location)}` : ''}</div>
      ${ev.why ? `<div class="why">Why: ${esc(ev.why)}</div>` : ''}
      <div class="actions">${actions}</div></div></div>`;
}

function taskCardHTML(item) {
  const id = item.message.id, t = item.suggestion.task, u = ui(id);
  if (!t) return '';
  return `<div class="card proposal"><span class="ic">${ICON.task}</span><div class="grow">
      <div class="title">${esc(t.title)}</div>
      ${t.due ? `<div class="subhead muted">Due ${fmtDay(t.due)}, ${fmtTime(t.due)}</div>` : ''}
      ${t.why ? `<div class="why">Why: ${esc(t.why)}</div>` : ''}
      ${u.taskAdded ? '<div class="added">✓ Added to Tasks</div>'
        : `<div class="actions"><div class="row"><span class="grow"></span>
           <button class="btn tinted" data-action="add-task" data-id="${id}">Add to Tasks</button></div></div>`}
    </div></div>`;
}

function replyHTML(item) {
  const m = item.message, ch = item.channel;
  const canReply = (m.address && !/no-?reply/i.test(m.address)) || m.thread;
  if (!canReply || item.suggestion.lane === 'reading') return '';
  const flags = [];
  if (m.group_size) flags.push(`<span class="flag">group of ${m.group_size}</span>`);
  if (m.external) flags.push(`<span class="flag">outside ${esc(ORG)}</span>`);
  const to = `To <b>${esc(recipientName(m))}</b>${!m.thread && m.address ? ` (${esc(m.address)})` : ''} · ${esc(ch.label)}${flags.length ? ' · ' + flags.join(' · ') : ''}`;
  // What is in the box is exactly what gets sent. It starts as the best suggestion [9];
  // tapping another option puts that in the box instead, so a stray tap or swipe never sends.
  const options = repliesFor(item);
  const u = ui(m.id);
  const draft = u.draft ?? options[0] ?? '';
  const others = options.filter((o) => o !== draft);
  const chips = others.map((r) =>
    `<button class="bubble-out alt" data-action="use-reply" data-id="${m.id}" data-text="${esc(r)}">${esc(r)}</button>`).join('');
  const drafted = options.includes(draft);          // AI text gets the ✦ label [10]
  return `<div class="block-title"><span class="caption">${drafted ? '<span class="ai-glyph" aria-hidden="true">✦</span>Suggested reply' : 'Reply'}</span></div>
    <div class="to-line">${to}</div>
    <div class="compose">
      <textarea id="compose-${m.id}" data-id="${m.id}" rows="${Math.min(5, Math.max(2, Math.ceil(draft.length / 32)))}"
        placeholder="Message ${esc(shortName(m))}" aria-label="Reply to ${esc(recipientName(m))}">${esc(draft)}</textarea>
      <button class="send-btn" data-action="send-custom" data-id="${m.id}" aria-label="Send to ${esc(recipientName(m))}">${ICON.send}</button>
    </div>
    ${chips ? `<div class="caption other-label">Other replies · tap to use</div><div class="replies">${chips}</div>` : ''}`;
}

function screenerHTML(item) {
  const id = item.message.id;
  return `<div class="card"><div class="headline">First message from this sender</div>
      <p class="subhead muted" style="margin:4px 0 12px">Allow sends their future messages to Needs you. Block hides them for good.</p>
      <div style="display:flex;gap:8px">
        <button class="btn danger" style="flex:1" data-action="block" data-id="${id}">Block</button>
        <button class="btn plain" style="flex:1" data-action="allow" data-id="${id}">Allow</button></div></div>`;
}

function allClearHTML() {
  const s = state.session;
  const next = nextEvent();
  const nextLine = next ? `<div class="day-strip" style="text-align:left;margin-top:24px"><span class="bar" style="background:${calMeta(next.calendar).colour}"></span>
      <div class="grow"><div class="footnote muted">Next</div><div class="headline">${esc(next.title)}</div></div>
      <span class="when">${fmtDay(next.start)} ${fmtTime(next.start)}</span></div>` : '';
  const left = sessionLeft();
  return `<div class="focus-scroll"><div class="focus-body clear-screen">
      <div class="empty"><div class="check" aria-hidden="true">✓</div>
      <h2 class="title2">${left ? 'Done for now' : 'All clear'}</h2>
      <p class="muted">${s.handled} cleared${left ? `. ${left} left for later on Today` : ''}.</p></div>
      ${nextLine}
      <button class="btn filled wide" style="margin-top:24px" data-action="close-focus">Back to Today</button>
      ${left ? `<button class="btn tinted wide" style="margin-top:10px" data-action="restart">Go through the ${left} again</button>` : ''}
    </div></div>`;
}

// ------------------------------------------------------------------ sheets
function openSheet(html) {
  $('.sheet').innerHTML = `<div class="grabber" aria-hidden="true"></div>${html}`;
  $('#sheet-wrap').classList.add('open');
}
function closeSheet() { $('#sheet-wrap').classList.remove('open'); }

/** Fixed Later times [16]. */
function laterOptions() {
  const now = new Date(), out = [];
  const at = (days, h) => { const d = startOfDay(now); d.setDate(d.getDate() + days); d.setHours(h); return d; };
  if (now.getHours() < 16) {
    const d = new Date(now); d.setHours(now.getHours() + 3, 0, 0, 0);
    out.push(['Later today', d]);
  }
  if (now.getHours() < 19) out.push(['This evening', at(0, 19)]);
  out.push(['Tomorrow morning', at(1, 8)]);
  const wd = now.getDay();                                 // 0 Sun ... 6 Sat
  if (wd >= 1 && wd <= 4) out.push(['This weekend', at(6 - wd, 9)]);
  out.push(['Next week', at(((8 - wd) % 7) || 7, 8)]);
  return out;
}
function openLaterSheet(id) {
  const rows = laterOptions().map(([label, d]) =>
    `<button data-action="later-pick" data-id="${id}" data-until="${localISO(d)}" data-label="${esc(label)}">
      <span>${esc(label)}</span><span>${fmtDay(localISO(d))} ${fmtTime(localISO(d))}</span></button>`).join('');
  openSheet(`<h3>Later</h3><p class="muted subhead">It comes back to Today at the time you pick.</p>
    <div class="sheet-list">${rows}</div>
    <button class="btn plain wide" data-action="close-sheet">Cancel</button>`);
}

// ------------------------------------------------------------------ Today view [1][2][5][13]
function nextEvent() {
  const now = new Date();
  return state.agenda.find((e) => toDate(e.end) > now);
}

function dayStripHTML() {
  const now = new Date();
  const today = state.agenda.filter((e) => dayDiff(e.start) === 0);
  const booked = today.reduce((sum, e) => sum + (toDate(e.end) - toDate(e.start)) / 60000, 0);
  const next = today.find((e) => toDate(e.end) > now);
  const load = `${today.length} event${today.length === 1 ? '' : 's'} today · ${fmtDuration(booked)} booked`;
  if (!next) return `<div class="day-strip"><div class="grow"><div class="headline">Nothing else today</div><div class="footnote muted">${load}</div></div></div>`;
  const live = toDate(next.start) <= now;
  const mins = Math.round((toDate(next.start) - now) / 60000);
  const when = live ? 'Now' : mins < 60 ? `in ${mins}m` : fmtTime(next.start);
  return `<div class="day-strip"><span class="bar" style="background:${calMeta(next.calendar).colour}"></span>
    <div class="grow"><div class="headline">${live ? 'Now' : 'Next'}: ${esc(next.title)}</div>
    <div class="footnote muted">${load}</div></div><span class="when">${when}</span></div>`;
}

function rowHTML(item) {
  const m = item.message, s = item.suggestion, ch = item.channel;
  const tags = [];
  if (prefs.ai) {
    if (s.event) tags.push(`<span class="tag">${ICON.cal}${fmtDay(s.event.start)} ${fmtTime(s.event.start)}</span>`);
    if (s.task) tags.push(`<span class="tag">${ICON.task}Task</span>`);
    if (item.clashes.length) tags.push('<span class="tag red">Clash</span>');
  }
  if (s.warning) tags.push('<span class="tag red">Warning</span>');
  const sub = [ch.label, m.thread ? `in ${m.thread}` : '', m.subject || ''].filter(Boolean).join(' · ');
  const gist = useSummary(item)
    ? `<span class="ai"><span class="ai-glyph" aria-hidden="true">✦</span><span class="sr">Summary: </span>${esc(s.summary)}</span>`
    : esc(m.body);
  return `<div class="swipe" data-id="${m.id}">
    <div class="swipe-bg" aria-hidden="true"><span class="later">Later</span><span class="done">Clear</span></div>
    <button class="row-inner" data-action="open" data-id="${m.id}">
      ${avatarHTML(m, ch)}
      <span class="row-body">
        <span class="row-top"><span class="name">${esc(m.sender)}</span><time>${ago(m.received_at)}</time></span>
        <span class="row-sub" style="display:block">${esc(sub)}</span>
        <span class="row-gist">${gist}</span>
        ${prefs.ai && repliesFor(item)[0] && s.lane !== 'new_senders' ? `<span class="row-reply"><span aria-hidden="true">↩︎ </span><span class="sr">Suggested reply: </span>${esc(repliesFor(item)[0])}</span>` : ''}
        ${tags.length ? `<span class="row-tags">${tags.join('')}</span>` : ''}
      </span>
    </button></div>`;
}

function todayHTML() {
  const now = new Date();
  const dateLine = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!state.loaded) {
    return `<header class="page-head"><h1 class="large-title" style="margin:0">Today</h1><div class="muted">${dateLine}</div></header>
      <div class="empty"><p class="muted">Loading messages…</p></div>`;
  }
  const vis = visibleFeed();
  const ny = vis.filter((i) => i.suggestion.lane === 'needs_you').length;
  const seg = [['all', 'All'], ['work', 'Work'], ['personal', 'Personal']].map(([f, l]) =>
    `<button aria-pressed="${state.filter === f}" data-action="filter" data-filter="${f}">${l}</button>`).join('');
  const tip = prefs.doneTaps >= 3 && !prefs.swiped && !prefs.tipDismissed
    ? `<div class="tip"><span>Swipe a row left to clear it, right for Later.</span><button data-action="dismiss-tip">Got it</button></div>` : '';

  let sections = '';
  for (const [lane, title] of LANES) {
    const items = vis.filter((i) => i.suggestion.lane === lane);
    if (!items.length) continue;
    const collapsible = lane === 'reading';
    const open = !collapsible || state.readingOpen;
    sections += `<div class="section-head"><h2>${title}<span class="count">${items.length}</span></h2>
      ${collapsible ? `<button class="toggle" data-action="toggle-reading" aria-expanded="${open}">${open ? 'Hide' : 'Show'}</button>` : ''}</div>
      ${open ? `<div class="group">${items.map(rowHTML).join('')}</div>` : ''}`;
  }

  const body = vis.length ? tip + sections : `<div class="empty"><div class="check" aria-hidden="true">✓</div>
      <h2 class="title2">All clear</h2>
      <p class="muted">${state.feed.length ? 'Nothing in this filter.' : 'Nothing needs you right now.'}</p></div>`;
  const start = vis.length
    ? `<div class="start-bar"><button class="btn filled" data-action="start">Start · ${vis.length}</button></div>` : '';

  return `<header class="page-head"><h1 class="large-title" style="margin:0">Today</h1>
      <div class="muted">${dateLine}${ny ? ` · ${ny} need${ny === 1 ? 's' : ''} you` : ''}</div></header>
    ${dayStripHTML()}
    <div class="segmented" role="group" aria-label="Show">${seg}</div>
    ${body}${start}`;
}

// ------------------------------------------------------------------ Calendar, Tasks, Settings
function calendarHTML() {
  const evs = state.agenda.filter((e) => state.calFilter === 'all' || e.calendar === state.calFilter);
  const seg = [['all', 'All'], ...state.meta.calendars.map((c) => [c.id, c.label])].map(([f, l]) =>
    `<button aria-pressed="${state.calFilter === f}" data-action="cal-filter" data-cal="${f}">${esc(l)}</button>`).join('');
  const days = new Map();
  for (const e of evs) {
    const k = startOfDay(toDate(e.start)).getTime();
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(e);
  }
  const now = new Date();
  let html = '';
  for (const list of days.values()) {
    const first = list[0].start;
    const mins = list.reduce((s, e) => s + (toDate(e.end) - toDate(e.start)) / 60000, 0);
    const date = toDate(first).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    html += `<div class="day-head"><h2>${fmtDay(first)} <span class="muted subhead" style="font-weight:400">${date}</span></h2>
      <span class="load">${list.length} event${list.length === 1 ? '' : 's'} · ${fmtDuration(mins)}</span></div>
      <div class="group">${list.map((e) => {
        const cls = toDate(e.end) < now ? 'past' : toDate(e.start) <= now ? 'now' : '';
        const cal = calMeta(e.calendar);
        return `<div class="ev ${cls}"><span class="bar" style="background:${cal.colour}"></span>
          <div class="t">${fmtTime(e.start)}<small>${fmtTime(e.end)}</small></div>
          <div><div class="headline">${esc(e.title)}</div><div class="meta">${esc(cal.label)}${e.location ? ` · ${esc(e.location)}` : ''}</div></div></div>`;
      }).join('')}</div>`;
  }
  return `<header class="page-head"><h1 class="large-title" style="margin:0">Calendar</h1><div class="muted">Work and Family · next 14 days</div></header>
    <div class="segmented" role="group" aria-label="Calendar">${seg}</div>
    ${html || '<div class="empty"><p class="muted">No events in the next 14 days.</p></div>'}`;
}

function tasksHTML() {
  const now = new Date();
  const groups = { Today: [], 'This evening': [], Upcoming: [], Done: [] };   // Things 3 split [16]
  for (const t of state.tasks) {
    if (t.done) groups.Done.push(t);
    else if (t.due && dayDiff(t.due) <= 0) groups[dayDiff(t.due) === 0 && toDate(t.due).getHours() >= 17 ? 'This evening' : 'Today'].push(t);
    else groups.Upcoming.push(t);
  }
  const row = (t) => {
    const ch = state.meta.channels.find((c) => c.id === t.source_channel);
    const overdue = !t.done && t.due && toDate(t.due) < now;
    return `<div class="task ${t.done ? 'done' : ''}">
      <button class="check-btn" data-action="toggle-task" data-tid="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}"><i>${t.done ? '✓' : ''}</i></button>
      <div><div class="t-title">${esc(t.title)}</div>
        <div class="due ${overdue ? 'overdue' : ''}">${t.due ? `${overdue ? 'Overdue · ' : ''}${fmtDay(t.due)}, ${fmtTime(t.due)}` : 'No date'}${ch ? ` · from ${esc(ch.label)}` : ''}</div></div></div>`;
  };
  const open = state.tasks.filter((t) => !t.done).length;
  let html = '';
  for (const [name, list] of Object.entries(groups)) {
    if (!list.length) continue;
    html += `<div class="section-head"><h2>${name}<span class="count">${list.length}</span></h2></div><div class="group">${list.map(row).join('')}</div>`;
  }
  return `<header class="page-head"><h1 class="large-title" style="margin:0">Tasks</h1><div class="muted">${open} open</div></header>
    ${html || '<div class="empty"><p class="muted">No tasks yet. Tasks you add from messages appear here.</p></div>'}`;
}

function settingsHTML() {
  const secs = [5, 10, 20, 30].map((n) =>
    `<button aria-pressed="${prefs.undoSeconds === n}" data-action="undo-secs" data-secs="${n}">${n}s</button>`).join('');
  const accounts = [
    ...state.meta.channels.map((c) => [c.colour, c.label]),
    ...state.meta.calendars.map((c) => [c.colour, `${c.label} calendar`]),
  ].map(([colour, label]) => `<div class="setting"><span class="badge" style="position:static;border:0;background:${colour}"></span>
      <div class="grow">${esc(label)}</div><span class="pill">Demo data</span></div>`).join('');
  const plan = state.meta.planned.map((p) => `<div class="setting"><div class="grow">${esc(p.label)}<div class="note">${esc(p.via)}</div></div>
      <span class="pill">Phase ${p.phase}</span></div>`).join('');
  return `<header class="page-head"><h1 class="large-title" style="margin:0">Settings</h1></header>
    <div class="section-head"><h2>Suggestions</h2></div>
    <div class="group">
      <div class="setting"><div class="grow">AI suggestions<div class="note">Summaries, replies, events and tasks. Off shows the original messages only.</div></div>
        <button class="switch" role="switch" aria-checked="${prefs.ai}" aria-label="AI suggestions" data-action="toggle-ai"></button></div>
      <div class="setting"><div class="grow">Undo send<div class="note">How long a reply waits before it goes.</div></div></div>
      <div style="padding:0 16px 12px"><div class="segmented" role="group" aria-label="Undo send delay">${secs}</div></div>
    </div>
    <div class="section-head"><h2>Accounts</h2></div><div class="group">${accounts}</div>
    <div class="section-head"><h2>Build plan</h2></div><div class="group">${plan}</div>
    <p class="foot">${window.DEMO_API ? 'Demo with made-up data. Nothing is sent anywhere.' : "Prototype. Nothing is sent; replies print in the Mac's terminal."}</p>
    <div style="padding:16px 0"><button class="btn tinted wide" data-action="reset">Reset demo data</button></div>`;
}

function render() {
  const views = { today: todayHTML, calendar: calendarHTML, tasks: tasksHTML, settings: settingsHTML };
  $('#view').innerHTML = views[state.tab]();
  document.querySelectorAll('#tabs button').forEach((b) => {
    if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#today-badge').textContent = needsYouCount() || '';
}

function onError(err) {
  console.error(err);
  showToast("Couldn't reach the server. Check the Mac is running and try again.");
}

// ------------------------------------------------------------------ clicks
let suppressClickUntil = 0;   // set after a swipe so the release doesn't count as a tap

document.addEventListener('click', async (e) => {
  if (Date.now() < suppressClickUntil) return;
  if (e.target.closest('[data-toast-undo]')) {
    const t = toast; finishToast(t, false); t && t.undo && t.undo();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    switch (action) {
      case 'tab': state.tab = el.dataset.tab; window.scrollTo(0, 0); render(); break;
      case 'filter': state.filter = el.dataset.filter; render(); break;
      case 'cal-filter': state.calFilter = el.dataset.cal; render(); break;
      case 'toggle-reading': state.readingOpen = !state.readingOpen; render(); break;
      case 'dismiss-tip': prefs.tipDismissed = true; savePrefs(); render(); break;
      case 'open': startSession(id); break;
      case 'start': startSession(null); break;
      case 'restart': startSession(null); break;
      case 'close-focus': closeFocus(); break;
      case 'done': markDone(id); break;
      case 'later-pick': closeSheet(); snooze(id, el.dataset.until, el.dataset.label); break;
      case 'close-sheet': closeSheet(); break;
      case 'set-cal': ui(id).cal = el.dataset.cal; refresh(); break;
      case 'add-event': await addEvent(id, el.dataset.slot); break;
      case 'add-task': await addTask(id); break;
      case 'use-reply': ui(id).draft = el.dataset.text; refresh(); break;
      case 'nav-next': navigate(1); break;
      case 'nav-prev': navigate(-1); break;
      case 'send-custom': requestSend(id, $(`#compose-${id}`).value); break;
      case 'block': {
        const restore = removeItem(id);
        showToast('Blocked', { commit: () => api.post(`/api/messages/${id}/block`).catch(onError), undo: restore });
        break;
      }
      case 'allow': findItem(id).suggestion.lane = 'needs_you'; refresh(); showToast('Allowed. Their messages now go to Needs you.'); break;
      case 'toggle-task': await api.post(`/api/tasks/${el.dataset.tid}/toggle`); await reloadTasks(); render(); break;
      case 'toggle-ai': prefs.ai = !prefs.ai; savePrefs(); render(); break;
      case 'undo-secs': prefs.undoSeconds = +el.dataset.secs; savePrefs(); render(); break;
      case 'reset': await api.post('/api/reset'); state.ui = {}; await load(); showToast('Demo data reset'); break;
    }
  } catch (err) { onError(err); }
});

// Typed drafts survive re-renders (e.g. switching calendar); the box grows with the text.
document.addEventListener('input', (e) => {
  const ta = e.target.closest?.('textarea[id^="compose-"]');
  if (!ta) return;
  ui(ta.dataset.id).draft = ta.value;
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
});

// Enter sends from the compose box; Shift+Enter adds a line.
document.addEventListener('keydown', (e) => {
  const ta = e.target.closest?.('textarea[id^="compose-"]');
  if (ta && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); requestSend(ta.id.slice(8), ta.value); }
});

// ------------------------------------------------------------------ swipe: left = Clear, right = Later [7]
let drag = null;
const EDGE_GUARD = 24;        // px from the left edge left alone for the iOS back gesture

document.addEventListener('pointerdown', (e) => {
  const wrap = e.target.closest('#view .swipe');
  if (!wrap || e.clientX < EDGE_GUARD) return;
  drag = { wrap, row: $('.row-inner', wrap), x: e.clientX, y: e.clientY, dx: 0, active: false };
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // vertical scroll wins
    if (Math.abs(dx) < 10) return;
    drag.active = true;
    drag.row.classList.add('dragging');
  }
  drag.dx = dx;
  drag.row.style.transform = `translateX(${dx}px)`;
  drag.wrap.classList.toggle('to-done', dx < 0);
  drag.wrap.classList.toggle('to-later', dx > 0);
});

function endDrag() {
  if (!drag) return;
  const { wrap, row, dx, active } = drag;
  drag = null;
  if (!active) return;
  suppressClickUntil = Date.now() + 300;
  row.classList.remove('dragging');
  const commit = Math.abs(dx) > Math.min(110, wrap.offsetWidth * 0.35);
  if (!commit) {
    row.style.transform = '';
    setTimeout(() => wrap.classList.remove('to-done', 'to-later'), 200);
    return;
  }
  prefs.swiped = true; savePrefs();
  if (dx < 0) {
    row.style.transform = 'translateX(-105%)';
    setTimeout(() => markDone(wrap.dataset.id), 180);
  } else {
    row.style.transform = '';
    setTimeout(() => wrap.classList.remove('to-later'), 200);
    openLaterSheet(wrap.dataset.id);
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------------ focus view swipe: left = next, right = previous [7]
let pageDrag = null;
document.addEventListener('pointerdown', (e) => {
  const scroller = e.target.closest('#focus .focus-scroll');
  if (!scroller || !state.session || e.target.closest('textarea') || e.clientX < EDGE_GUARD) return;
  pageDrag = { body: $('.focus-body', scroller), x: e.clientX, y: e.clientY, dx: 0, active: false, t: Date.now() };
});
document.addEventListener('pointermove', (e) => {
  if (!pageDrag) return;
  const dx = e.clientX - pageDrag.x, dy = e.clientY - pageDrag.y;
  if (!pageDrag.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { pageDrag = null; return; }   // vertical scroll wins
    if (Math.abs(dx) < 10) return;
    pageDrag.active = true;
  }
  pageDrag.dx = dx;
  const edge = !canGo(dx < 0 ? 1 : -1);           // resist when there is nothing that way
  pageDrag.body.style.transform = `translateX(${edge ? dx * 0.25 : dx}px)`;
});
function endPageDrag() {
  if (!pageDrag) return;
  const { body, dx, active, t } = pageDrag;
  pageDrag = null;
  if (!active) return;
  suppressClickUntil = Date.now() + 300;
  body.style.transform = '';
  const fast = Math.abs(dx) > 40 && Date.now() - t < 250;   // a quick flick counts too
  if (Math.abs(dx) > 80 || fast) navigate(dx < 0 ? 1 : -1);
}
document.addEventListener('pointerup', endPageDrag);
document.addEventListener('pointercancel', endPageDrag);

// ------------------------------------------------------------------ start
// Deep links: /#calendar, /#tasks, /#settings open that tab; /#focus starts a session.
function applyHash() {
  const h = location.hash.slice(1);
  if (['today', 'calendar', 'tasks', 'settings'].includes(h)) { state.tab = h; render(); }
  if (h === 'focus' && state.loaded) startSession(null);
}
window.addEventListener('hashchange', applyHash);
render();
load().then(applyHash).catch(onError);
setInterval(() => {                               // keep "12m" fresh, but never mid-typing or mid-undo
  if (!toast && !state.session && document.activeElement?.tagName !== 'TEXTAREA') render();
}, 60000);
