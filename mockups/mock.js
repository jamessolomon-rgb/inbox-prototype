/* Mock-ups of three item-view designs (22 Oct 2026). Static, clickable, made-up data.
 *
 *   A  Brief first, history folded away
 *   B  Pure chat, actions underlined in the message
 *   C  Conversation behind, action panel on top (drag the panel up and down)
 *
 * Each page sets <body data-design="a|b|c">. The same three examples run through every design so
 * they can be compared like for like. Nothing is sent anywhere.
 */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DESIGN = document.body.dataset.design;

  // ---------------------------------------------------------------- the three examples
  const EX = [
    {
      name: 'Company Secretary', initials: 'CS', colour: '#B25000', channel: 'Work mail', glyph: 'mail', badge: '#5E5CE6', kind: 'email',
      reason: 'VIP · Asks about tomorrow 2pm', when: '35m', subject: 'Board pack: final review',
      history: [
        { from: 'me', name: 'You', text: 'Can you circulate the board pack draft once all comments are in?', time: 'Tue 5:20pm' },
        { from: 'them', name: 'Company Secretary', text: 'Will do. Two sections still with the auditors.', time: 'Tue 5:55pm' },
        { from: 'me', name: 'You', text: 'Thanks', time: 'Tue 6:03pm' },
      ],
      latest: [
        { from: 'them', name: 'Company Secretary', time: '8:06am',
          text: 'Hi, the board pack is ready to circulate. Could we do 30 minutes tomorrow at 2pm to walk through the final version before it goes out?' },
      ],
      summary: null,
      actions: [
        { type: 'event', title: 'Board pack walk-through', short: 'Tomorrow 2pm', when: 'Tomorrow, 2:00 – 2:30pm', calendar: 'Work',
          phrase: '30 minutes tomorrow at 2pm', clash: 'Investor call', alt: '3:00pm' },
      ],
      replies: ["2pm works. I'll send an invite.", "I'm on an investor call at 2. Can we do 3pm?", "Can you send the final draft first? I'll review tonight."],
      reactions: false,
    },
    {
      name: 'Sam', initials: 'S', colour: '#6D4C41', channel: 'iMessage', glyph: 'imessage', badge: '#0A84FF', kind: 'chat',
      reason: 'VIP · Today', when: '12m',
      history: [
        { from: 'them', name: 'Sam', text: 'Running late, can you do pickup?', time: 'Yesterday 3:02pm' },
        { from: 'me', name: 'You', text: 'Yep, on it', time: 'Yesterday 3:04pm' },
      ],
      latest: [
        { from: 'them', name: 'Sam', time: '8:30am', text: 'Can you grab milk and bread on the way home?' },
        { from: 'them', name: 'Sam', time: '8:32am', text: 'Also Mum wants us for dinner Sunday 6pm' },
      ],
      summary: null,
      actions: [
        { type: 'task', title: 'Milk and bread on the way home', short: 'Today 6pm', when: 'Due today, 6:00pm', phrase: 'grab milk and bread on the way home' },
        { type: 'event', title: "Dinner at Mum's", short: 'Sunday 6pm', when: 'Sunday, 6:00 – 8:30pm', calendar: 'Family',
          phrase: 'dinner Sunday 6pm', duplicate: 'Already in the Family calendar, added by Sam' },
      ],
      replies: ['Will do. Sunday works 👍', 'Will do. Can we make Sunday 6:30?', "Will do. Not sure about Sunday, I'll confirm tonight."],
      reactions: true,
    },
    {
      name: 'Family', initials: '', group: 6, colour: '#636366', channel: 'WhatsApp', glyph: 'whatsapp', badge: '#25D366', kind: 'group',
      reason: 'Family · Asked you by the 30th', when: '1h',
      history: [
        { from: 'them', name: 'Dad', text: 'Photos from the weekend are in the shared album', time: 'Tue 8:05pm' },
        { from: 'me', name: 'You', text: 'Great ones, thanks', time: 'Tue 8:30pm' },
      ],
      latest: [
        { from: 'them', name: 'Mum', time: '6:11am', text: "Who's hosting Christmas this year? Need numbers by the end of the month 🎄" },
        { from: 'them', name: 'Dad', time: '6:21am', text: 'We did it last year 😄' },
        { from: 'them', name: 'Aunt Jo', time: '7:06am', text: 'Happy to bring dessert wherever it is' },
        { from: 'them', name: 'Mum', time: '7:41am', text: 'Let me know by the 30th please' },
      ],
      summary: 'Mum asks who hosts Christmas; numbers by the 30th. Dad says they hosted last year. Aunt Jo will bring dessert.',
      actions: [],
      replies: ['We can host this year.', "Not sure yet, I'll confirm by the weekend.", 'Can we talk about it at dinner on Sunday?'],
      reactions: true,
    },
  ];

  const GLYPH = {
    imessage: '<path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6L4.5 21l4.2-2.2c1 .3 2.1.4 3.3.4 5.5 0 10-3.6 10-8S17.5 3 12 3z"/>',
    whatsapp: '<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/>',
    mail: '<path d="M2 6.6V18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6.6l-10 6.5zM2.6 5L12 11.1 21.4 5z"/>',
  };
  const PEOPLE = '<svg class="people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5zM16.5 13.6c3 .2 5.5 2.4 5.5 5.9V20h-4.5c0-2.6-.4-4.6-1-5.9z"/></svg>';
  const ICON = {
    event: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    task: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  };
  const NAME_COLOURS = { Mum: '#B25000', Dad: '#0071E3', 'Aunt Jo': '#00796B' };

  // ---------------------------------------------------------------- per-item state
  let i = 0;
  const st = EX.map((e) => ({ draft: e.replies[0], added: {}, showEarlier: false, showAll: false, panelUp: true, done: false }));

  const avatar = (e, size = '') => `<span class="avatar ${size}" style="background:${e.colour}" aria-hidden="true">${e.group ? PEOPLE : esc(e.initials)}
      <span class="badge" style="background:${e.badge}"><svg viewBox="0 0 24 24">${GLYPH[e.glyph]}</svg></span></span>`;

  /** Message text with the phrases behind suggestions marked. mode: 'hl' = highlight (A, C), 'link' = tappable underline (B). */
  function markup(e, text, mode) {
    let out = esc(text);
    e.actions.forEach((a, k) => {
      const p = esc(a.phrase);
      if (!out.includes(p)) return;
      out = mode === 'link'
        ? out.replace(p, `<span class="detect" role="button" tabindex="0" data-act="detail" data-k="${k}">${p}</span>`)
        : out.replace(p, `<mark class="hl">${p}</mark>`);
    });
    return out;
  }

  function messagesHTML(e, list, mode) {
    return list.map((m, k) => {
      const mine = m.from === 'me';
      if (e.kind === 'email') {
        return `<div class="mail ${mine ? 'mine' : ''}"><div class="mail-head"><b>${esc(mine ? 'You' : m.name)}</b><span>${esc(m.time)}</span></div>
          <div class="mail-text">${mine ? esc(m.text) : markup(e, m.text, mode)}</div></div>`;
      }
      const showName = e.kind === 'group' && !mine && (k === 0 || list[k - 1].name !== m.name);
      return `<div class="msg ${mine ? 'out' : 'in'} end">
        ${showName ? `<div class="msg-name" style="--n:${NAME_COLOURS[m.name] || '#5E5CE6'}">${esc(m.name)}</div>` : ''}
        <div class="bubble ${mine ? 'bubble-me' : 'bubble-them'}">${mine ? esc(m.text) : markup(e, m.text, mode)}</div>
        <div class="msg-time">${esc(m.time)}</div></div>`;
    }).join('');
  }

  /** One-line suggestion rows (A and C). Tap the row for details; Add uses the defaults unless there's a clash. */
  function suggestionRows(e) {
    const s = st[i];
    if (!e.actions.length) return '';
    return `<div class="sugg">${e.actions.map((a, k) => {
      const status = s.added[k] ? `<span class="ok">✓ ${a.type === 'task' ? 'Added to Tasks' : `Added to ${a.calendar}`}</span>`
        : a.duplicate ? '<span class="ok">✓ In Family calendar</span>'
        : a.clash ? `<span class="warn">⚠ Clashes with ${esc(a.clash)}</span>` : '';
      const btn = s.added[k] || a.duplicate ? '' : `<button class="btn tinted sm" data-act="add" data-k="${k}">Add</button>`;
      return `<div class="sugg-row">
        <button class="sugg-main" data-act="detail" data-k="${k}">
          <span class="ic">${ICON[a.type]}</span>
          <span class="sugg-text"><b>${esc(a.title)}</b><span>${esc(a.short)}${status ? ' · ' : ''}${status}</span></span>
        </button>${btn}</div>`;
    }).join('')}</div>`;
  }

  function composer(e, { chipsAbove = false } = {}) {
    const s = st[i];
    const reacts = e.reactions ? ['👍', '❤️', '😂', '🙏'].map((r) => `<button class="chip react" data-act="react" data-r="${r}">${r}</button>`).join('') : '';
    const alts = e.replies.filter((r) => r !== s.draft).map((r) => `<button class="chip alt" data-act="use" data-t="${esc(r)}">${esc(r)}</button>`).join('');
    const chips = `<div class="chip-row">${reacts}${alts}</div>`;
    const drafted = e.replies.includes(s.draft);
    return `<div class="composer">
      <div class="to-line">${drafted ? '<span class="ai-glyph">✦</span>Suggested reply · ' : ''}To <b>${esc(e.name)}</b> · ${esc(e.channel)}${e.group ? ` · <span class="flag">group of ${e.group}</span>` : ''}</div>
      ${chipsAbove ? chips : ''}
      <div class="compose"><textarea id="draft" rows="${Math.min(3, Math.ceil(s.draft.length / 34)) || 1}" aria-label="Reply">${esc(s.draft)}</textarea>
        <button class="send-btn" data-act="send" aria-label="Send">${ICON.send}</button></div>
      ${chipsAbove ? '' : chips}
    </div>`;
  }

  const clearBar = () => `<div class="focus-actions"><button class="btn filled" data-act="clear">Clear</button></div>`;

  function topBar(e) {
    return `<div class="focus-top">
      <a class="close" href="index.html">‹ Designs</a>
      <div class="progress-label"><span class="who-top">${esc(e.name)}</span><small>${i + 1} of ${EX.length} · Design ${DESIGN.toUpperCase()}</small></div>
      <div class="nav"><button data-act="prev" aria-label="Previous" ${i ? '' : 'disabled'}>${ICON.back}</button>
        <button data-act="next" aria-label="Next" ${i < EX.length - 1 ? '' : 'disabled'}>${ICON.fwd}</button></div></div>`;
  }

  const whoRow = (e) => `<div class="who">${avatar(e, 'lg')}<div><div class="name">${esc(e.name)}</div>
      <div class="footnote muted">${esc(e.channel)}${e.group ? ` · ${e.group} people` : ''} · ${esc(e.when)}</div>
      <div class="reason ${e.reason.startsWith('VIP') ? 'vip' : ''}">${esc(e.reason)}</div></div></div>`;

  // ---------------------------------------------------------------- A: brief first, history folded away
  function designA(e) {
    const s = st[i];
    const earlier = `<button class="fold" data-act="earlier">${s.showEarlier ? 'Hide' : 'Earlier in this conversation'} (${e.history.length}) <span class="${s.showEarlier ? 'up' : ''}">${ICON.chev}</span></button>
      ${s.showEarlier ? `<div class="thread earlier">${messagesHTML(e, e.history, 'hl')}</div>` : ''}`;
    let body;
    if (e.summary && !s.showAll) {
      body = `<div class="summary"><div class="caption"><span class="ai-glyph">✦</span>Summary of ${e.latest.length} new</div><p class="ai">${esc(e.summary)}</p>
        <button class="link" data-act="all">Show all ${e.latest.length} messages</button></div>`;
    } else {
      body = `<div class="thread">${e.subject ? `<div class="subject-line">${esc(e.subject)}</div>` : ''}${messagesHTML(e, e.latest, 'hl')}</div>`;
    }
    return `${topBar(e)}<div class="focus-scroll"><div class="focus-body">${whoRow(e)}${earlier}${body}${suggestionRows(e)}</div></div>${composer(e)}${clearBar()}`;
  }

  // ---------------------------------------------------------------- B: pure chat, actions in the message
  function designB(e) {
    const s = st[i];
    const thread = `<div class="thread">${messagesHTML(e, e.history, 'link')}
      <div class="new-divider"><span>${e.latest.length > 1 ? `${e.latest.length} new` : 'New'}</span></div>
      ${e.summary ? `<div class="summary-line"><span class="ai-glyph">✦</span><span class="ai">${esc(e.summary)}</span></div>` : ''}
      ${messagesHTML(e, e.latest, 'link')}</div>`;
    const open = e.actions.filter((a, k) => !s.added[k] && !a.duplicate);
    let bar = '';
    if (e.actions.length === 1) {
      const a = e.actions[0];
      bar = s.added[0] ? `<div class="slim"><span class="ic">${ICON[a.type]}</span><span class="grow ok">✓ Added: ${esc(a.title)}</span></div>`
        : `<div class="slim"><span class="ic">${ICON[a.type]}</span><span class="grow"><b>${esc(a.short)}</b>${a.clash ? ' · <span class="warn">clash</span>' : ''}</span>
          <button class="btn tinted sm" data-act="detail" data-k="0">Add ▸</button></div>`;
    } else if (e.actions.length > 1) {
      const dups = e.actions.filter((a) => a.duplicate).length;
      const what = open.map((a) => (a.type === 'task' ? 'a task' : 'an event')).join(' and ');
      bar = `<div class="slim"><span class="ic">✦</span><span class="grow"><b>${open.length ? `Add ${what}` : 'All handled'}</b>${dups ? ` · ${dups} already in calendar` : ''}</span>
        <button class="btn tinted sm" data-act="list">View ▸</button></div>`;
    }
    return `${topBar(e)}<div class="focus-scroll"><div class="focus-body">${whoRow(e)}${e.subject ? `<div class="subject-line">${esc(e.subject)}</div>` : ''}${thread}
        <p class="foot hint">Underlined words can be added to your calendar or tasks. Tap them.</p></div></div>
      <div class="composer-wrap">${bar}${composer(e, { chipsAbove: true })}</div>${clearBar()}`;
  }

  // ---------------------------------------------------------------- C: conversation behind, action panel on top
  function designC(e) {
    const s = st[i];
    const thread = `<div class="thread">${messagesHTML(e, e.history, 'hl')}
      <div class="new-divider"><span>${e.latest.length > 1 ? `${e.latest.length} new` : 'New'}</span></div>${messagesHTML(e, e.latest, 'hl')}</div>`;
    const panel = `<div class="panel ${s.panelUp ? 'up' : 'down'}" id="panel">
        <button class="panel-handle" data-act="panel" aria-label="${s.panelUp ? 'Lower the panel to read' : 'Raise the panel'}"><i></i></button>
        <div class="panel-body">
          <div class="panel-head"><span class="ai-glyph">✦</span><span class="ai">${esc(e.summary || summaryLine(e))}</span></div>
          ${suggestionRows(e)}
        </div>
        ${composer(e)}${clearBar()}
      </div>`;
    return `${topBar(e)}<div class="focus-scroll c-scroll"><div class="focus-body">${whoRow(e)}${e.subject ? `<div class="subject-line">${esc(e.subject)}</div>` : ''}${thread}</div></div>${panel}`;
  }
  const summaryLine = (e) => ({ 'Company Secretary': 'Wants 30 minutes tomorrow at 2pm on the board pack before it goes out.',
    Sam: "Milk and bread on the way home. Dinner at Mum's Sunday 6pm." })[e.name] || '';

  // ---------------------------------------------------------------- render, sheet, toast
  function render(dir = 0) {
    const e = EX[i];
    const focus = $('#focus');
    focus.innerHTML = { a: designA, b: designB, c: designC }[DESIGN](e);
    const sc = $('.focus-scroll', focus);
    if (DESIGN !== 'a') sc.scrollTop = sc.scrollHeight;   // chat-style designs open at the newest message
    if (dir) $('.focus-body', focus).animate([{ transform: `translateX(${dir * 40}%)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function sheet(html) { $('.sheet').innerHTML = `<div class="grabber"></div>${html}`; $('#sheet-wrap').classList.add('open'); }
  const closeSheet = () => $('#sheet-wrap').classList.remove('open');
  let toastTimer;
  function toast(text) {
    const t = $('#toast');
    t.innerHTML = `<div class="t-row"><span class="t-text">${esc(text)}</span></div>`;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function detailSheet(k) {
    const a = EX[i].actions[k];
    if (a.type === 'task') {
      sheet(`<h3>${esc(a.title)}</h3><p class="muted subhead">${esc(a.when)}</p>
        <p class="subhead" style="margin:0 4px 12px">From: <mark class="hl">${esc(a.phrase)}</mark></p>
        <div class="stack"><button class="btn filled wide" data-act="add" data-k="${k}" data-force="1">Add to Tasks</button>
        <button class="btn plain wide" data-act="close-sheet">Cancel</button></div>`);
      return;
    }
    const dup = a.duplicate ? `<p class="ok" style="margin:0 4px 12px">✓ ${esc(a.duplicate)}</p>` : '';
    const choices = a.duplicate ? '' : a.clash
      ? `<button class="btn tinted wide choice" data-act="add" data-k="${k}" data-force="1"><span>Add at ${esc(a.alt)}</span><small>Free</small></button>
         <button class="btn plain wide choice" data-act="add" data-k="${k}" data-force="1"><span>Add at 2:00pm as asked</span><small class="warn">Clashes with ${esc(a.clash)}</small></button>`
      : `<button class="btn filled wide" data-act="add" data-k="${k}" data-force="1">Add to ${esc(a.calendar)} calendar</button>`;
    sheet(`<h3>${esc(a.title)}</h3><p class="muted subhead">${esc(a.when)}</p>
      <p class="subhead" style="margin:0 4px 12px">From: <mark class="hl">${esc(a.phrase)}</mark></p>
      ${dup}${a.duplicate ? '' : `<div class="segmented" style="margin-bottom:10px"><button aria-pressed="${a.calendar === 'Work'}">Work</button><button aria-pressed="${a.calendar === 'Family'}">Family</button></div>`}
      <div class="stack">${choices}<button class="btn plain wide" data-act="close-sheet">${a.duplicate ? 'Close' : 'Cancel'}</button></div>`);
  }

  function listSheet() {
    const e = EX[i];
    sheet(`<h3>Suggestions</h3><p class="muted subhead">From ${esc(e.name)}'s messages</p>${suggestionRows(e)}
      <button class="btn plain wide" data-act="close-sheet" style="margin-top:8px">Done</button>`);
  }

  function next(dir) {
    const j = i + dir;
    if (j < 0 || j >= EX.length) return;
    i = j; render(dir);
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const s = st[i], e = EX[i], k = +el.dataset.k;
    switch (el.dataset.act) {
      case 'prev': next(-1); break;
      case 'next': next(1); break;
      case 'earlier': s.showEarlier = !s.showEarlier; render(); break;
      case 'all': s.showAll = true; render(); break;
      case 'detail': detailSheet(k); break;
      case 'list': listSheet(); break;
      case 'add': {
        const a = e.actions[k];
        if (a.clash && !el.dataset.force) { detailSheet(k); break; }   // a clash needs a choice
        const fromList = $('#sheet-wrap.open h3')?.textContent === 'Suggestions';
        s.added[k] = true; render();
        if (fromList) listSheet(); else closeSheet();
        toast(a.type === 'task' ? 'Added to Tasks' : `Added to ${a.calendar} calendar`);
        break;
      }
      case 'use': s.draft = el.dataset.t; render(); break;
      case 'react': toast(`${el.dataset.r} to ${e.name}`); setTimeout(() => next(1), 500); break;
      case 'send': toast(`Sending to ${e.name} · ${e.channel}`); setTimeout(() => next(1), 500); break;
      case 'clear': toast('Cleared'); setTimeout(() => next(1), 300); break;
      case 'panel': s.panelUp = !s.panelUp; render(); break;
      case 'close-sheet': closeSheet(); break;
    }
  });
  document.addEventListener('input', (ev) => { if (ev.target.id === 'draft') st[i].draft = ev.target.value; });

  // Swipe between the examples, as in the real Start view; in C, drag the panel up or down.
  let drag = null;
  document.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('textarea, .sheet')) return;
    drag = { x: ev.clientX, y: ev.clientY, panel: !!ev.target.closest('.panel-handle, .panel-head') };
  });
  document.addEventListener('pointerup', (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (drag.panel && Math.abs(dy) > 30) { st[i].panelUp = dy < 0; render(); }
    else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) next(dx < 0 ? 1 : -1);
    drag = null;
  });

  render();
})();
