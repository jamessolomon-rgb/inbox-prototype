/* Unified Inbox front end, round 4: the conversation is the unit (ASSESSMENT.md section 7).
 *
 * Tabs: Today (conversations that need you, sorted by priority), Chats (every conversation,
 * search, new message), Calendar (day view and list), Tasks, Settings. The overlay (#focus)
 * shows one conversation: full history in chat order with the newest at the bottom, suggested
 * events/tasks/invitations under it, and the reply box pinned at the bottom with the best reply
 * pre-filled. From Today it runs as a session (swipe between items, Clear, finish screen); from
 * Chats it is a plain conversation.
 *
 * Every interaction goes through the click handler via data-action attributes.
 * [n] = DESIGN.md decision, [H#]/[F#] = research round 3 rows, [A#] = ASSESSMENT.md section 7 answers.
 */

// ------------------------------------------------------------------ helpers
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The API sends naive local times ("2026-10-23T14:00:00"); JS parses those as local.
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
  if (Math.abs(n) < 7) return d.toLocaleDateString('en-AU', { weekday: 'long' });
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
  if (dayDiff(iso) > -7) return toDate(iso).toLocaleDateString('en-AU', { weekday: 'short' });
  return toDate(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const ORG = window.ORG_NAME || 'Acme';   // the user's own company, for "outside X" warnings
const api = {
  async req(method, path, body) {
    // Demo: demo-api.js answers every request in the browser. Phase 2 swaps in the real server.
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

// ------------------------------------------------------------------ icons and avatars
const ICON = {
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  task: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  compose: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l2 2H4M10 20a2 2 0 0 0 4 0M3 3l18 18"/></svg>',
  clip: '<svg viewBox="0 0 24 24"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg>',
  people: '<svg class="people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5zM16.5 13.6c3 .2 5.5 2.4 5.5 5.9V20h-4.5c0-2.6-.4-4.6-1-5.9z"/></svg>',
};
/** Each integration's symbol as a small app-style icon. Simplified shapes in the apps' own colours. */
const BRAND = {
  imessage: '<rect width="24" height="24" rx="6" fill="#34C759"/><path d="M12 5.4c-4.5 0-8.1 2.9-8.1 6.4 0 2 1.2 3.8 3.1 5l-.9 3 3.4-1.8c.8.2 1.6.3 2.5.3 4.5 0 8.1-2.9 8.1-6.5S16.5 5.4 12 5.4z" fill="#fff"/>',
  whatsapp: '<rect width="24" height="24" rx="6" fill="#25D366"/><path d="M12 4.7a7.2 7.2 0 0 0-6.2 10.9l-1 3.7 3.8-1A7.2 7.2 0 1 0 12 4.7z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M9.6 8.7c.2-.4.4-.4.6-.4h.4c.1 0 .3 0 .4.3l.6 1.4c0 .1 0 .3-.1.4l-.4.5c-.1.1-.1.2 0 .4.4.7 1.2 1.6 2.3 2.1.2.1.3.1.4 0l.5-.6c.1-.2.3-.2.4-.1l1.4.7c.2.1.3.2.3.3 0 .4-.2 1-.6 1.3-.5.4-1.3.5-2.4.1-1.5-.6-2.9-1.9-3.7-3.2-.6-1-.7-2-.3-2.6z" fill="#fff"/>',
  gmail: '<rect x=".5" y=".5" width="23" height="23" rx="5.5" fill="#fff" stroke="rgba(0,0,0,.12)"/><path d="M5 8.2v8.8h2.6v-6.3L12 14l4.4-3.3V17H19V8.2l-1.7-1.3L12 10.8 6.7 6.9z" fill="#EA4335"/><path d="M5 8.2V17h2.6v-6.3z" fill="#4285F4"/><path d="M19 8.2V17h-2.6v-6.3z" fill="#34A853"/><path d="M19 8.2l-1.7-1.3-.9.7v3.1L19 8.9z" fill="#FBBC04"/>',
  slack: '<rect x=".5" y=".5" width="23" height="23" rx="5.5" fill="#fff" stroke="rgba(0,0,0,.12)"/><rect x="8.6" y="4.4" width="2.8" height="9" rx="1.4" fill="#36C5F0"/><rect x="10.6" y="8.6" width="9" height="2.8" rx="1.4" fill="#2EB67D"/><rect x="12.6" y="10.6" width="2.8" height="9" rx="1.4" fill="#ECB22E"/><rect x="4.4" y="12.6" width="9" height="2.8" rx="1.4" fill="#E01E5A"/>',
  calendar: '<rect x=".5" y=".5" width="23" height="23" rx="5.5" fill="#fff" stroke="rgba(0,0,0,.12)"/><rect x="4.5" y="5" width="15" height="14.5" rx="2.2" fill="#fff" stroke="#1A73E8" stroke-width="1.8"/><path d="M4.5 9.2h15" stroke="#1A73E8" stroke-width="1.8"/><text x="12" y="17.4" text-anchor="middle" font-size="7.2" font-weight="700" fill="#1A73E8" font-family="-apple-system, Helvetica, Arial, sans-serif">31</text>',
};
const brandFor = (channelId) => (channelId.startsWith('gmail') ? 'gmail' : channelId);
const brandIcon = (key, label = '') => `<svg class="brand-icon" viewBox="0 0 24 24" role="img" aria-label="${esc(label)}">${BRAND[key] || ''}</svg>`;

const AVATAR_COLOURS = ['#5E5CE6', '#A550A7', '#C2185B', '#0071E3', '#1E8E3E', '#B25000', '#00796B', '#6D4C41'];
const channelMeta = (id) => state.meta.channels.find((c) => c.id === id) || { id, label: id, colour: '#8E8E93', account: 'personal' };

function initials(name) {
  const clean = name.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim();
  return clean.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
}
function colourFor(name) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}
/** Avatar for a conversation: initials (or a group icon) with the channel badge [18]. */
function avatarHTML(conv, size = '') {
  const ch = channelMeta(conv.channel);
  const group = conv.kind === 'group';
  const letters = initials(conv.title);
  const bg = group ? '#636366' : letters ? colourFor(conv.title) : '#8E8E93';

  return `<span class="avatar ${size}" style="background:${bg}" aria-hidden="true">${group ? ICON.people : esc(letters || '?')}
    <span class="badge brand">${brandIcon(brandFor(conv.channel))}</span></span>`;
}

// ------------------------------------------------------------------ preferences (kept on the phone)
const prefs = Object.assign(
  { ai: true, undoSeconds: 10, doneTaps: 0, swiped: false, tipDismissed: false, theme: 'auto', peeked: false,
    mode: 'all', autoMode: false },
  JSON.parse(localStorage.getItem('unified-inbox-prefs') || '{}'),
);
const savePrefs = () => localStorage.setItem('unified-inbox-prefs', JSON.stringify(prefs));
/** Appearance: 'auto' follows the iPhone; 'light' or 'dark' forces it (styles use light-dark()). */
function applyTheme() {
  if (prefs.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = prefs.theme;
}
applyTheme();
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Work / Personal switch [A5]. With the schedule on, evenings and weekends open in Personal. */
function startingMode() {
  if (!prefs.autoMode) return prefs.mode;
  const now = new Date(), h = now.getHours(), weekend = now.getDay() === 0 || now.getDay() === 6;
  return weekend || h >= 19 || h < 7 ? 'personal' : prefs.mode;
}

// ------------------------------------------------------------------ state
const LANES = [
  ['needs_you', 'Needs you'],
  ['updates', 'Updates'],
  ['new_senders', 'New senders'],
  ['reading', 'Reading'],
];
const state = {
  tab: 'today',
  mode: startingMode(),     // all | work | personal
  calView: 'day',           // day | list
  calDay: 0,                // day offset shown in the day view
  loaded: false,
  readingOpen: false,       // Reading lane starts collapsed [1]
  today: [], chats: [], chatQuery: '', contacts: [], agenda: [], tasks: [],
  meta: { channels: [], calendars: [], planned: [], vips: [] },
  convs: {},                // conversation id -> full conversation (history included)
  ui: {},                   // per conversation: { cal, eventAdded, eventSlot, taskAdded, draft }
  session: null,            // Today session: { ids, i, total, handled, stats }
  viewer: null,             // what the overlay shows: { from: 'session' } or { from: 'chats', id }
  enterDir: null,           // slide-in direction for the next render of the overlay
};
const ui = (id) => (state.ui[id] ||= {});
const calMeta = (id) => state.meta.calendars.find((c) => c.id === id) || { label: id, colour: '#8E8E93', account: 'personal' };
const findItem = (id) => state.today.find((i) => i.conversation.id === id);
const inMode = (account) => state.mode === 'all' || account === state.mode;
/** Today items for the current mode, in the order the API decided (lane, then priority) [A1]. */
const visibleToday = () => state.today.filter((i) => inMode(i.channel.account));
const needsYouCount = () => state.today.filter((i) => i.suggestion.lane === 'needs_you').length;

async function loadToday() {
  state.today = await api.get('/api/today');
  for (const it of state.today) state.convs[it.conversation.id] = it.conversation;
}
async function loadChats() {
  state.chats = await api.get(`/api/conversations${state.chatQuery ? `?q=${encodeURIComponent(state.chatQuery)}` : ''}`);
}
async function loadConversation(id) {
  const r = await api.get(`/api/conversations/${id}`);
  state.convs[id] = r.conversation;
  const it = findItem(id);
  if (it) it.conversation = r.conversation;
  return r;
}
const reloadAgenda = async () => { state.agenda = await api.get('/api/agenda'); };
const reloadTasks = async () => { state.tasks = await api.get('/api/tasks'); };

async function load() {
  const [meta, contacts, agenda, tasks] = await Promise.all([
    api.get('/api/meta'), api.get('/api/contacts'), api.get('/api/agenda'), api.get('/api/tasks'),
  ]);
  Object.assign(state, { meta, contacts, agenda, tasks });
  await Promise.all([loadToday(), loadChats()]);
  state.loaded = true;
  render();
}

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
// Never lose a pending send if the app is closed or backgrounded (iOS has no background sync).
document.addEventListener('visibilitychange', () => { if (document.hidden) flushToast(); });
window.addEventListener('pagehide', flushToast);

// ------------------------------------------------------------------ removing and restoring Today items
/** Re-render whichever surfaces are showing. */
function refresh() {
  render();
  if (state.viewer) renderFocus();
  if (state.details && $('#sheet-wrap.open')) openDetails(state.details.id, state.details.kind);
}

/** Take a conversation off Today now (optimistic, under 100ms [20]); returns a function that puts it back.
 *  kind ('reply' | 'clear' | 'invite' | 'other') feeds the finish-screen tally [H6]. */
function removeFromToday(id, kind = 'other') {
  const idx = state.today.findIndex((i) => i.conversation.id === id);
  if (idx < 0) return () => {};
  const [item] = state.today.splice(idx, 1);
  const sess = state.viewer?.from === 'session' ? state.session : null;
  if (sess) { sess.handled++; sess.stats[kind]++; }
  // In a session the current item slides out to the left, then the next comes in from the right [F3]
  const body = $('#focus .focus-body');
  if (sess && body && $('#focus').dataset.itemId === id && !reduceMotion()) {
    body.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-100%)', opacity: 0 }],
      { duration: 140, easing: 'ease-in', fill: 'forwards' }).onfinish = () => { state.enterDir = 1; refresh(); };
    render();
  } else {
    refresh();
  }
  return () => {
    if (!findItem(id)) state.today.splice(Math.min(idx, state.today.length), 0, item);
    if (sess && state.session === sess) {
      sess.handled--; sess.stats[kind]--;
      const at = sess.ids.indexOf(id);
      if (at >= 0) sess.i = at;
    }
    refresh();
  };
}

function clearItem(id) {
  if (!findItem(id)) return;                      // repeat tap during the slide-out: keep the real Undo
  const restore = removeFromToday(id, 'clear');
  prefs.doneTaps++; savePrefs();
  showToast('Cleared', { commit: () => api.post(`/api/conversations/${id}/done`).then(loadChats).catch(onError), undo: restore });
}

function snooze(id, until, label) {
  const restore = removeFromToday(id, 'other');
  showToast(`Later: ${label}`, {
    commit: () => api.post(`/api/conversations/${id}/snooze`, { until }).catch(onError),
    undo: restore,
  });
}

// ------------------------------------------------------------------ replies and reactions [9][14][15]
const recipientName = (c) => c.title;
/** Short name: a person's first name ("Dave"), an organisation's or group's full name. */
const shortName = (c) => {
  const clean = c.title.replace(/\(.*?\)/g, '').trim();
  return c.kind === 'direct' && !/\d/.test(clean) ? clean.split(/\s+/)[0] : clean;
};
const canReply = (c, item) => !c.blocked && c.tier !== 'unknown' && !/no-?reply|news@/i.test(c.address || '')
  && !(item && item.suggestion.lane === 'reading');

/** Suggested replies for an open conversation. If the event moved to the free slot, lead with a counter-proposal. */
function repliesFor(item) {
  if (!item || !prefs.ai) return [];
  const s = item.suggestion, u = ui(item.conversation.id);
  if (u.eventSlot === 'alt' && item.alternative && s.replies.length) {
    return [`${fmtTime(s.event.start)} doesn't work for me. Could we do ${fmtTime(item.alternative.start)} instead?`, ...s.replies.slice(0, 2)];
  }
  return s.replies.slice(0, 3);
}

/** Send = one tap for every recipient (owner's decision), held behind the undo window [15].
 *  The message shows in the thread as "Sending" straight away. */
function sendReply(id, text) {
  text = (text || '').trim();
  const conv = state.convs[id];
  if (!text || !conv) return;
  if (state.viewer?.from === 'session' && !findItem(id)) return;   // repeat tap during the slide-out
  const who = conv.slack_thread ? `${conv.title} thread (${conv.group_size} members)` : conv.group_size ? `${conv.title} (group of ${conv.group_size})`
    : conv.external ? `${conv.title} (outside ${ORG})` : conv.title;
  const pending = { id: `pending-${Date.now()}`, from: 'me', sender: 'You', body: text, at: localISO(new Date()), reactions: [], pending: true };
  conv.messages.push(pending);
  ui(id).draft = '';
  ui(id).showAll = true;
  const restore = removeFromToday(id, 'reply');
  if (state.viewer?.from === 'chats') renderFocus(true);
  showToast(`Sending to ${who} · ${channelMeta(conv.channel).label}`, {
    ms: prefs.undoSeconds * 1000,
    countdown: true,
    commit: async () => {
      try {
        await api.post(`/api/conversations/${id}/reply`, { text });
        await Promise.all([loadConversation(id), loadChats()]);
        refresh();
      } catch (err) { onError(err); }
    },
    undo: () => {
      conv.messages = conv.messages.filter((x) => x !== pending);
      ui(id).draft = text;
      restore();
      refresh();
    },
  });
}

/** A reaction is a valid reply in chat [assessment gap 8]. */
function react(id, emoji) {
  const conv = state.convs[id];
  if (!conv) return;
  if (state.viewer?.from === 'session' && !findItem(id)) return;
  const target = [...conv.messages].reverse().find((x) => x.from === 'them');
  if (!target) return;
  const mine = { emoji, by: 'You', pending: true };
  target.reactions.push(mine);
  const restore = removeFromToday(id, 'reply');
  if (state.viewer?.from === 'chats') renderFocus(true);
  showToast(`${emoji} to ${shortName(conv)}`, {
    commit: async () => {
      try { await api.post(`/api/conversations/${id}/react`, { emoji }); await Promise.all([loadConversation(id), loadChats()]); refresh(); }
      catch (err) { onError(err); }
    },
    undo: () => { target.reactions = target.reactions.filter((r) => r !== mine); restore(); refresh(); },
  });
}

/** Calendar invitation: Accept, Maybe or Decline [assessment gap 4]. */
/** Answer an invitation. Like adding an event, it leaves the conversation open so you can still reply;
 *  it only clears itself when there's nothing left to do (no reply suggested). Undo reverses the answer. */
async function respondInvite(id, response) {
  const item = findItem(id);
  if (!item) return;
  const inv = item.suggestion.invite;
  if (inv.response === response) return;
  await api.post(`/api/conversations/${id}/invite`, { response });
  const before = inv.response;
  inv.response = response;
  const sess = state.session;
  if (sess && !before) sess.stats.invite++;
  await reloadAgenda();
  const undo = async () => {
    await api.post(`/api/conversations/${id}/invite`, { response: before });
    inv.response = before;
    if (sess && state.session === sess && !before) sess.stats.invite--;
    await reloadAgenda();
  };
  const label = { accept: 'Accepted · added to Work calendar', maybe: 'Maybe · added to Work calendar', decline: 'Declined' }[response];
  if (itemComplete(item)) {
    const restore = removeFromToday(id, 'other');
    showToast(`${label} · Cleared`, {
      commit: () => api.post(`/api/conversations/${id}/done`).catch(onError),
      undo: async () => { await undo(); restore(); },
    });
  } else {
    refresh();
    showToast(label, { undo: async () => { await undo(); refresh(); } });
  }
}

// ------------------------------------------------------------------ proposals: events and tasks [11][12][13]
function proposedEvent(item, slot) {
  const ev = item.suggestion.event, u = ui(item.conversation.id);
  const useAlt = slot === 'alt' && item.alternative;
  return {
    title: ev.title,
    start: useAlt ? item.alternative.start : ev.start,
    end: useAlt ? item.alternative.end : ev.end,
    calendar: u.cal || ev.calendar,
    location: ev.location,
  };
}

/** True when every proposal is handled (or already in the shared calendar) and there's nothing to reply to. */
function itemComplete(item) {
  const s = item.suggestion, u = ui(item.conversation.id);
  const eventPending = s.event && !u.eventAdded && !item.duplicate;
  return !eventPending && !(s.task && !u.taskAdded) && repliesFor(item).length === 0 && !(s.invite && !s.invite.response);
}

async function addEvent(id, slot) {
  const item = findItem(id), u = ui(id);
  const ev = proposedEvent(item, slot);
  const created = await api.post(`/api/conversations/${id}/event`, ev);
  u.eventAdded = created; u.eventSlot = slot;
  if (slot === 'alt') delete u.draft;             // let the counter-proposal become the draft
  const sess = state.session;
  if (sess) sess.stats.events++;
  await reloadAgenda();
  const undoEvent = async () => {
    await api.del(`/api/events/${created.calendar}/${created.id}`);
    delete u.eventAdded; delete u.eventSlot;
    if (sess && state.session === sess) sess.stats.events--;
    await reloadAgenda();
  };
  const label = `Added to ${calMeta(ev.calendar).label} calendar`;
  if (itemComplete(item)) {
    // One tap finishes the item: one toast, and Undo reverses both [4]
    const restore = removeFromToday(id, 'other');
    showToast(`${label} · Cleared`, {
      commit: () => api.post(`/api/conversations/${id}/done`).catch(onError),
      undo: async () => { await undoEvent(); restore(); },
    });
  } else {
    refresh();
    showToast(label, { undo: async () => { await undoEvent(); refresh(); } });
  }
}

async function addTask(id) {
  const item = findItem(id), u = ui(id);
  const created = await api.post(`/api/conversations/${id}/task`, item.suggestion.task);
  u.taskAdded = created;
  const sess = state.session;
  if (sess) sess.stats.tasks++;
  await reloadTasks();
  const undoTask = async () => {
    await api.del(`/api/tasks/${created.id}`); delete u.taskAdded;
    if (sess && state.session === sess) sess.stats.tasks--;
    await reloadTasks();
  };
  if (itemComplete(item)) {
    const restore = removeFromToday(id, 'other');
    showToast('Added to Tasks · Cleared', {
      commit: () => api.post(`/api/conversations/${id}/done`).catch(onError),
      undo: async () => { await undoTask(); restore(); },
    });
  } else {
    refresh();
    showToast('Added to Tasks', { undo: async () => { await undoTask(); refresh(); } });
  }
}

// ------------------------------------------------------------------ overlay: session (from Today) or conversation (from Chats)
function openOverlay() {
  $('#focus').classList.add('open');
  document.body.classList.add('focus-open');
  fitToKeyboard();
}
function startSession(fromId) {
  const ids = visibleToday().map((i) => i.conversation.id);
  if (!ids.length) return;
  state.session = { ids, i: Math.max(0, ids.indexOf(fromId)), total: ids.length, handled: 0,
                    stats: { reply: 0, clear: 0, invite: 0, other: 0, events: 0, tasks: 0 } };
  state.viewer = { from: 'session' };
  $('#focus').dataset.itemId = '';
  renderFocus();
  openOverlay();
}
async function openChat(id) {
  if (!state.convs[id]) await loadConversation(id);
  state.viewer = { from: 'chats', id };
  $('#focus').dataset.itemId = '';
  renderFocus();
  openOverlay();
}
function closeOverlay() {
  state.session = null;
  state.viewer = null;
  $('#focus').classList.remove('open');
  document.body.classList.remove('focus-open');
  render();
  loadChats().then(render).catch(onError);
}

/** The session cursor's item. If it was cleared, move forward. Past the last item: the finish screen. */
function currentItem() {
  const s = state.session;
  while (s.i < s.ids.length && !findItem(s.ids[s.i])) s.i++;
  return s.i < s.ids.length ? findItem(s.ids[s.i]) : null;
}
/** Index of the next (dir 1) or previous (dir -1) item still to handle, or -1. */
function neighbour(dir) {
  const s = state.session;
  for (let j = s.i + dir; j >= 0 && j < s.ids.length; j += dir) if (findItem(s.ids[j])) return j;
  return -1;
}
const sessionLeft = () => state.session.ids.filter((id) => findItem(id)).length;
const canGo = (dir) => (dir === 1 ? state.session.i < state.session.ids.length : neighbour(-1) >= 0);
/** Move between items: dir 1 = next, -1 = previous. Moving on never clears anything. */
function navigate(dir) {
  let j = neighbour(dir);
  if (j < 0 && dir === 1 && canGo(1)) j = state.session.ids.length;   // past the last item: finish screen
  const body = $('#focus .focus-body');
  if (j < 0) {                                    // nothing further that way: small bounce
    if (body && !reduceMotion()) body.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 24}px)` }, { transform: 'translateX(0)' }], { duration: 220 });
    return;
  }
  state.session.i = j;
  state.enterDir = dir;
  renderFocus();
}

/** Render the overlay. keepScroll: re-render the same conversation and show its newest message (after sending). */
function renderFocus(keepScroll = false) {
  const focus = $('#focus');
  const v = state.viewer;
  if (!v) return;
  let item = null, conv = null, top;
  if (v.from === 'session') {
    const s = state.session;
    item = currentItem();
    conv = item && item.conversation;
    const done = s.ids.filter((id) => !findItem(id)).length;
    const pct = Math.round((done / s.total) * 100);
    const label = item ? `<span class="who-top">${s.i + 1} of ${s.total}</span>`
      : (sessionLeft() ? 'Done for now' : 'Finished');
    top = `<div class="focus-top">
      <button class="close" data-action="close-overlay">Close</button>
      <div class="progress-label">${label}</div>
      <div class="nav">${item || canGo(-1) ? `
        <button data-action="nav-prev" aria-label="Previous item" ${canGo(-1) ? '' : 'disabled'}>${ICON.back}</button>
        <button data-action="nav-next" aria-label="Next item" ${canGo(1) ? '' : 'disabled'}>${ICON.fwd}</button>` : ''}</div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    </div>`;
  } else {
    conv = state.convs[v.id];
    item = findItem(v.id);
    const muteBtn = conv.kind === 'group'
      ? `<button data-action="mute" data-id="${conv.id}" aria-label="${conv.muted ? 'Unmute' : 'Mute'} ${esc(conv.title)}">${conv.muted ? ICON.bellOff : ICON.bell}</button>` : '';
    top = `<div class="focus-top">
      <button class="close" data-action="close-overlay">‹ Chats</button>
      <div class="progress-label"><span class="who-top">${esc(conv.title)}</span><small>${esc(channelMeta(conv.channel).label)}</small></div>
      <div class="nav">${muteBtn}</div>
    </div>`;
  }

  const prevId = focus.dataset.itemId;
  const prevScroll = $('.focus-scroll', focus)?.scrollTop || 0;
  focus.innerHTML = top + (conv ? conversationHTML(conv, item) : allClearHTML());
  focus.dataset.itemId = conv ? conv.id : '';
  const scroller = $('.focus-scroll', focus);

  if (conv && scroller) {
    if (prevId === conv.id && keepScroll) {
      scroller.scrollTop = scroller.scrollHeight; // just sent: show the newest message
    } else if (prevId === conv.id) {
      scroller.scrollTop = prevScroll;            // same conversation re-rendered: stay put
    } else {
      // New conversation: start at the "New" divider so what's new is in view; with no divider,
      // start at the bottom like Messages [A1: newest at the bottom].
      // Design B: open at the newest message, like Messages. If the new messages run taller than
      // the screen, start at the "New" divider instead so none are skipped.
      const marker = $('.new-divider', scroller);
      const fromMarker = marker ? scroller.scrollHeight - marker.offsetTop : 0;
      scroller.scrollTop = marker && fromMarker > scroller.clientHeight ? Math.max(0, marker.offsetTop - 8) : scroller.scrollHeight;
    }
  }
  // A new item slides in from the side it came from [F3]
  const dir = state.enterDir; state.enterDir = null;
  const body = $('.focus-body', focus);
  if (dir && body && prevId !== focus.dataset.itemId && !reduceMotion()) {
    body.animate([{ transform: `translateX(${dir * 40}%)`, opacity: 0.3 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

/** Brief format (the owner preferred it for group chats, 22 Oct): summary on top, the new messages folded under
 *  "Show all", earlier history folded away. Used for group catch-ups and long emails; one-to-one chats and
 *  short emails stay as plain chat with tap-to-add underlines. */
function useBrief(conv, item) {
  if (!item || !prefs.ai) return false;
  const last = conv.messages[conv.messages.length - 1];
  return (conv.kind === 'group' && item.new_count > 1) || item.new_count > 2 || last.body.length > 280;
}

/** Where the new messages start: the first inbound message after your last reply (or the last message). */
function splitNew(conv) {
  const msgs = conv.messages;
  let lastMine = -1;
  msgs.forEach((x, i) => { if (x.from === 'me' && !x.pending) lastMine = i; });
  let firstNew = msgs.findIndex((x, i) => i > lastMine && x.from === 'them');
  if (firstNew < 0) firstNew = Math.max(0, msgs.length - 1);
  return { earlier: msgs.slice(0, firstNew), recent: msgs.slice(firstNew) };
}

/** "Earlier in this conversation (n)": history folded away until asked for. */
function foldHTML(conv, earlier) {
  if (!earlier.length) return '';
  const u = ui(conv.id);
  return `<button class="fold" data-action="toggle-earlier" data-id="${conv.id}" aria-expanded="${!!u.showEarlier}">
      ${u.showEarlier ? 'Hide earlier messages' : `Earlier in this conversation (${earlier.length})`}
      <span class="${u.showEarlier ? 'up' : ''}"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span></button>
      ${u.showEarlier ? `<div class="earlier">${threadHTML({ ...conv, messages: earlier }, null)}</div>` : ''}`;
}

/** Start view (owner's request, 22 Oct): only the most recent message(s) show; the history is folded. */
function recentHTML(conv, item, after = '') {
  const { earlier, recent } = splitNew(conv);
  return foldHTML(conv, earlier) + threadHTML({ ...conv, messages: recent }, item, after);
}

function briefHTML(conv, item, after = '') {
  const { earlier, recent } = splitNew(conv);
  const n = recent.filter((x) => x.from === 'them').length;
  const fold = foldHTML(conv, earlier);
  return `${fold}<div class="summary brief">
      <div class="caption"><span class="ai-glyph" aria-hidden="true">✦</span>Summary of ${n} new</div>
      <p class="ai">${esc(item.suggestion.summary)}</p>
      <button class="link" data-action="show-all" data-id="${conv.id}">Show all ${n} message${n === 1 ? '' : 's'}</button></div>${after}`;
}

/** Show an AI summary only where it saves reading: email, group catch-ups, or long messages [10]. */
function useSummary(conv, item) {
  if (!item || !prefs.ai) return false;
  return conv.kind !== 'direct' || item.new_count > 2 || conv.messages[conv.messages.length - 1].body.length > 140;
}

function conversationHTML(conv, item) {
  const ch = channelMeta(conv.channel);
  const s = item && item.suggestion;
  const where = [ch.label, conv.kind === 'group' ? `${conv.group_size} people` : conv.address].filter(Boolean).join(' · ');
  const warning = s && s.warning ? `<div class="warning" role="alert"><span aria-hidden="true">⚠︎</span><span>${esc(s.warning)}</span></div>` : '';
  const screener = s && s.lane === 'new_senders' ? screenerHTML(item) : '';
  const composer = canReply(conv, item) ? composerHTML(conv, item) : '';
  const actions = actionBarHTML(item);
  const clear = item && state.viewer?.from === 'session'
    ? `<div class="focus-actions"><button class="btn filled" data-action="clear" data-id="${conv.id}" aria-label="Clear: remove from Today, no action">Clear</button></div>` : '';

  // Who it's from and how it came in, always at the top of the conversation (owner's bug report, 22 Oct)
  const header = state.viewer?.from === 'session'
    ? `<div class="sender-row">${avatarHTML(conv)}
        <div class="sender-text"><div class="sender-name">${esc(conv.title)}</div>
          <div class="sender-via">${brandIcon(brandFor(conv.channel), ch.label)}<span>via ${esc(ch.label)}${conv.kind === 'group' ? ` · ${conv.group_size} people` : conv.address ? ` · ${esc(conv.address)}` : ''}</span></div>
          ${item && item.priority.reason ? `<div class="why-here ${conv.tier === 'vip' ? 'vip' : ''}">${esc(item.priority.reason)}</div>` : ''}</div></div>`
    : `<div class="who">${avatarHTML(conv, 'lg')}
        <div><div class="name">${esc(conv.title)}</div>
          <div class="footnote muted">${esc(where)}${item && item.priority.reason ? ` · ${esc(item.priority.reason)}` : ''}</div></div></div>`;
  return `<div class="focus-scroll"><div class="focus-body">
      ${header}
      ${conv.subject ? `<div class="subject-line">${esc(conv.subject)}</div>` : ''}
      ${warning}
      ${useBrief(conv, item) && !ui(conv.id).showAll ? briefHTML(conv, item, actions)
        : state.viewer?.from === 'session' ? recentHTML(conv, item, actions) : threadHTML(conv, item, actions)}
      ${screener}
    </div></div>
    ${composer}${clear}`;
}

/** Full history, oldest first, newest at the bottom. A "New" divider (with the AI summary) marks
 *  where the messages since you last wrote begin. */
function threadHTML(conv, item, after = '') {
  const msgs = conv.messages;
  let lastIn = -1;
  msgs.forEach((x, i) => { if (x.from === 'them') lastIn = i; });
  const isEmail = conv.kind === 'email', isGroup = conv.kind === 'group';
  let lastMine = -1;
  msgs.forEach((x, i) => { if (x.from === 'me' && !x.pending) lastMine = i; });
  const firstNew = item ? msgs.findIndex((x, i) => i > lastMine && x.from === 'them') : -1;
  let html = '', lastDay = null;
  msgs.forEach((x, i) => {
    const day = startOfDay(toDate(x.at)).getTime();
    if (day !== lastDay) { lastDay = day; html += `<div class="day-sep">${fmtDay(x.at)}</div>`; }
    if (i === firstNew) {
      // The divider only means something when there's older history above it
      const count = msgs.slice(firstNew).filter((y) => y.from === 'them').length;
      if (firstNew > 0) html += `<div class="new-divider"><span>${count > 1 ? `${count} new` : 'New'}</span></div>`;
      if (useBrief(conv, item)) {
        html += `<div class="summary-line"><span class="ai-glyph" aria-hidden="true">✦</span><span class="ai"><span class="sr">Summary: </span>${esc(item.suggestion.summary)}</span></div>`;
      }
    }
    const mine = x.from === 'me';
    const next = msgs[i + 1];
    const endOfRun = !next || next.from !== x.from || next.sender !== x.sender || (toDate(next.at) - toDate(x.at)) > 15 * 60000;
    const reactions = x.reactions.length
      ? `<div class="reactions ${mine ? 'mine' : ''}">${x.reactions.map((r) => `<span title="${esc(r.by)}">${esc(r.emoji)}${r.by === 'You' ? '' : ` <small>${esc(r.by.split(' ')[0])}</small>`}</span>`).join('')}</div>` : '';
    const attach = x.attachment ? `<div class="attachment">${ICON.clip}<span>${esc(x.attachment)}</span></div>` : '';
    if (isEmail) {
      html += `<div class="mail ${mine ? 'mine' : ''}"><div class="mail-head"><b>${esc(mine ? 'You' : x.sender)}</b><span>${x.pending ? 'Sending…' : fmtTime(x.at)}</span></div>
        <div class="mail-text">${mine ? esc(x.body) : detectPhrases(x.body, item)}</div>${attach}</div>`;
    } else {
      const showName = isGroup && !mine && (i === 0 || msgs[i - 1].sender !== x.sender || msgs[i - 1].from !== 'them');
      html += `<div class="msg ${mine ? 'out' : 'in'} ${endOfRun ? 'end' : ''}">
        ${showName ? `<div class="msg-name" style="--n:${colourFor(x.sender)}">${esc(x.sender)}</div>` : ''}
        <div class="bubble ${mine ? 'bubble-me' : 'bubble-them'}">${mine ? esc(x.body) : detectPhrases(x.body, item)}</div>${attach}${reactions}
        ${endOfRun ? `<div class="msg-time">${x.pending ? 'Sending…' : fmtTime(x.at)}</div>` : ''}</div>`;
    }
    if (i === lastIn && after) html += after;     // suggestions sit under the newest message they relate to
  });
  if (lastIn < 0 && after) html += after;
  return `<div class="thread">${html}</div>`;
}

// ------------------------------------------------------------------ one-tap suggestions (design B, chosen 22 Oct 2026)
/** The sender's words a suggestion came from: the quote inside its "Why" line. */
const phraseOf = (p) => (p && p.why ? (p.why.match(/“(.+)”/) || [])[1] : null);

/** Underline each suggestion's source words in the message. Tap adds it; hold opens the options. */
function detectPhrases(text, item) {
  let out = esc(text);
  if (!item || !prefs.ai) return out;
  const s = item.suggestion, u = ui(item.conversation.id);
  // Only what can still be added: not events already in the calendar, not things just added
  const open = [['event', !item.duplicate && !u.eventAdded && s.event], ['task', !u.taskAdded && s.task]];
  for (const [kind, p] of open) {
    const phrase = phraseOf(p);
    if (!phrase || !out.includes(esc(phrase))) continue;
    out = out.replace(esc(phrase), `<span class="detect" role="button" tabindex="0" data-action="quick-add" data-hold="details"
      data-id="${item.conversation.id}" data-kind="${kind}" aria-label="Add: ${esc(p.title)}">${esc(phrase)}</span>`);
  }
  return out;
}

/** Short "Sun 6pm" style label. */
function shortWhen(iso) {
  const n = dayDiff(iso);
  const day = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 7 ? toDate(iso).toLocaleDateString('en-AU', { weekday: 'short' })
    : toDate(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} ${fmtTime(iso).replace(':00', '')}`;
}

/** The bar above the reply box: one tap per suggestion [owner: "one click"]. Hold a button for options. */
function actionBarHTML(item) {
  if (!item || !prefs.ai) return '';
  const s = item.suggestion, id = item.conversation.id, u = ui(id);
  const chips = [];
  if (s.invite && s.invite.response) {
    const said = { accept: '✓ Accepted', maybe: '✓ Maybe', decline: '✓ Declined' }[s.invite.response];
    chips.push(`<span class="act-chip done">${said}</span>`);
    for (const [r, label] of [['accept', 'Accept'], ['maybe', 'Maybe'], ['decline', 'Decline']]) {
      if (r !== s.invite.response) chips.push(`<button class="act-chip" data-action="invite" data-id="${id}" data-response="${r}">${label}</button>`);
    }
  } else if (s.invite) {
    chips.push(`<button class="act-chip primary" data-action="invite" data-id="${id}" data-response="accept">✓ Accept</button>`,
      `<button class="act-chip" data-action="invite" data-id="${id}" data-response="maybe">Maybe</button>`,
      `<button class="act-chip" data-action="invite" data-id="${id}" data-response="decline">Decline</button>`);
  }
  if (s.event) {
    const ev = s.event, cal = calMeta(u.cal || ev.calendar).label;
    if (u.eventAdded) chips.push(`<span class="act-chip done">✓ Added to ${esc(calMeta(u.eventAdded.calendar).label)}</span>`);
    else if (item.duplicate) chips.push(`<span class="act-chip done">✓ In ${esc(calMeta(item.duplicate.calendar).label)} calendar</span>`);
    else if (item.clashes.length && item.alternative) {
      chips.push(`<button class="act-chip primary" data-action="quick-add" data-hold="details" data-id="${id}" data-kind="event"
        aria-label="Add ${esc(ev.title)} at ${fmtTime(item.alternative.start)}, the requested ${fmtTime(ev.start)} clashes with ${esc(item.clashes.join(', '))}">
        ${ICON.cal}<span>Add ${fmtTime(item.alternative.start).replace(':00', '')}<small>${fmtTime(ev.start).replace(':00', '')} clashes</small></span></button>`);
    } else {
      chips.push(`<button class="act-chip primary" data-action="quick-add" data-hold="details" data-id="${id}" data-kind="event"
        aria-label="Add ${esc(ev.title)} to ${esc(cal)} calendar">${ICON.cal}<span>Add ${esc(shortWhen(ev.start))}<small>${esc(cal)}</small></span></button>`);
    }
  }
  if (s.task) {
    if (u.taskAdded) chips.push('<span class="act-chip done">✓ Task added</span>');
    else chips.push(`<button class="act-chip primary" data-action="quick-add" data-hold="details" data-id="${id}" data-kind="task"
      aria-label="Add task: ${esc(s.task.title)}">${ICON.task}<span>Add task${s.task.due ? `<small>${esc(shortWhen(s.task.due))}</small>` : ''}</span></button>`);
  }
  if (!chips.length) return '';
  return `<div class="inline-acts"><span class="ai-glyph" aria-hidden="true">✦</span><span class="sr">Suggestions. </span>
    <div class="act-row">${chips.join('')}</div></div>`;
}

/** One tap: add with the sensible default. A clash takes the free slot (and the reply becomes the counter-proposal). */
async function quickAdd(id, kind) {
  const item = findItem(id);
  if (!item) return;
  const u = ui(id);
  if (kind === 'task') {
    if (u.taskAdded) return showToast('Already in Tasks');
    return addTask(id);
  }
  if (u.eventAdded) return showToast('Already added');
  if (item.duplicate) return showToast(`Already in the ${calMeta(item.duplicate.calendar).label} calendar`);
  return addEvent(id, item.clashes.length && item.alternative ? 'alt' : 'orig');
}

/** Hold a phrase or button: the full suggestion (calendar choice, clash options, where it came from). */
function openDetails(id, kind) {
  const item = findItem(id);
  if (!item) return;
  state.details = { id, kind };
  const body = kind === 'task' ? taskCardHTML(item) : kind === 'invite' ? inviteCardHTML(item) : eventCardHTML(item);
  openSheet(`<h3>${kind === 'task' ? 'Task' : 'Calendar'}</h3>${body}
    <button class="btn plain wide" data-action="close-sheet">Done</button>`);
}

function eventCardHTML(item) {
  const id = item.conversation.id, ev = item.suggestion.event, u = ui(id);
  if (!ev) return '';
  if (item.duplicate && !u.eventAdded) {
    // Shared calendar check [A4]: someone already put it in
    const d = item.duplicate;
    return `<div class="card proposal"><span class="ic">${ICON.cal}</span><div class="grow">
      <div class="title">${esc(ev.title)}</div><div class="subhead muted">${fmtRange(ev.start, ev.end)}</div>
      <div class="added">✓ Already in the ${esc(calMeta(d.calendar).label)} calendar${d.added_by && d.added_by !== 'You' ? `, added by ${esc(d.added_by)}` : ''}</div></div></div>`;
  }
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

function inviteCardHTML(item) {
  const inv = item.suggestion.invite;
  if (!inv) return '';
  const id = item.conversation.id;
  const clash = item.clashes.length ? `<div class="clash">Clashes with ${esc(item.clashes.join(', '))}</div>` : '<div class="why">No clash in your calendar</div>';
  return `<div class="card proposal"><span class="ic">${ICON.cal}</span><div class="grow">
      <div class="title">${esc(inv.title)}</div>
      <div class="subhead muted">${fmtRange(inv.start, inv.end)}${inv.location ? ` · ${esc(inv.location)}` : ''}</div>
      <div class="why">Invitation from ${esc(inv.organiser)}</div>${clash}
      <div class="invite-actions">
        <button class="btn tinted" data-action="invite" data-id="${id}" data-response="accept">Accept</button>
        <button class="btn plain" data-action="invite" data-id="${id}" data-response="maybe">Maybe</button>
        <button class="btn plain" data-action="invite" data-id="${id}" data-response="decline">Decline</button>
      </div></div></div>`;
}

function taskCardHTML(item) {
  const id = item.conversation.id, t = item.suggestion.task, u = ui(id);
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

/** Reply box pinned at the bottom, like Messages. What is in the box is exactly what gets sent.
 *  It starts as the best suggestion; other options and reactions sit in one row above it. */
function composerHTML(conv, item) {
  const ch = channelMeta(conv.channel);
  const u = ui(conv.id);
  const options = repliesFor(item);
  const draft = u.draft ?? options[0] ?? '';
  const others = options.filter((o) => o !== draft);
  const flags = [];
  if (conv.slack_thread) flags.push(`<span class="flag">a thread with ${conv.group_size} members</span>`);
  else if (conv.group_size) flags.push(`<span class="flag">a group of ${conv.group_size}</span>`);
  if (conv.external) flags.push(`<span class="flag">someone outside ${esc(ORG)}</span>`);
  const drafted = options.includes(draft);
  const reactions = ch.reactions && conv.messages.some((x) => x.from === 'them')
    ? ['👍', '❤️', '😂', '🙏'].map((e) => `<button class="chip react" data-action="react" data-id="${conv.id}" data-emoji="${e}" aria-label="React ${e}">${e}</button>`).join('') : '';
  const chips = others.map((r) => `<button class="chip alt" data-action="use-reply" data-id="${conv.id}" data-text="${esc(r)}">${esc(r)}</button>`).join('');
  // Who it goes to is in the top bar; a line here only when the reply needs a second look [14]
  const warn = flags.length ? `<div class="to-line">Replying to ${flags.join(' · ')}</div>` : '';
  return `<div class="composer">
    ${warn}
    ${reactions || chips ? `<div class="chip-row">${chips}${reactions}</div>` : ''}
    <div class="compose">
      <div class="box">${drafted ? '<span class="draft-mark" aria-hidden="true" title="Suggested reply">✦</span>' : ''}
        <textarea id="compose-${conv.id}" data-id="${conv.id}" class="${drafted ? 'drafted' : ''}" rows="${Math.min(4, Math.max(1, Math.ceil(draft.length / 34)))}"
          placeholder="Message ${esc(shortName(conv))}" aria-label="${drafted ? 'Suggested reply to' : 'Reply to'} ${esc(recipientName(conv))} on ${esc(ch.label)}">${esc(draft)}</textarea></div>
      <button class="send-btn" data-action="send" data-id="${conv.id}" aria-label="Send to ${esc(recipientName(conv))} on ${esc(ch.label)}">${ICON.send}</button>
    </div></div>`;
}

function screenerHTML(item) {
  const id = item.conversation.id;
  return `<div class="card"><div class="headline">First message from this sender</div>
      <p class="subhead muted" style="margin:4px 0 12px">Allow sends their future messages to Needs you. Block hides them for good.</p>
      <div style="display:flex;gap:8px">
        <button class="btn danger" style="flex:1" data-action="block" data-id="${id}">Block</button>
        <button class="btn plain" style="flex:1" data-action="allow" data-id="${id}">Allow</button></div></div>`;
}

/** "13 handled: 6 replies, 4 cleared, 3 events added". Facts, no points or streaks [H6][H9]. */
function tallyLine(s) {
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const parts = [];
  if (s.stats.reply) parts.push(n(s.stats.reply, 'reply', 'replies'));
  if (s.stats.invite) parts.push(n(s.stats.invite, 'invitation answered', 'invitations answered'));
  if (s.stats.clear) parts.push(`${s.stats.clear} cleared`);
  if (s.stats.events) parts.push(n(s.stats.events, 'event added', 'events added'));
  if (s.stats.tasks) parts.push(n(s.stats.tasks, 'task added', 'tasks added'));
  if (!s.handled && !parts.length) return 'Nothing handled this time.';
  return `${s.handled} handled${parts.length ? ': ' + parts.join(', ') : ''}.`;
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
      <p class="muted">${tallyLine(s)}${left ? `<br>${left} left for later on Today.` : ''}</p></div>
      ${nextLine}
      <button class="btn filled wide" style="margin-top:24px" data-action="close-overlay">Back to Today</button>
      ${left ? `<button class="btn tinted wide" style="margin-top:10px" data-action="restart">Go through the ${left} again</button>` : ''}
    </div></div>`;
}

// ------------------------------------------------------------------ keyboard: keep the reply box above it [F10]
// iOS doesn't resize fixed layers for the keyboard, so size the overlay to the visual viewport.
function fitToKeyboard() {
  const vv = window.visualViewport, focus = $('#focus');
  if (!vv || !focus) return;
  focus.style.height = `${vv.height}px`;
  focus.style.top = `${vv.offsetTop}px`;
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitToKeyboard);
  visualViewport.addEventListener('scroll', fitToKeyboard);
}
document.addEventListener('focusout', () => setTimeout(fitToKeyboard, 50));   // iOS 26 can leave an offset behind

// ------------------------------------------------------------------ sheets
function openSheet(html) {
  $('.sheet').innerHTML = `<div class="grabber" aria-hidden="true"></div>${html}`;
  $('#sheet-wrap').classList.add('open');
}
function closeSheet() { $('#sheet-wrap').classList.remove('open'); state.details = null; }

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
const laterRows = (id) => laterOptions().map(([label, d]) =>
  `<button data-action="later-pick" data-id="${id}" data-until="${localISO(d)}" data-label="${esc(label)}">
    <span>${esc(label)}</span><span>${fmtDay(localISO(d))} ${fmtTime(localISO(d))}</span></button>`).join('');
function openLaterSheet(id) {
  openSheet(`<h3>Later</h3><p class="muted subhead">It comes back to Today at the time you pick.</p>
    <div class="sheet-list">${laterRows(id)}</div>
    <button class="btn plain wide" data-action="close-sheet">Cancel</button>`);
}
/** Press-and-hold menu on a Today row: the visible alternative to both swipes [7][F5]. */
function openRowMenu(id) {
  const item = findItem(id);
  if (!item) return;
  const c = item.conversation;
  openSheet(`<h3>${esc(c.title)}</h3><p class="muted subhead">${esc(item.channel.label)}${c.subject ? ` · ${esc(c.subject)}` : ''}</p>
    <div class="sheet-list"><button data-action="menu-clear" data-id="${id}"><span>Clear</span><span>No action needed</span></button>
      <button data-action="menu-open" data-id="${id}"><span>Open conversation</span><span>Full history</span></button></div>
    <div class="caption" style="margin:12px 4px 6px">Come back</div>
    <div class="sheet-list">${laterRows(id)}</div>
    <button class="btn plain wide" data-action="close-sheet">Cancel</button>`);
}
/** New message: pick a person, then the conversation opens with an empty reply box. */
function openComposeSheet(filter = '') {
  const f = filter.trim().toLowerCase();
  const people = state.contacts.filter((p) => !f || p.name.toLowerCase().includes(f));
  const rows = people.map((p) => `<button data-action="compose-to" data-contact="${p.id}" data-conv="${p.conversation || ''}">
      <span>${esc(p.name)}</span><span class="via">${brandIcon(brandFor(p.channel))}${esc(channelMeta(p.channel).label)}</span></button>`).join('');
  openSheet(`<h3>New message</h3>
    <input id="compose-search" class="search" type="search" placeholder="Name" value="${esc(filter)}" aria-label="Search people">
    <div class="sheet-list sheet-scroll">${rows || '<div class="foot" style="padding:14px">No one matches</div>'}</div>
    <button class="btn plain wide" data-action="close-sheet">Cancel</button>`);
}
function openEventSheet(e) {
  const cal = calMeta(e.calendar);
  openSheet(`<h3>${esc(e.title)}</h3>
    <p class="muted subhead">${fmtRange(e.start, e.end)}${e.location ? ` · ${esc(e.location)}` : ''}</p>
    <div class="sheet-list">
      <div class="sheet-row"><span>Calendar</span><span>${esc(cal.label)}${cal.shared ? ' (shared)' : ''}</span></div>
      <div class="sheet-row"><span>${e.pending ? 'Invited by' : 'Added by'}</span><span>${esc(e.added_by || 'You')}</span></div>
      ${e.pending ? `<button data-action="menu-open" data-id="${e.conversation}"><span>Reply to the invitation</span><span>Open</span></button>` : ''}
    </div>
    <button class="btn plain wide" data-action="close-sheet">Close</button>`);
}

// ------------------------------------------------------------------ Today [1][2][5][13][A1]
function nextEvent() {
  const now = new Date();
  return state.agenda.find((e) => !e.pending && toDate(e.end) > now && inMode(calMeta(e.calendar).account));
}

function dayStripHTML() {
  const now = new Date();
  const today = state.agenda.filter((e) => !e.pending && dayDiff(e.start) === 0 && inMode(calMeta(e.calendar).account));
  const booked = today.reduce((sum, e) => sum + (toDate(e.end) - toDate(e.start)) / 60000, 0);
  const next = today.find((e) => toDate(e.end) > now);
  const load = `${today.length} event${today.length === 1 ? '' : 's'} today · ${fmtDuration(booked)} booked`;
  if (!next) return `<button class="day-strip" data-action="tab" data-tab="calendar"><span class="grow"><span class="headline" style="display:block">Nothing else today</span><span class="footnote muted">${load}</span></span></button>`;
  const live = toDate(next.start) <= now;
  const mins = Math.round((toDate(next.start) - now) / 60000);
  const when = live ? 'Now' : mins < 60 ? `in ${mins}m` : fmtTime(next.start);
  return `<button class="day-strip" data-action="tab" data-tab="calendar"><span class="bar" style="background:${calMeta(next.calendar).colour}"></span>
    <span class="grow"><span class="headline" style="display:block">${live ? 'Now' : 'Next'}: ${esc(next.title)}</span>
    <span class="footnote muted">${load}</span></span><span class="when">${when}</span></button>`;
}

const modeSwitchHTML = () => `<div class="segmented" role="group" aria-label="Show">${
  [['all', 'All'], ['work', 'Work'], ['personal', 'Personal']].map(([m, l]) =>
    `<button aria-pressed="${state.mode === m}" data-action="mode" data-mode="${m}">${l}</button>`).join('')}</div>`;

function rowHTML(item) {
  const c = item.conversation, s = item.suggestion, ch = item.channel;
  const last = c.messages[c.messages.length - 1];
  const tags = [];
  if (prefs.ai) {
    if (s.invite) tags.push(`<span class="tag">${ICON.cal}Invitation</span>`);
    if (s.event && item.duplicate) tags.push(`<span class="tag">${ICON.cal}In calendar</span>`);
    else if (s.event) tags.push(`<span class="tag">${ICON.cal}${fmtDay(s.event.start)} ${fmtTime(s.event.start)}</span>`);
    if (s.task) tags.push(`<span class="tag">${ICON.task}Task</span>`);
    if (item.clashes.length) tags.push('<span class="tag red">Clash</span>');
  }
  if (s.warning) tags.push('<span class="tag red">Warning</span>');
  const sub = [ch.label, c.kind === 'group' && item.new_count > 1 ? `${item.new_count} new` : null, c.subject].filter(Boolean).join(' · ');
  const lastText = c.kind === 'group' ? `${last.sender}: ${last.body}` : last.body;
  const gist = useSummary(c, item)
    ? `<span class="ai"><span class="ai-glyph" aria-hidden="true">✦</span><span class="sr">Summary: </span>${esc(s.summary)}</span>`
    : esc(lastText);
  const reply = repliesFor(item)[0];
  return `<div class="swipe" data-id="${c.id}">
    <div class="swipe-bg" aria-hidden="true"><span class="later">Later</span><span class="done">Clear</span></div>
    <button class="row-inner" data-action="open" data-id="${c.id}">
      ${avatarHTML(c)}
      <span class="row-body">
        <span class="row-top"><span class="name">${esc(c.title)}</span><time>${ago(last.at)}</time></span>
        <span class="row-sub" style="display:block">${esc(sub)}</span>
        ${item.priority.reason && s.lane !== 'reading' ? `<span class="reason ${c.tier === 'vip' ? 'vip' : ''}">${esc(item.priority.reason)}</span>` : ''}
        <span class="row-gist">${gist}</span>
        ${reply && s.lane !== 'new_senders' ? `<span class="row-reply"><span aria-hidden="true">↩︎ </span><span class="sr">Suggested reply: </span>${esc(reply)}</span>` : ''}
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
  const vis = visibleToday();
  const ny = vis.filter((i) => i.suggestion.lane === 'needs_you').length;
  const tip = prefs.doneTaps >= 3 && !prefs.swiped && !prefs.tipDismissed
    ? `<div class="tip"><span>Swipe a row left to clear it, right for Later.</span><button data-action="dismiss-tip">Got it</button></div>` : '';

  let sections = '';
  for (const [lane, title] of LANES) {
    const items = vis.filter((i) => i.suggestion.lane === lane);
    if (!items.length) continue;
    const collapsible = lane === 'reading';
    const open = !collapsible || state.readingOpen;
    sections += `<div class="section-head"><h2>${title}<span class="count">${items.length}</span></h2>
      ${lane === 'needs_you' ? '<span class="foot" style="padding:0">By priority</span>' : ''}
      ${collapsible ? `<button class="toggle" data-action="toggle-reading" aria-expanded="${open}">${open ? 'Hide' : 'Show'}</button>` : ''}</div>
      ${open ? `<div class="group">${items.map(rowHTML).join('')}</div>` : ''}`;
  }
  const modeName = { all: '', work: ' in Work', personal: ' in Personal' }[state.mode];
  const body = vis.length ? tip + sections : `<div class="empty"><div class="check" aria-hidden="true">✓</div>
      <h2 class="title2">All clear${modeName}</h2>
      <p class="muted">${state.today.length ? 'Switch to All to see the rest.' : 'Nothing needs you right now.'}</p></div>`;
  const start = vis.length ? `<div class="start-bar"><button class="btn filled" data-action="start">Start · ${vis.length}</button></div>` : '';

  return `<header class="page-head"><h1 class="large-title" style="margin:0">Today</h1>
      <div class="muted">${dateLine}${ny ? ` · ${ny} need${ny === 1 ? 's' : ''} you` : ''}</div></header>
    ${modeSwitchHTML()}
    ${dayStripHTML()}
    ${body}${start}`;
}

// ------------------------------------------------------------------ Chats: every conversation, search, new message [A7]
function chatRowsHTML() {
  const rows = state.chats.filter((c) => inMode(channelMeta(c.channel).account)).map((c) => {
    const preview = c.match
      ? highlight(c.match, state.chatQuery)
      : esc(`${c.last.from === 'me' ? 'You: ' : c.kind === 'group' ? `${c.last.sender}: ` : ''}${c.last.body}`);
    const badge = c.open && c.unread ? `<span class="unread" aria-label="${c.unread} new">${c.unread}</span>` : '';
    return `<button class="chat-row" data-action="open-chat" data-id="${c.id}">
      ${avatarHTML(c)}
      <span class="row-body">
        <span class="row-top"><span class="name">${esc(c.title)}</span>${c.muted ? `<span class="muted-icon" aria-label="Muted">${ICON.bellOff}</span>` : ''}<time>${ago(c.last.at)}</time></span>
        <span class="chat-preview">${preview}</span>
      </span>${badge}</button>`;
  }).join('');
  return rows || `<div class="empty"><p class="muted">${state.chatQuery ? `Nothing matches “${esc(state.chatQuery)}”` : 'No conversations'}</p></div>`;
}
/** Search match snippet with the query highlighted. */
function highlight(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  const startAt = Math.max(0, i - 30);
  return `${startAt ? '…' : ''}${esc(text.slice(startAt, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
}
function chatsHTML() {
  return `<header class="page-head head-row"><h1 class="large-title" style="margin:0">Chats</h1>
      <button class="icon-btn" data-action="compose" aria-label="New message">${ICON.compose}</button></header>
    <label class="search-wrap">${ICON.search}<input id="chat-search" class="search" type="search" placeholder="Search messages and people"
      value="${esc(state.chatQuery)}" aria-label="Search messages and people"></label>
    ${modeSwitchHTML()}
    <div class="group" id="chat-list">${chatRowsHTML()}</div>`;
}

// ------------------------------------------------------------------ Calendar: day view and list [assessment gap 10]
const HOUR_PX = 52, DAY_START = 7, DAY_END = 21;

function calendarHTML() {
  const views = [['day', 'Day'], ['list', 'List']].map(([v, l]) =>
    `<button aria-pressed="${state.calView === v}" data-action="cal-view" data-view="${v}">${l}</button>`).join('');
  const evs = state.agenda.filter((e) => inMode(calMeta(e.calendar).account));
  return `<header class="page-head"><h1 class="large-title" style="margin:0">Calendar</h1>
      <div class="muted">Work and the shared Family calendar</div></header>
    ${modeSwitchHTML()}
    <div class="segmented" role="group" aria-label="View">${views}</div>
    ${state.calView === 'day' ? dayViewHTML(evs) : listViewHTML(evs)}`;
}

function dayViewHTML(evs) {
  const chips = Array.from({ length: 7 }, (_, k) => {
    const d = startOfDay(new Date()); d.setDate(d.getDate() + k);
    const label = k === 0 ? 'Today' : d.toLocaleDateString('en-AU', { weekday: 'short' });
    return `<button class="day-chip" aria-pressed="${state.calDay === k}" data-action="cal-day" data-day="${k}">
      <span>${label}</span><b>${d.getDate()}</b></button>`;
  }).join('');
  const day = startOfDay(new Date()); day.setDate(day.getDate() + state.calDay);
  const list = evs.filter((e) => startOfDay(toDate(e.start)).getTime() === day.getTime())
    .sort((a, b) => toDate(a.start) - toDate(b.start));
  // Lay overlapping events side by side
  const placed = [];
  for (const e of list) {
    const s = toDate(e.start), en = toDate(e.end);
    const cluster = placed.filter((p) => p.s < en && s < p.en);
    let col = 0;
    while (cluster.some((p) => p.col === col)) col++;
    const p = { e, s, en, col, cols: 1 };
    placed.push(p);
    const group = [...cluster, p];
    const cols = Math.max(...group.map((g) => g.col)) + 1;
    group.forEach((g) => { g.cols = Math.max(g.cols, cols); });
  }
  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, k) => {
    const h = DAY_START + k;
    const label = h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`;
    return `<div class="hour" style="top:${k * HOUR_PX + 10}px"><span>${label}</span></div>`;
  }).join('');
  const blocks = placed.map(({ e, s, en, col, cols }) => {
    const startH = Math.max(DAY_START, s.getHours() + s.getMinutes() / 60);
    const endH = Math.min(DAY_END, en.getHours() + en.getMinutes() / 60);
    const top = (startH - DAY_START) * HOUR_PX;
    const height = Math.max(24, (endH - startH) * HOUR_PX - 2);
    const cal = calMeta(e.calendar);
    const by = e.pending ? `Invitation from ${e.added_by}` : e.added_by && e.added_by !== 'You' ? `Added by ${e.added_by}` : '';
    return `<button class="ev-block ${e.pending ? 'pending' : ''} ${height < 44 ? 'short' : ''}" data-action="event-info" data-event="${esc(e.id)}"
      style="top:${top}px;height:${height}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px);--c:${cal.colour}">
      <b>${esc(e.title)}</b><span>${fmtTime(e.start)}${by ? ` · ${esc(by)}` : ''}</span></button>`;
  }).join('');
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowLine = state.calDay === 0 && nowH >= DAY_START && nowH <= DAY_END
    ? `<div class="now-line" style="top:${(nowH - DAY_START) * HOUR_PX}px"></div>` : '';
  const legend = state.meta.calendars.filter((c) => inMode(c.account)).map((c) =>
    `<span><i style="background:${c.colour}"></i>${esc(c.label)}${c.shared ? ' (shared)' : ''}</span>`).join('');
  return `<div class="day-chips">${chips}</div>
    <div class="legend">${legend}<span><i class="dash"></i>Invitation</span></div>
    <div class="timeline" style="height:${(DAY_END - DAY_START) * HOUR_PX + 24}px">${hours}<div class="ev-layer">${blocks}${nowLine}</div></div>
    ${list.length ? '' : '<p class="foot" style="text-align:center">Nothing on this day</p>'}`;
}

function listViewHTML(evs) {
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
    const mins = list.filter((e) => !e.pending).reduce((s, e) => s + (toDate(e.end) - toDate(e.start)) / 60000, 0);
    const date = toDate(first).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    html += `<div class="day-head"><h2>${fmtDay(first)} <span class="muted subhead" style="font-weight:400">${date}</span></h2>
      <span class="load">${list.length} event${list.length === 1 ? '' : 's'} · ${fmtDuration(mins)}</span></div>
      <div class="group">${list.map((e) => {
        const cls = toDate(e.end) < now ? 'past' : toDate(e.start) <= now ? 'now' : '';
        const cal = calMeta(e.calendar);
        const by = e.pending ? ` · Invitation from ${esc(e.added_by)}` : e.added_by && e.added_by !== 'You' ? ` · added by ${esc(e.added_by)}` : '';
        return `<button class="ev ${cls} ${e.pending ? 'pending' : ''}" data-action="event-info" data-event="${esc(e.id)}"><span class="bar" style="background:${cal.colour}"></span>
          <span class="t">${fmtTime(e.start)}<small>${fmtTime(e.end)}</small></span>
          <span><span class="headline" style="display:block">${esc(e.title)}</span><span class="meta">${esc(cal.label)}${e.location ? ` · ${esc(e.location)}` : ''}${by}</span></span></button>`;
      }).join('')}</div>`;
  }
  return html || '<div class="empty"><p class="muted">No events in the next 14 days.</p></div>';
}

// ------------------------------------------------------------------ Tasks and Settings
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
  const seg = (items, action, attr, current) => items.map(([v, l]) =>
    `<button aria-pressed="${current === v}" data-action="${action}" data-${attr}="${v}">${l}</button>`).join('');
  const accounts = [
    ...state.meta.channels.map((c) => [brandFor(c.id), c.label, c.id === 'gmail_work' ? 'Google Workspace' : c.id === 'gmail_personal' ? 'Personal Gmail' : '']),
    ...state.meta.calendars.map((c) => ['calendar', `${c.label} calendar`, `Google Calendar${c.shared ? ', shared' : ''}`]),
  ].map(([key, label, note]) => `<div class="setting">${brandIcon(key, '')}
      <div class="grow">${esc(label)}${note ? `<div class="note">${esc(note)}</div>` : ''}</div><span class="pill">Demo data</span></div>`).join('');
  const plan = state.meta.planned.map((p) => `<div class="setting"><div class="grow">${esc(p.label)}<div class="note">${esc(p.via)}</div></div>
      <span class="pill">Phase ${p.phase}</span></div>`).join('');
  return `<header class="page-head"><h1 class="large-title" style="margin:0">Settings</h1></header>
    <div class="section-head"><h2>Appearance</h2></div>
    <div class="group"><div style="padding:12px 16px">
      <div class="segmented" role="group" aria-label="Appearance" style="margin:0">${seg([['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], 'theme', 'theme', prefs.theme)}</div>
      <div class="foot" style="padding:8px 0 0">Automatic follows your iPhone's light or dark setting.</div></div></div>
    <div class="section-head"><h2>Work and personal</h2></div>
    <div class="group">
      <div class="setting"><div class="grow">Personal after hours<div class="note">Open in Personal after 7pm and at weekends. You can still switch any time.</div></div>
        <button class="switch" role="switch" aria-checked="${prefs.autoMode}" aria-label="Personal after hours" data-action="toggle-automode"></button></div>
      <div class="setting"><div class="grow">VIPs<div class="note">${esc(state.meta.vips.join(', '))}. They go first in Today; in phase 2 they also alert you straight away.</div></div></div>
    </div>
    <div class="section-head"><h2>Suggestions</h2></div>
    <div class="group">
      <div class="setting"><div class="grow">AI suggestions<div class="note">Summaries, replies, events and tasks. Off shows the original messages only.</div></div>
        <button class="switch" role="switch" aria-checked="${prefs.ai}" aria-label="AI suggestions" data-action="toggle-ai"></button></div>
      <div class="setting"><div class="grow">Undo send<div class="note">How long a reply waits before it goes.</div></div></div>
      <div style="padding:0 16px 12px"><div class="segmented" role="group" aria-label="Undo send delay">${seg([[5, '5s'], [10, '10s'], [20, '20s'], [30, '30s']], 'undo-secs', 'secs', prefs.undoSeconds)}</div></div>
    </div>
    <div class="section-head"><h2>Accounts</h2></div><div class="group">${accounts}</div>
    <div class="section-head"><h2>Build plan</h2></div><div class="group">${plan}</div>
    <p class="foot">Demo with made-up data. Nothing is sent anywhere.</p>
    <div style="padding:16px 0"><button class="btn tinted wide" data-action="reset">Reset demo data</button></div>`;
}

function render() {
  const views = { today: todayHTML, chats: chatsHTML, calendar: calendarHTML, tasks: tasksHTML, settings: settingsHTML };
  // Keep the search box (and its keyboard) alive while typing: only the list re-renders
  if (state.tab === 'chats' && document.activeElement?.id === 'chat-search' && $('#chat-list')) {
    $('#chat-list').innerHTML = chatRowsHTML();
  } else {
    $('#view').innerHTML = views[state.tab]();
  }
  document.querySelectorAll('#tabs button').forEach((b) => {
    if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#today-badge').textContent = needsYouCount() || '';
}

function onError(err) {
  console.error(err);
  showToast('Something went wrong. Close the app and open it again.');
}

// ------------------------------------------------------------------ clicks
let suppressClickUntil = 0;   // set after a swipe or long-press so the release doesn't count as a tap

document.addEventListener('click', async (e) => {
  if (Date.now() < suppressClickUntil) return;
  if (e.target.closest('[data-toast-undo]')) {
    const t = toast; finishToast(t, false); t && t.undo && t.undo();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const { action, id } = el.dataset;
  try {
    switch (action) {
      case 'tab': state.tab = el.dataset.tab; window.scrollTo(0, 0); render(); break;
      case 'mode': state.mode = el.dataset.mode; prefs.mode = state.mode; savePrefs(); render(); break;
      case 'toggle-reading': state.readingOpen = !state.readingOpen; render(); break;
      case 'dismiss-tip': prefs.tipDismissed = true; savePrefs(); render(); break;
      case 'open': startSession(id); break;
      case 'start': case 'restart': startSession(null); break;
      case 'open-chat': await openChat(id); break;
      case 'close-overlay': closeOverlay(); break;
      case 'nav-next': navigate(1); break;
      case 'nav-prev': navigate(-1); break;
      case 'clear': clearItem(id); break;
      case 'later-pick': closeSheet(); snooze(id, el.dataset.until, el.dataset.label); break;
      case 'close-sheet': closeSheet(); break;
      case 'menu-clear': closeSheet(); clearItem(id); break;
      case 'menu-open': closeSheet(); await openChat(id); break;
      case 'set-cal': ui(id).cal = el.dataset.cal; refresh(); break;
      case 'add-event': closeSheet(); await addEvent(id, el.dataset.slot); break;
      case 'add-task': closeSheet(); await addTask(id); break;
      case 'quick-add': await quickAdd(id, el.dataset.kind); break;
      case 'toggle-earlier': ui(id).showEarlier = !ui(id).showEarlier; renderFocus(); break;
      case 'show-all': ui(id).showAll = true; renderFocus(); break;
      case 'invite': closeSheet(); await respondInvite(id, el.dataset.response); break;
      case 'use-reply': ui(id).draft = el.dataset.text; renderFocus(); break;
      case 'send': sendReply(id, $(`#compose-${id}`).value); break;
      case 'react': react(id, el.dataset.emoji); break;
      case 'block': {
        const restore = removeFromToday(id, 'other');
        showToast('Blocked', { commit: () => api.post(`/api/conversations/${id}/block`).then(loadChats).catch(onError), undo: restore });
        break;
      }
      case 'allow': {
        await api.post(`/api/conversations/${id}/allow`);
        const it = findItem(id); it.suggestion.lane = 'needs_you'; it.conversation.tier = 'normal';
        refresh(); showToast('Allowed. Their messages now go to Needs you.');
        break;
      }
      case 'mute': {
        const r = await api.post(`/api/conversations/${id}/mute`);
        state.convs[id].muted = r.muted;
        await Promise.all([loadToday(), loadChats()]);
        refresh(); showToast(r.muted ? 'Muted. It stays in Chats but leaves Today.' : 'Unmuted');
        break;
      }
      case 'compose': openComposeSheet(); break;
      case 'compose-to': {
        let convId = el.dataset.conv;
        if (!convId) convId = (await api.post('/api/conversations/new', { contact: el.dataset.contact })).id;
        closeSheet();
        await openChat(convId);
        $(`#compose-${convId}`)?.focus();
        break;
      }
      case 'cal-view': state.calView = el.dataset.view; render(); break;
      case 'cal-day': state.calDay = +el.dataset.day; render(); break;
      case 'event-info': { const ev = state.agenda.find((x) => x.id === el.dataset.event); if (ev) openEventSheet(ev); break; }
      case 'toggle-task': await api.post(`/api/tasks/${el.dataset.tid}/toggle`); await reloadTasks(); render(); break;
      case 'toggle-ai': prefs.ai = !prefs.ai; savePrefs(); render(); break;
      case 'toggle-automode': prefs.autoMode = !prefs.autoMode; savePrefs(); state.mode = startingMode(); render(); break;
      case 'theme': prefs.theme = el.dataset.theme; savePrefs(); applyTheme(); render(); break;
      case 'undo-secs': prefs.undoSeconds = +el.dataset.secs; savePrefs(); render(); break;
      case 'reset': await api.post('/api/reset'); state.ui = {}; state.convs = {}; await load(); showToast('Demo data reset'); break;
    }
  } catch (err) { onError(err); }
});

// Typing: drafts survive re-renders and the box grows; Chats and New message search as you type.
let searchTimer = null;
document.addEventListener('input', (e) => {
  const ta = e.target.closest?.('textarea[id^="compose-"]');
  if (ta) {
    ui(ta.dataset.id).draft = ta.value;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    return;
  }
  if (e.target.id === 'chat-search') {
    state.chatQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { await loadChats(); render(); }, 120);
  }
  if (e.target.id === 'compose-search') {
    const v = e.target.value;
    openComposeSheet(v);
    const box = $('#compose-search'); box.focus(); box.setSelectionRange(v.length, v.length);
  }
});

// Enter sends from the reply box; Shift+Enter adds a line.
document.addEventListener('keydown', (e) => {
  const ta = e.target.closest?.('textarea[id^="compose-"]');
  if (ta && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(ta.dataset.id, ta.value); }
});

// ------------------------------------------------------------------ swipe and long-press on Today rows [7][F2][F5]
// Left = Clear, right = Later. Judged on release by where the finger would land at its current speed,
// so a quick short flick counts and a long drag pulled back cancels. Hold a row for a menu.
let drag = null;
const EDGE_GUARD = 24;        // px from the left edge left alone for the iOS back gesture
const LONG_PRESS_MS = 500;
const PROJECT_MS = 180;       // how far ahead to project the finger's speed (starting value)

function sample(d, x) {
  const t = performance.now();
  if (d.lastT !== undefined && t > d.lastT) d.v = (x - d.lastX) / (t - d.lastT);
  d.lastX = x; d.lastT = t;
}
const projected = (d) => d.dx + (d.v || 0) * PROJECT_MS;

document.addEventListener('pointerdown', (e) => {
  const wrap = e.target.closest('#view .swipe');
  if (!wrap || e.clientX < EDGE_GUARD) return;
  drag = { wrap, row: $('.row-inner', wrap), x: e.clientX, y: e.clientY, dx: 0, active: false };
  sample(drag, e.clientX);
  const d = drag;
  d.timer = setTimeout(() => {                    // press and hold: Clear, open, and Later times
    if (drag !== d || d.active) return;
    drag = null;
    suppressClickUntil = Date.now() + 600;
    openRowMenu(wrap.dataset.id);
  }, LONG_PRESS_MS);
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(drag.timer);
  if (!drag.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // vertical scroll wins
    if (Math.abs(dx) < 10) return;
    drag.active = true;
    drag.row.classList.add('dragging');
  }
  drag.dx = dx;
  sample(drag, e.clientX);
  drag.row.style.transform = `translateX(${dx}px)`;
  drag.wrap.classList.toggle('to-done', dx < 0);
  drag.wrap.classList.toggle('to-later', dx > 0);
});

function endDrag() {
  if (!drag) return;
  clearTimeout(drag.timer);
  const d = drag, { wrap, row, dx, active } = d;
  drag = null;
  if (!active) return;
  suppressClickUntil = Date.now() + 300;
  row.classList.remove('dragging');
  const p = projected(d);
  const commit = Math.sign(p) === Math.sign(dx) && Math.abs(p) > Math.min(110, wrap.offsetWidth * 0.35);
  if (!commit) {
    row.style.transform = '';
    setTimeout(() => wrap.classList.remove('to-done', 'to-later'), 200);
    return;
  }
  prefs.swiped = true; savePrefs();
  if (dx < 0) {
    row.style.transform = 'translateX(-105%)';
    setTimeout(() => clearItem(wrap.dataset.id), 180);
  } else {
    row.style.transform = '';
    setTimeout(() => wrap.classList.remove('to-later'), 200);
    openLaterSheet(wrap.dataset.id);
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
document.addEventListener('contextmenu', (e) => {   // right-click on a computer = press and hold
  const wrap = e.target.closest('#view .swipe');
  if (!wrap) return;
  e.preventDefault();
  openRowMenu(wrap.dataset.id);
});

/** First open only: the top row slides partway left to show Clear, then springs back [F5]. */
function peekSwipe() {
  if (prefs.peeked || state.tab !== 'today' || reduceMotion()) return;
  const wrap = $('#view .swipe'), row = wrap && $('.row-inner', wrap);
  if (!row) return;
  prefs.peeked = true; savePrefs();
  wrap.classList.add('to-done');
  row.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-84px)', offset: 0.35 },
    { transform: 'translateX(-84px)', offset: 0.65 },
    { transform: 'translateX(0)' },
  ], { duration: 1200, easing: 'ease-in-out' }).onfinish = () => wrap.classList.remove('to-done');
}

// ------------------------------------------------------------------ hold a suggestion for its options
let hold = null;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('#focus [data-hold]');
  if (!el) return;
  hold = { el, x: e.clientX, y: e.clientY,
    timer: setTimeout(() => { hold = null; suppressClickUntil = Date.now() + 600; openDetails(el.dataset.id, el.dataset.kind); }, LONG_PRESS_MS) };
});
document.addEventListener('pointermove', (e) => {
  if (hold && (Math.abs(e.clientX - hold.x) > 8 || Math.abs(e.clientY - hold.y) > 8)) { clearTimeout(hold.timer); hold = null; }
});
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { if (hold) { clearTimeout(hold.timer); hold = null; } }));
document.addEventListener('contextmenu', (e) => {   // right-click on a computer = hold
  const el = e.target.closest('#focus [data-hold]');
  if (!el) return;
  e.preventDefault();
  openDetails(el.dataset.id, el.dataset.kind);
});

// ------------------------------------------------------------------ session swipe: left = next, right = previous [7][F2]
let pageDrag = null;
document.addEventListener('pointerdown', (e) => {
  const scroller = e.target.closest('#focus .focus-scroll');
  if (!scroller || state.viewer?.from !== 'session' || e.target.closest('textarea') || e.clientX < EDGE_GUARD) return;
  pageDrag = { body: $('.focus-body', scroller), x: e.clientX, y: e.clientY, dx: 0, active: false };
  sample(pageDrag, e.clientX);
});
document.addEventListener('pointermove', (e) => {
  if (!pageDrag) return;
  const dx = e.clientX - pageDrag.x, dy = e.clientY - pageDrag.y;
  if (!pageDrag.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { pageDrag = null; return; }
    if (Math.abs(dx) < 10) return;
    pageDrag.active = true;
  }
  pageDrag.dx = dx;
  sample(pageDrag, e.clientX);
  const edge = !canGo(dx < 0 ? 1 : -1);           // resist when there is nothing that way
  pageDrag.body.style.transform = `translateX(${edge ? dx * 0.25 : dx}px)`;
});
function endPageDrag() {
  if (!pageDrag) return;
  const d = pageDrag, { body, dx, active } = d;
  pageDrag = null;
  if (!active) return;
  suppressClickUntil = Date.now() + 300;
  body.style.transform = '';
  const p = projected(d);
  if (Math.sign(p) === Math.sign(dx) && Math.abs(p) > 80) navigate(dx < 0 ? 1 : -1);
}
document.addEventListener('pointerup', endPageDrag);
document.addEventListener('pointercancel', endPageDrag);

// ------------------------------------------------------------------ start
// Deep links: /#chats, /#calendar, /#tasks, /#settings open that tab; /#focus starts a session.
function applyHash() {
  const h = location.hash.slice(1);
  if (['today', 'chats', 'calendar', 'tasks', 'settings'].includes(h)) { state.tab = h; render(); }
  if (h === 'focus' && state.loaded) startSession(null);
}
window.addEventListener('hashchange', applyHash);
render();
load().then(() => { applyHash(); setTimeout(peekSwipe, 700); }).catch(onError);
setInterval(() => {                               // keep "12m" fresh, but never mid-typing or mid-undo
  if (!toast && !state.viewer && !['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName)) render();
}, 60000);
