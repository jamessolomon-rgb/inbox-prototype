/* Hosted demo: an in-browser stand-in for the Python server.
 *
 * app.js sends every request to DEMO_API.handle() when this file is loaded,
 * so the published prototype needs no server. It mirrors app/main.py,
 * app/scheduling.py and app/sample_data.py, with placeholder names in place
 * of anything real. State lives in memory and resets on reload.
 */
(function () {
  window.ORG_NAME = 'Acme';

  const COLOURS = {
    imessage: '#0A84FF', whatsapp: '#25D366', gmail_work: '#5E5CE6', gmail_personal: '#FF9F0A',
    work: '#5E5CE6', family: '#FF375F',
  };

  // ---------------------------------------------------------------- date helpers
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---------------------------------------------------------------- sample data (mirrors sample_data.py)
  function build(now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const at = (days, h = 0, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, h, m);
    const pyWeekday = (today.getDay() + 6) % 7;                         // Mon = 0, as in Python
    const nextWd = (wd) => (((wd - pyWeekday) % 7) + 7) % 7 || 7;      // always 1-7 days ahead
    const ago = (mins) => new Date(now.getTime() - mins * 60000);
    const dayName = (o) => WEEKDAYS[at(o).getDay()];
    const longDate = (o) => { const d = at(o); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
    const dM = (o) => { const d = at(o); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
    const dMon = (o) => { const d = at(o); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
    const aDMon = (o) => { const d = at(o); return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${dMon(o)}`; };

    const [mon, tue, wed, fri, sat, sun] = [0, 1, 2, 4, 5, 6].map(nextWd);
    const thuFortnight = nextWd(3) + 7;

    const ev = (id, calendar, title, start, end, location = null) => ({ id, calendar, title, start, end, location });
    const events = [
      ev('w1', 'work', 'Leadership team weekly', at(0, 8, 30), at(0, 9, 30), 'Level 3 boardroom'),
      ev('w2', 'work', '1:1 Head of Sales', at(0, 11), at(0, 11, 30)),
      ev('w3', 'work', 'Budget review', at(0, 15), at(0, 16)),
      ev('w4', 'work', 'Month-end close check-in', at(1, 9), at(1, 10)),
      ev('w5', 'work', 'Investor call', at(1, 14), at(1, 15), 'Teams'),
      ev('w6', 'work', 'Board meeting', at(mon, 10), at(mon, 13), 'Level 3 boardroom'),
      ev('w7', 'work', 'Treasury catch-up', at(tue, 9, 30), at(tue, 10)),
      ev('f1', 'family', "Kids' soccer", at(sat, 8), at(sat, 9, 30), 'Local oval'),
      ev('f2', 'family', 'Parent-teacher night', at(wed, 18), at(wed, 19)),
      ev('f3', 'family', 'School pickup', at(0, 15, 15), at(0, 15, 45)),
    ];

    const messages = [], suggestions = {};
    const add = (m, s) => {
      messages.push({ subject: null, thread: null, address: null, group_size: 0, external: false, ...m });
      suggestions[m.id] = { lane: 'needs_you', replies: [], event: null, task: null, priority: 2, warning: null, ...s };
    };
    const pe = (title, start, end, calendar, location, why) => ({ title, start, end, calendar, location: location || null, why });
    const pt = (title, due, why) => ({ title, due, why });

    // Needs you
    add({ id: 'm8', channel: 'imessage', sender: 'Sam', received_at: ago(12), address: '+61 4xx xxx 201',
          body: 'Can you grab milk and bread on the way home? Also Mum wants us for dinner Sunday 6pm' },
        { category: 'reply', priority: 1, summary: "Milk and bread on the way home. Dinner at Mum's Sunday 6pm.",
          replies: ['Will do. Sunday works 👍', 'Will do. Can we make Sunday 6:30?', "Will do. Not sure about Sunday, I'll confirm tonight."],
          event: pe("Dinner at Mum's", at(sun, 18), at(sun, 20, 30), 'family', null, 'Sam wrote “Mum wants us for dinner Sunday 6pm”'),
          task: pt('Milk and bread on the way home', at(0, 18), 'Sam wrote “Can you grab milk and bread on the way home?”') });
    add({ id: 'm13', channel: 'whatsapp', sender: 'Dave (builder)', received_at: ago(25), address: '+61 4xx xxx 552',
          body: `Can come ${dayName(fri)} 10am to quote the deck, does that work?` },
        { category: 'schedule', priority: 1, summary: `Can quote the deck ${dayName(fri)} 10am.`,
          replies: [`${dayName(fri)} 10am works, see you then.`, 'Can you do 8am instead?', `Can't do ${dayName(fri)}. Early next week?`],
          event: pe('Builder quote: deck', at(fri, 10), at(fri, 10, 45), 'family', 'Home', `Dave wrote “Can come ${dayName(fri)} 10am to quote the deck”`) });
    add({ id: 'm1', channel: 'gmail_work', sender: 'Company Secretary', received_at: ago(35), subject: 'Board pack: final review',
          address: 'cosec@acme.example',
          body: 'Hi, the board pack is ready to circulate. Could we do 30 minutes tomorrow at 2pm to walk through the final version before it goes out?' },
        { category: 'schedule', priority: 1, summary: 'Wants 30 minutes tomorrow at 2pm on the board pack before it goes out.',
          replies: ["2pm works. I'll send an invite.", "I'm on an investor call at 2. Can we do 3pm?", "Can you send the final draft first? I'll review tonight."],
          event: pe('Board pack walk-through', at(1, 14), at(1, 14, 30), 'work', null, 'Company Secretary wrote “Could we do 30 minutes tomorrow at 2pm”') });
    add({ id: 'm2', channel: 'gmail_work', sender: 'Head of Sales', received_at: ago(80), subject: 'September commission file',
          address: 'sales.lead@acme.example',
          body: `September commission calcs are in the shared drive. I need your sign-off by ${dayName(fri)} so payroll can process on the 30th.` },
        { category: 'task', priority: 1, summary: `September commission file needs your sign-off by ${dayName(fri)} for payroll.`,
          replies: [`Thanks, I'll sign off by ${dayName(fri)}.`, 'Can you flag any reps over 120% of target first?', `${dayName(fri)} is tight. Can payroll take it Monday?`],
          task: pt('Sign off September commission file', at(fri, 17), `Head of Sales wrote “I need your sign-off by ${dayName(fri)}”`) });
    add({ id: 'm9', channel: 'imessage', sender: 'Tom', received_at: ago(55), address: '+61 4xx xxx 874',
          body: `Golf ${dayName(sat)} 7:30? We need a 4th` },
        { category: 'reply', summary: `Golf ${dayName(sat)} 7:30am. They need a fourth.`,
          replies: [`Can't this ${dayName(sat)}, kids' soccer. Next week?`, "I'm in. See you at 7:30.", 'Soccer finishes 9:30. Could I join for the back nine?'],
          event: pe('Golf with Tom', at(sat, 7, 30), at(sat, 12), 'family', 'Golf club', `Tom wrote “Golf ${dayName(sat)} 7:30”`) });
    add({ id: 'm12', channel: 'whatsapp', sender: 'Mum', received_at: ago(150), thread: 'Family', group_size: 6,
          body: "Who's hosting Christmas this year? Need numbers by the end of the month 🎄" },
        { category: 'reply', summary: 'Asking who hosts Christmas. Numbers needed by month end.',
          replies: ['We can host this year.', "Not sure yet, I'll confirm by the weekend.", 'Can we talk about it at dinner on Sunday?'] });
    add({ id: 'm6', channel: 'gmail_personal', sender: 'Smile Dental', received_at: ago(420), subject: 'Appointment reminder',
          address: 'reception@smiledental.example', body: `Your appointment is on ${longDate(tue)} at 4:15pm. Reply to confirm.` },
        { category: 'schedule', summary: `Dentist ${dayName(tue)} 4:15pm. They want a confirmation.`,
          replies: ['Confirmed, see you then.', 'I need to reschedule. Anything later that week?'],
          event: pe('Dentist', at(tue, 16, 15), at(tue, 17), 'family', 'Smile Dental', `Smile Dental wrote “Your appointment is on ${longDate(tue)} at 4:15pm”`) });

    // Updates
    add({ id: 'm11', channel: 'whatsapp', sender: 'Coach Mike', received_at: ago(70), thread: 'Under 10s Soccer Parents', group_size: 23,
          body: `Heads up: training moves to ${dayName(tue)} 5pm next week because of a field closure.` },
        { category: 'schedule', lane: 'updates', summary: `Soccer training moves to ${dayName(tue)} 5pm next week.`,
          event: pe('Soccer training (moved)', at(tue, 17), at(tue, 18), 'family', null, `Coach Mike wrote “training moves to ${dayName(tue)} 5pm next week”`) });
    add({ id: 'm5', channel: 'gmail_personal', sender: 'Hillview Primary School', received_at: ago(300),
          subject: 'Year 4 excursion: permission and payment', address: 'office@hillview.example',
          body: `Year 4 will visit the museum on ${longDate(wed)}. Please return the permission note and pay $35 through the parent portal by ${dayName(mon)}.` },
        { category: 'task', lane: 'updates', summary: `Year 4 excursion ${dayName(wed)}. Permission note and $35 due ${dayName(mon)}.`,
          task: pt('Sign excursion note and pay $35', at(mon, 9), `The school wrote “pay $35 through the parent portal by ${dayName(mon)}”`),
          event: pe('Year 4 excursion: museum', at(wed, 9), at(wed, 15), 'family', null, `The school wrote “Year 4 will visit the museum on ${longDate(wed)}”`) });
    add({ id: 'm3', channel: 'gmail_work', sender: 'Relationship Manager, Bank', received_at: ago(190), subject: 'Compliance certificate due',
          address: 'rm@bank.example', external: true,
          body: `A reminder that the quarterly compliance certificate is due ${dM(9)}. Please send the signed certificate with supporting calculations.` },
        { category: 'task', lane: 'updates', summary: `Quarterly covenant compliance certificate due ${dMon(9)}.`,
          replies: [`Received, thanks. You'll have it by ${dM(9)}.`],
          task: pt('Covenant compliance certificate to bank', at(9, 12), `The bank wrote “the quarterly compliance certificate is due ${dM(9)}”`) });
    add({ id: 'm7', channel: 'gmail_personal', sender: 'Airline', received_at: ago(900), subject: 'Booking confirmation: Sydney to Melbourne',
          address: 'no-reply@airline.example',
          body: `Booking confirmed. Sydney to Melbourne, ${longDate(thuFortnight)}, departs 7:00am, arrives 8:35am. Booking reference 8XK2PQ.` },
        { category: 'schedule', lane: 'updates', priority: 3, summary: `Flight Sydney to Melbourne ${aDMon(thuFortnight)}, 7:00am. Ref 8XK2PQ.`,
          event: pe('Flight SYD to MEL (ref 8XK2PQ)', at(thuFortnight, 7), at(thuFortnight, 8, 35), 'work', 'Sydney T3', 'The airline wrote “departs 7:00am, arrives 8:35am”') });

    // New senders and Reading
    add({ id: 'm10', channel: 'imessage', sender: '+61 4xx xxx 118', received_at: ago(140), address: '+61 4xx xxx 118',
          body: 'Your parcel is held due to an unpaid customs fee. Pay $2.99 at parcel-delivery-au.example' },
        { category: 'fyi', lane: 'new_senders', priority: 3, summary: 'Text claiming a held parcel and asking for a fee.',
          warning: "Likely scam. The link isn't the courier's real address, so don't open it." });
    add({ id: 'm4', channel: 'gmail_work', sender: 'Morning Markets', received_at: ago(260), subject: 'Markets wrap',
          address: 'news@markets.example', body: 'ASX 200 closes higher as miners rally; consumer discretionary flat.' },
        { category: 'fyi', lane: 'reading', priority: 3, summary: 'Daily markets newsletter. Nothing to action.' });

    const tasks = [
      { id: 't1', title: 'Review budget comments', due: at(0, 17), source_channel: 'gmail_work', done: false },
      { id: 't2', title: 'Renew car registration', due: at(5, 12), source_channel: null, done: false },
    ];
    return { events, messages, suggestions, tasks, done: new Set(), snoozed: {} };
  }

  const CHANNELS = [
    { id: 'imessage', label: 'iMessage', account: 'personal', colour: COLOURS.imessage },
    { id: 'whatsapp', label: 'WhatsApp', account: 'personal', colour: COLOURS.whatsapp },
    { id: 'gmail_work', label: 'Work mail', account: 'work', colour: COLOURS.gmail_work },
    { id: 'gmail_personal', label: 'Gmail', account: 'personal', colour: COLOURS.gmail_personal },
  ];
  const CALENDARS = [
    { id: 'work', label: 'Work', colour: COLOURS.work },
    { id: 'family', label: 'Family', colour: COLOURS.family },
  ];
  const PLANNED = [
    { label: 'Work mail + Work calendar', via: 'Google Workspace API', phase: 2 },
    { label: 'Gmail + Family calendar', via: 'Google API', phase: 2 },
    { label: 'AI suggestions', via: 'Claude API', phase: 3 },
    { label: 'iMessage', via: 'Messages database on the Mac', phase: 4 },
    { label: 'WhatsApp', via: 'Bridge (Beeper or similar)', phase: 4 },
    { label: 'Payments', via: 'Plugin slot', phase: 5 },
  ];

  let db = build(new Date());

  // ---------------------------------------------------------------- scheduling (mirrors scheduling.py)
  const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
  function freeSlot(p, evs) {
    const dur = p.end - p.start, step = 15 * 60000;
    const limit = new Date(p.start); limit.setHours(20, 0, 0, 0);
    for (let s = new Date(p.start.getTime() + step); s.getTime() + dur <= limit.getTime(); s = new Date(s.getTime() + step)) {
      const e = new Date(s.getTime() + dur);
      if (!evs.some((x) => overlaps(s, e, x.start, x.end))) return { start: s, end: e };
    }
    return null;
  }
  const eventsBetween = (start, end) => db.events.filter((e) => e.start < end && e.end > start).sort((a, b) => a.start - b.start);

  // ---------------------------------------------------------------- endpoints (mirror main.py)
  function feed() {
    const now = new Date(), laneOrder = { needs_you: 0, updates: 1, new_senders: 2, reading: 3 };
    const items = db.messages
      .filter((m) => !db.done.has(m.id) && !(db.snoozed[m.id] > now))
      .map((m) => {
        const s = db.suggestions[m.id];
        let clashes = [], alternative = null;
        if (s.event) {
          const near = eventsBetween(new Date(s.event.start.getTime() - 12 * 3600000), new Date(s.event.end.getTime() + 12 * 3600000));
          clashes = near.filter((e) => overlaps(s.event.start, s.event.end, e.start, e.end)).map((e) => e.title);
          if (clashes.length) alternative = freeSlot(s.event, near);
        }
        return { message: m, channel: CHANNELS.find((c) => c.id === m.channel), suggestion: s, clashes, alternative };
      });
    items.sort((a, b) => (laneOrder[a.suggestion.lane] - laneOrder[b.suggestion.lane])
      || (a.suggestion.priority - b.suggestion.priority) || (b.message.received_at - a.message.received_at));
    return items;
  }

  function route(method, path, body) {
    const url = new URL(path, location.href), p = url.pathname, now = new Date();
    let m;
    if (method === 'GET' && p === '/api/meta') return { channels: CHANNELS, calendars: CALENDARS, planned: PLANNED };
    if (method === 'GET' && p === '/api/feed') return feed();
    if (method === 'GET' && p === '/api/agenda') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return eventsBetween(start, new Date(start.getTime() + 14 * 86400000));
    }
    if (method === 'GET' && p === '/api/tasks') {
      return [...db.tasks].sort((a, b) => (a.done - b.done) || ((a.due || Infinity) - (b.due || Infinity)));
    }
    if ((m = p.match(/^\/api\/messages\/(\w+)\/(\w+)$/)) && method === 'POST') {
      const [, id, action] = m;
      const msg = db.messages.find((x) => x.id === id);
      if (!msg) throw new Error(`message ${id} not found`);
      if (action === 'reply') { console.info(`[demo] reply to ${msg.thread || msg.sender}: ${body.text}`); db.done.add(id); return { ok: true }; }
      if (action === 'done' || action === 'block') { db.done.add(id); return { ok: true }; }
      if (action === 'snooze') { db.snoozed[id] = new Date(body.until); return { ok: true, until: body.until }; }
      if (action === 'event') {
        const e = { id: `${body.calendar}-${Math.random().toString(16).slice(2, 10)}`, calendar: body.calendar, title: body.title,
                    start: new Date(body.start), end: new Date(body.end), location: body.location || null };
        db.events.push(e);
        return e;
      }
      if (action === 'task') {
        const t = { id: `t-${Math.random().toString(16).slice(2, 10)}`, title: body.title, due: body.due ? new Date(body.due) : null,
                    source_channel: msg.channel, done: false };
        db.tasks.push(t);
        return t;
      }
    }
    if ((m = p.match(/^\/api\/events\/(\w+)\/([\w-]+)$/)) && method === 'DELETE') {
      db.events = db.events.filter((e) => e.id !== m[2]);
      return { ok: true };
    }
    if ((m = p.match(/^\/api\/tasks\/([\w-]+)\/toggle$/)) && method === 'POST') {
      const t = db.tasks.find((x) => x.id === m[1]); t.done = !t.done; return t;
    }
    if ((m = p.match(/^\/api\/tasks\/([\w-]+)$/)) && method === 'DELETE') {
      db.tasks = db.tasks.filter((t) => t.id !== m[1]);
      return { ok: true };
    }
    if (method === 'POST' && p === '/api/reset') { db = build(new Date()); return { ok: true }; }
    throw new Error(`${method} ${p} not handled in demo`);
  }

  /** Serialise like the Python server: Dates become naive local ISO strings. */
  function serialise(value) {
    return JSON.parse(JSON.stringify(value, function (key, v) {
      return this[key] instanceof Date ? iso(this[key]) : v;
    }));
  }

  window.DEMO_API = {
    handle(method, path, body) {
      try { return Promise.resolve(serialise(route(method, path, body))); }
      catch (err) { return Promise.reject(err); }
    },
  };
})();
