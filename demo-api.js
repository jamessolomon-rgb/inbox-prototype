/* Demo API: an in-browser stand-in for the server, used by the prototype (local and hosted).
 *
 * Round 4 model (ASSESSMENT.md section 7): the CONVERSATION is the unit. Each conversation
 * (a chat, a group, an email thread) carries its full history. A conversation is "open" when it
 * needs the owner; Today lists open conversations sorted by a decided priority. Replying, reacting,
 * accepting an invitation or clearing closes it; a new inbound message would reopen it.
 *
 * All names, numbers and addresses are made up. Email addresses use the reserved .example domain.
 * State lives in memory and resets on reload.
 */
(function () {
  window.ORG_NAME = 'Acme';

  const COLOURS = {
    imessage: '#0A84FF', whatsapp: '#25D366', gmail_work: '#5E5CE6', gmail_personal: '#FF9F0A',
    slack: '#4A154B', work: '#5E5CE6', family: '#FF375F',
  };
  const CHANNELS = [
    { id: 'imessage', label: 'iMessage', account: 'personal', colour: COLOURS.imessage, reactions: true },
    { id: 'whatsapp', label: 'WhatsApp', account: 'personal', colour: COLOURS.whatsapp, reactions: true },
    { id: 'gmail_work', label: 'Work mail', account: 'work', colour: COLOURS.gmail_work, reactions: false },
    { id: 'gmail_personal', label: 'Gmail', account: 'personal', colour: COLOURS.gmail_personal, reactions: false },
    { id: 'slack', label: 'Slack', account: 'work', colour: COLOURS.slack, reactions: true },
  ];
  const CALENDARS = [
    { id: 'work', label: 'Work', account: 'work', colour: COLOURS.work, shared: false },
    { id: 'family', label: 'Family', account: 'personal', colour: COLOURS.family, shared: true },
  ];
  const PLANNED = [
    { label: 'Work mail + Work calendar', via: 'Google Workspace API', phase: 2 },
    { label: 'Gmail + shared Family calendar', via: 'Google API', phase: 2 },
    { label: 'Slack', via: 'Slack API with your own user token; workspace admin approval', phase: 2 },
    { label: 'Instant alerts for VIPs', via: 'Web push to the Home Screen app', phase: 2 },
    { label: 'AI suggestions that learn from your replies', via: 'Claude API', phase: 3 },
    { label: 'iMessage', via: 'Messages database on the Mac', phase: 4 },
    { label: 'WhatsApp', via: 'Bridge (Beeper or similar)', phase: 4 },
    { label: 'Payments', via: 'Plug-in slot', phase: 5 },
  ];
  // Who gets priority. Tier weights feed the Today ordering (decided prioritisation, answer 1).
  const TIER = {
    vip: { weight: 40, label: 'VIP' },
    family: { weight: 30, label: 'Family' },
    work: { weight: 15, label: 'Work' },
    normal: { weight: 8, label: '' },
    unknown: { weight: 0, label: 'New sender' },
  };

  // ---------------------------------------------------------------- date helpers
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let seq = 0;
  const uid = (p) => `${p}${++seq}`;

  // ---------------------------------------------------------------- sample data
  function build(now) {
    seq = 0;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const at = (days, h = 0, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, h, m);
    const pyWeekday = (today.getDay() + 6) % 7;                         // Mon = 0
    const nextWd = (wd) => (((wd - pyWeekday) % 7) + 7) % 7 || 7;      // always 1-7 days ahead
    const ago = (mins) => new Date(now.getTime() - mins * 60000);
    const dayName = (o) => WEEKDAYS[at(o).getDay()];
    const longDate = (o) => { const d = at(o); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
    const dM = (o) => { const d = at(o); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
    const dMon = (o) => { const d = at(o); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
    const aDMon = (o) => { const d = at(o); return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${dMon(o)}`; };
    const [mon, tue, wed, fri, sat, sun] = [0, 1, 2, 4, 5, 6].map(nextWd);
    const thuFortnight = nextWd(3) + 7;

    // Calendars. The Family calendar is shared: some events were entered by Sam.
    const ev = (calendar, title, start, end, location = null, added_by = 'You') =>
      ({ id: uid(`${calendar}-`), calendar, title, start, end, location, added_by });
    const events = [
      ev('work', 'Leadership team weekly', at(0, 8, 30), at(0, 9, 30), 'Level 3 boardroom'),
      ev('work', '1:1 Head of Sales', at(0, 11), at(0, 11, 30)),
      ev('work', 'Budget review', at(0, 15), at(0, 16)),
      ev('work', 'Month-end close check-in', at(1, 9), at(1, 10)),
      ev('work', 'Investor call', at(1, 14), at(1, 15), 'Teams'),
      ev('work', 'Board meeting', at(mon, 10), at(mon, 13), 'Level 3 boardroom'),
      ev('work', 'Treasury catch-up', at(tue, 9, 30), at(tue, 10)),
      ev('family', "Kids' soccer", at(sat, 8), at(sat, 9, 30), 'Local oval', 'Sam'),
      ev('family', 'Parent-teacher night', at(wed, 18), at(wed, 19)),
      ev('family', 'School pickup', at(0, 15, 15), at(0, 15, 45), null, 'Sam'),
      ev('family', "Dinner at Mum's", at(sun, 18), at(sun, 20, 30), null, 'Sam'),
    ];

    const conversations = [];
    const conv = (o) => {
      const c = { kind: 'direct', group_size: 0, external: false, address: null, subject: null, tier: 'normal',
                  muted: false, open: false, snoozed: null, blocked: false, messages: [], suggestion: null, ...o };
      conversations.push(c);
      return c;
    };
    const m = (from, sender, body, when, extra = {}) => ({ id: uid('msg'), from, sender, body, at: when, reactions: [], ...extra });
    const sug = (s) => ({ lane: 'needs_you', replies: [], event: null, task: null, invite: null, priority: 2,
                          urgency: 0, urgent_reason: null, warning: null, ...s });
    const pe = (title, start, end, calendar, location, why) => ({ title, start, end, calendar, location: location || null, why });
    const pt = (title, due, why) => ({ title, due, why });

    // ---- Needs you
    conv({ id: 'c-sam', channel: 'imessage', title: 'Sam', address: '+61 4xx xxx 201', tier: 'vip', open: true,
      messages: [
        m('them', 'Sam', 'Running late, can you do pickup?', at(-1, 15, 2)),
        m('me', 'You', 'Yep, on it', at(-1, 15, 4)),
        m('them', 'Sam', 'Can you grab milk and bread on the way home?', ago(14)),
        m('them', 'Sam', 'Also Mum wants us for dinner Sunday 6pm', ago(12)),
      ],
      suggestion: sug({ category: 'reply', urgency: 2, urgent_reason: 'Today',
        summary: "Milk and bread on the way home. Dinner at Mum's Sunday 6pm.",
        replies: ['Will do. Sunday works 👍', 'Will do. Can we make Sunday 6:30?', "Will do. Not sure about Sunday, I'll confirm tonight."],
        event: pe("Dinner at Mum's", at(sun, 18), at(sun, 20, 30), 'family', null, 'Sam wrote “Mum wants us for dinner Sunday 6pm”'),
        task: pt('Milk and bread on the way home', at(0, 18), 'Sam wrote “Can you grab milk and bread on the way home?”') }) });

    conv({ id: 'c-dave', channel: 'whatsapp', title: 'Dave (builder)', address: '+61 4xx xxx 552', tier: 'normal', open: true,
      messages: [
        m('me', 'You', 'Hi Dave, could you quote a deck extension at ours?', at(-6, 19, 10)),
        m('them', 'Dave (builder)', "Sure, I'll check my diary and come back to you", at(-6, 19, 40)),
        m('me', 'You', 'Thanks Dave', at(-6, 19, 52)),
        m('them', 'Dave (builder)', `Can come ${dayName(fri)} 10am to quote the deck, does that work?`, ago(25)),
      ],
      suggestion: sug({ category: 'schedule', urgency: 1, urgent_reason: `Visit ${dayName(fri)}`,
        summary: `Can quote the deck ${dayName(fri)} 10am.`,
        replies: [`${dayName(fri)} 10am works, see you then.`, 'Can you do 8am instead?', `Can't do ${dayName(fri)}. Early next week?`],
        event: pe('Builder quote: deck', at(fri, 10), at(fri, 10, 45), 'family', 'Home', `Dave wrote “Can come ${dayName(fri)} 10am to quote the deck”`) }) });

    conv({ id: 'c-cosec', channel: 'gmail_work', kind: 'email', title: 'Company Secretary', address: 'cosec@acme.example',
      subject: 'Board pack: final review', tier: 'vip', open: true,
      messages: [
        m('me', 'You', 'Can you circulate the board pack draft once all comments are in?', at(-2, 17, 20)),
        m('them', 'Company Secretary', 'Will do. Two sections still with the auditors.', at(-2, 17, 55)),
        m('me', 'You', 'Thanks', at(-2, 18, 3)),
        m('them', 'Company Secretary', 'Hi, the board pack is ready to circulate. Could we do 30 minutes tomorrow at 2pm to walk through the final version before it goes out?', ago(35)),
      ],
      suggestion: sug({ category: 'schedule', urgency: 3, urgent_reason: 'Asks about tomorrow 2pm',
        summary: 'Wants 30 minutes tomorrow at 2pm on the board pack before it goes out.',
        replies: ["2pm works. I'll send an invite.", "I'm on an investor call at 2. Can we do 3pm?", "Can you send the final draft first? I'll review tonight."],
        event: pe('Board pack walk-through', at(1, 14), at(1, 14, 30), 'work', null, 'Company Secretary wrote “Could we do 30 minutes tomorrow at 2pm”') }) });

    conv({ id: 'c-chair', channel: 'gmail_work', kind: 'email', title: 'Chair, Audit Committee', address: 'chair.arc@acme.example',
      subject: `Invitation: Audit committee pre-meet, ${aDMon(tue)} 2:00pm`, tier: 'vip', open: true,
      messages: [
        m('them', 'Chair, Audit Committee', `You're invited to "Audit committee pre-meet" on ${longDate(tue)}, 2:00pm to 2:45pm, Teams. Agenda: half-year planning and the auditor's letter.`, ago(48)),
      ],
      suggestion: sug({ category: 'invite', urgency: 2, urgent_reason: `Invitation for ${dayName(tue)}`,
        summary: `Invitation: audit committee pre-meet ${dayName(tue)} 2:00 to 2:45pm on Teams.`,
        replies: ['Thanks, see you then.'],
        invite: { title: 'Audit committee pre-meet', start: at(tue, 14), end: at(tue, 14, 45), location: 'Teams', organiser: 'Chair, Audit Committee', response: null } }) });

    conv({ id: 'c-sales', channel: 'gmail_work', kind: 'email', title: 'Head of Sales', address: 'sales.lead@acme.example',
      subject: 'September commission file', tier: 'work', open: true,
      messages: [
        m('them', 'Head of Sales', `September commission calcs are in the shared drive. I need your sign-off by ${dayName(fri)} so payroll can process on the 30th.`, ago(80)),
      ],
      suggestion: sug({ category: 'task', urgency: 1, urgent_reason: `Due ${dayName(fri)}`,
        summary: `September commission file needs your sign-off by ${dayName(fri)} for payroll.`,
        replies: [`Thanks, I'll sign off by ${dayName(fri)}.`, 'Can you flag any reps over 120% of target first?', `${dayName(fri)} is tight. Can payroll take it Monday?`],
        task: pt('Sign off September commission file', at(fri, 17), `Head of Sales wrote “I need your sign-off by ${dayName(fri)}”`) }) });

    conv({ id: 'c-tom', channel: 'imessage', title: 'Tom', address: '+61 4xx xxx 874', tier: 'normal', open: true,
      messages: [
        m('them', 'Tom', 'Good round last week, rematch soon', at(-5, 13, 0)),
        m('me', 'You', 'Any time', at(-5, 13, 30), { reactions: [{ emoji: '😂', by: 'Tom' }] }),
        m('them', 'Tom', `Golf ${dayName(sat)} 7:30? We need a 4th`, ago(55)),
      ],
      suggestion: sug({ category: 'reply', urgency: 0,
        summary: `Golf ${dayName(sat)} 7:30am. They need a fourth.`,
        replies: [`Can't this ${dayName(sat)}, kids' soccer. Next week?`, "I'm in. See you at 7:30.", 'Soccer finishes 9:30. Could I join for the back nine?'],
        event: pe('Golf with Tom', at(sat, 7, 30), at(sat, 12), 'family', 'Golf club', `Tom wrote “Golf ${dayName(sat)} 7:30”`) }) });

    // Group chat: four new messages become one item (digest)
    conv({ id: 'c-family', channel: 'whatsapp', kind: 'group', title: 'Family', group_size: 6, tier: 'family', open: true,
      messages: [
        m('them', 'Dad', 'Photos from the weekend are in the shared album', at(-2, 20, 5)),
        m('me', 'You', 'Great ones, thanks', at(-2, 20, 30)),
        m('them', 'Mum', "Who's hosting Christmas this year? Need numbers by the end of the month 🎄", ago(150)),
        m('them', 'Dad', 'We did it last year 😄', ago(140)),
        m('them', 'Aunt Jo', 'Happy to bring dessert wherever it is', ago(95)),
        m('them', 'Mum', 'Let me know by the 30th please', ago(60)),
      ],
      suggestion: sug({ category: 'reply', urgency: 1, urgent_reason: 'Asked you by the 30th',
        summary: 'Mum asks who hosts Christmas; numbers by the 30th. Dad notes they hosted last year. Aunt Jo will bring dessert.',
        replies: ['We can host this year.', "Not sure yet, I'll confirm by the weekend.", 'Can we talk about it at dinner on Sunday?'] }) });

    conv({ id: 'c-dentist', channel: 'gmail_personal', kind: 'email', title: 'Smile Dental', address: 'reception@smiledental.example',
      subject: 'Appointment reminder', tier: 'normal', open: true,
      messages: [m('them', 'Smile Dental', `Your appointment is on ${longDate(tue)} at 4:15pm. Reply to confirm.`, ago(420))],
      suggestion: sug({ category: 'schedule', urgency: 1, urgent_reason: 'Wants a confirmation',
        summary: `Dentist ${dayName(tue)} 4:15pm. They want a confirmation.`,
        replies: ['Confirmed, see you then.', 'I need to reschedule. Anything later that week?'],
        event: pe('Dentist', at(tue, 16, 15), at(tue, 17), 'family', 'Smile Dental', `Smile Dental wrote “Your appointment is on ${longDate(tue)} at 4:15pm”`) }) });

    // Slack: a direct message with a deadline, and an @mention in a channel thread
    conv({ id: 'c-slack-dm', channel: 'slack', title: 'Finance Ops Lead', address: '@finance.ops', tier: 'work', open: true,
      messages: [
        m('me', 'You', 'Thanks for turning the September close around so quickly', at(-1, 17, 40)),
        m('them', 'Finance Ops Lead', 'No worries!', at(-1, 17, 42)),
        m('them', 'Finance Ops Lead', "Can you approve the October accruals journal before 3pm? It's in the approvals queue.", ago(18)),
      ],
      suggestion: sug({ category: 'task', urgency: 2, urgent_reason: 'Due 3pm today',
        summary: 'October accruals journal needs your approval before 3pm.',
        replies: ['Approved, thanks.', "Looking at it now, done by 3.", 'Can you send me the support first?'],
        task: pt('Approve October accruals journal', at(0, 15), 'Finance Ops Lead wrote “approve the October accruals journal before 3pm”') }) });

    conv({ id: 'c-slack-thread', channel: 'slack', kind: 'group', title: '#finance-leadership', group_size: 12, slack_thread: true, tier: 'work', open: true,
      messages: [
        m('them', 'FP&A Manager', 'Board deck v3 is in the shared folder. Commentary still to come on the margin bridge.', ago(130)),
        m('them', 'Commercial Director', 'Adding the trade-in volume chart this afternoon', ago(95)),
        m('them', 'FP&A Manager', `@you can you confirm the cut-off for final numbers? Thinking ${dayName(fri)} 12pm.`, ago(41)),
      ],
      suggestion: sug({ category: 'reply', urgency: 1, urgent_reason: 'You were mentioned',
        summary: 'Board deck v3 is up. FP&A asks you to confirm the final-numbers cut-off (suggesting Friday 12pm).',
        replies: [`Confirmed, ${dayName(fri)} 12pm cut-off.`, 'Can we make it Thursday 5pm? I want the weekend to review.', "Not yet, I'll confirm after I speak to the auditors."],
        event: pe('Board deck: final numbers cut-off', at(fri, 12), at(fri, 12, 15), 'work', null, `FP&A Manager wrote “Thinking ${dayName(fri)} 12pm”`) }) });

    // ---- Updates
    conv({ id: 'c-slack-general', channel: 'slack', kind: 'group', title: '#general', group_size: 260, tier: 'normal', open: true,
      messages: [
        m('them', 'People & Culture', `Reminder: the office is closed ${dayName(mon)} for building maintenance. Please work from home.`, ago(210)),
      ],
      suggestion: sug({ category: 'fyi', lane: 'updates', priority: 3,
        summary: `Office closed ${dayName(mon)} for maintenance; work from home.` }) });

    conv({ id: 'c-soccer', channel: 'whatsapp', kind: 'group', title: 'Under 10s Soccer Parents', group_size: 23, tier: 'normal', open: true,
      messages: [
        m('them', 'Coach Mike', `Heads up: training moves to ${dayName(tue)} 5pm next week because of a field closure.`, ago(70)),
        m('them', 'Priya', 'Thanks Mike', ago(66)),
        m('them', 'Ben', '👍', ago(61)),
        m('them', 'Coach Mike', 'Bring water bottles, it will be warm', ago(40)),
      ],
      suggestion: sug({ category: 'schedule', lane: 'updates',
        summary: `Training moves to ${dayName(tue)} 5pm next week. Bring water bottles.`,
        event: pe('Soccer training (moved)', at(tue, 17), at(tue, 18), 'family', null, `Coach Mike wrote “training moves to ${dayName(tue)} 5pm next week”`) }) });

    conv({ id: 'c-school', channel: 'gmail_personal', kind: 'email', title: 'Hillview Primary School', address: 'office@hillview.example',
      subject: 'Year 4 excursion: permission and payment', tier: 'normal', open: true,
      messages: [m('them', 'Hillview Primary School', `Year 4 will visit the museum on ${longDate(wed)}. Please return the permission note and pay $35 through the parent portal by ${dayName(mon)}.`, ago(300))],
      suggestion: sug({ category: 'task', lane: 'updates', urgency: 1, urgent_reason: `Due ${dayName(mon)}`,
        summary: `Year 4 excursion ${dayName(wed)}. Permission note and $35 due ${dayName(mon)}.`,
        task: pt('Sign excursion note and pay $35', at(mon, 9), `The school wrote “pay $35 through the parent portal by ${dayName(mon)}”`),
        event: pe('Year 4 excursion: museum', at(wed, 9), at(wed, 15), 'family', null, `The school wrote “Year 4 will visit the museum on ${longDate(wed)}”`) }) });

    conv({ id: 'c-bank', channel: 'gmail_work', kind: 'email', title: 'Relationship Manager, Bank', address: 'rm@bank.example',
      subject: 'Compliance certificate due', external: true, tier: 'work', open: true,
      messages: [m('them', 'Relationship Manager, Bank', `A reminder that the quarterly compliance certificate is due ${dM(9)}. Please send the signed certificate with supporting calculations.`, ago(190))],
      suggestion: sug({ category: 'task', lane: 'updates', urgent_reason: `Due ${dMon(9)}`,
        summary: `Quarterly covenant compliance certificate due ${dMon(9)}.`,
        replies: [`Received, thanks. You'll have it by ${dM(9)}.`],
        task: pt('Covenant compliance certificate to bank', at(9, 12), `The bank wrote “the quarterly compliance certificate is due ${dM(9)}”`) }) });

    conv({ id: 'c-airline', channel: 'gmail_personal', kind: 'email', title: 'Airline', address: 'no-reply@airline.example',
      subject: 'Booking confirmation: Sydney to Melbourne', tier: 'normal', open: true,
      messages: [m('them', 'Airline', `Booking confirmed. Sydney to Melbourne, ${longDate(thuFortnight)}, departs 7:00am, arrives 8:35am. Booking reference 8XK2PQ.`, ago(900))],
      suggestion: sug({ category: 'schedule', lane: 'updates', priority: 3,
        summary: `Flight Sydney to Melbourne ${aDMon(thuFortnight)}, 7:00am. Ref 8XK2PQ.`,
        event: pe('Flight SYD to MEL (ref 8XK2PQ)', at(thuFortnight, 7), at(thuFortnight, 8, 35), 'work', 'Sydney T3', 'The airline wrote “departs 7:00am, arrives 8:35am”') }) });

    // ---- New senders and Reading
    conv({ id: 'c-unknown', channel: 'imessage', title: '+61 4xx xxx 118', address: '+61 4xx xxx 118', tier: 'unknown', open: true,
      messages: [m('them', '+61 4xx xxx 118', 'Your parcel is held due to an unpaid customs fee. Pay $2.99 at parcel-delivery-au.example', ago(140))],
      suggestion: sug({ category: 'fyi', lane: 'new_senders', priority: 3,
        summary: 'Text claiming a held parcel and asking for a fee.',
        warning: "Likely scam. The link isn't the courier's real address, so don't open it." }) });

    conv({ id: 'c-news', channel: 'gmail_work', kind: 'email', title: 'Morning Markets', address: 'news@markets.example',
      subject: 'Markets wrap', tier: 'normal', open: true,
      messages: [m('them', 'Morning Markets', 'ASX 200 closes higher as miners rally; consumer discretionary flat.', ago(260))],
      suggestion: sug({ category: 'fyi', lane: 'reading', priority: 3, summary: 'Daily markets newsletter. Nothing to action.' }) });

    // ---- Conversations with nothing pending: they appear in Chats, not Today
    conv({ id: 'c-ceo', channel: 'imessage', title: 'CEO', address: '+61 4xx xxx 330', tier: 'vip',
      messages: [
        m('them', 'CEO', 'Results pack looked sharp, thanks for pulling it together', at(-1, 21, 12)),
        m('me', 'You', 'Thanks, team effort', at(-1, 21, 20), { reactions: [{ emoji: '👍', by: 'CEO' }] }),
      ] });
    conv({ id: 'c-mum', channel: 'whatsapp', title: 'Mum', address: '+61 4xx xxx 412', tier: 'family',
      messages: [
        m('them', 'Mum', 'Lovely to see the kids on Sunday', at(-4, 18, 0)),
        m('me', 'You', 'They loved it. See you this weekend', at(-4, 18, 9), { reactions: [{ emoji: '❤️', by: 'Mum' }] }),
      ] });
    conv({ id: 'c-audit', channel: 'gmail_work', kind: 'email', title: 'Audit partner', address: 'audit.partner@auditfirm.example',
      subject: 'Half-year planning', external: true, tier: 'work',
      messages: [
        m('them', 'Audit partner', 'Attached is our half-year planning memo for your review.', at(-3, 10, 15), { attachment: 'HY planning memo.pdf' }),
        m('me', 'You', 'Thanks, comments by Friday.', at(-3, 11, 2)),
      ] });

    // People you can start a new conversation with (besides existing chats)
    const contacts = [
      { id: 'p-cfo-office', name: 'Treasury Analyst', channel: 'slack', address: '@treasury' },
      { id: 'p-priya', name: 'Priya', channel: 'whatsapp', address: '+61 4xx xxx 640' },
      { id: 'p-team', name: 'Finance team', channel: 'gmail_work', address: 'finance.team@acme.example', kind: 'email' },
      { id: 'p-gp', name: 'Family GP', channel: 'gmail_personal', address: 'clinic@familygp.example', kind: 'email' },
    ];

    const tasks = [
      { id: 't1', title: 'Review budget comments', due: at(0, 17), source_channel: 'gmail_work', done: false },
      { id: 't2', title: 'Renew car registration', due: at(5, 12), source_channel: null, done: false },
    ];
    return { events, conversations, contacts, tasks };
  }

  let db = build(new Date());

  // ---------------------------------------------------------------- scheduling
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
  const words = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
  /** Shared calendar check: the same event already entered (by anyone) within 30 minutes, sharing a word. */
  function findDuplicate(p) {
    const pw = words(p.title);
    return db.events.find((e) => Math.abs(e.start - p.start) <= 30 * 60000 && [...words(e.title)].some((w) => pw.has(w))) || null;
  }

  // ---------------------------------------------------------------- conversation helpers
  const lastMsg = (c) => c.messages[c.messages.length - 1];
  const lastMine = (c) => { for (let i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].from === 'me') return i; return -1; };
  /** Inbound messages since the owner last wrote: the "new" part of a conversation. */
  const newMessages = (c) => c.messages.slice(lastMine(c) + 1).filter((x) => x.from === 'them');

  /** Decided prioritisation: who it is, how urgent, and how long they've waited. */
  function priority(c, now) {
    const s = c.suggestion, fresh = newMessages(c);
    const since = fresh.length ? fresh[0].at : lastMsg(c).at;
    const waitMin = Math.max(0, (now - since) / 60000);
    const score = TIER[c.tier].weight + (s.urgency || 0) * 12 + Math.min(waitMin / 30, 12) - (s.priority === 3 ? 20 : 0);
    const wait = waitMin < 60 ? `${Math.round(waitMin)} min` : waitMin < 1440 ? `${Math.round(waitMin / 60)} h` : `${Math.round(waitMin / 1440)} d`;
    const reason = [TIER[c.tier].label, s.urgent_reason || (s.lane === 'needs_you' && fresh.length ? `Waiting ${wait}` : null)]
      .filter(Boolean).join(' · ');
    return { score: Math.round(score * 10) / 10, reason };
  }

  function itemFor(c, now) {
    const s = c.suggestion;
    let clashes = [], alternative = null, duplicate = null;
    const ev = s.event || (s.invite && !s.invite.response ? s.invite : null);
    if (ev) {
      duplicate = s.event ? findDuplicate(s.event) : null;
      const near = eventsBetween(new Date(ev.start.getTime() - 12 * 3600000), new Date(ev.end.getTime() + 12 * 3600000))
        .filter((e) => e !== duplicate);
      clashes = near.filter((e) => overlaps(ev.start, ev.end, e.start, e.end)).map((e) => e.title);
      if (clashes.length && s.event) alternative = freeSlot(ev, near);
    }
    return {
      conversation: c, channel: CHANNELS.find((x) => x.id === c.channel), suggestion: s,
      clashes, alternative, duplicate: duplicate && { title: duplicate.title, calendar: duplicate.calendar, added_by: duplicate.added_by },
      priority: priority(c, now), new_count: newMessages(c).length,
    };
  }

  function today() {
    const now = new Date(), laneOrder = { needs_you: 0, updates: 1, new_senders: 2, reading: 3 };
    return db.conversations
      .filter((c) => c.open && !c.blocked && !c.muted && !(c.snoozed && c.snoozed > now) && c.suggestion)
      .map((c) => itemFor(c, now))
      .sort((a, b) => (laneOrder[a.suggestion.lane] - laneOrder[b.suggestion.lane]) || (b.priority.score - a.priority.score));
  }

  function chatList(q) {
    const needle = (q || '').trim().toLowerCase();
    return db.conversations
      .filter((c) => !c.blocked && c.messages.length)   // a new conversation appears once something is sent
      .map((c) => {
        let match = null;
        if (needle) {
          if (!c.title.toLowerCase().includes(needle) && !(c.subject || '').toLowerCase().includes(needle)) {
            const hit = [...c.messages].reverse().find((x) => x.body.toLowerCase().includes(needle));
            if (!hit) return null;
            match = hit.body;
          }
        }
        const last = lastMsg(c);
        return { id: c.id, channel: c.channel, kind: c.kind, title: c.title, subject: c.subject, group_size: c.group_size,
                 tier: c.tier, muted: c.muted, open: c.open && !c.blocked, unread: c.open ? newMessages(c).length : 0,
                 last: { from: last.from, sender: last.sender, body: last.body, at: last.at }, match };
      })
      .filter(Boolean)
      .sort((a, b) => b.last.at - a.last.at);
  }

  // ---------------------------------------------------------------- endpoints
  function route(method, path, body) {
    const url = new URL(path, location.href), p = url.pathname, now = new Date();
    let mm;
    const find = (id) => { const c = db.conversations.find((x) => x.id === id); if (!c) throw new Error(`conversation ${id} not found`); return c; };

    if (method === 'GET' && p === '/api/meta') {
      return { channels: CHANNELS, calendars: CALENDARS, planned: PLANNED,
               vips: db.conversations.filter((c) => c.tier === 'vip').map((c) => c.title) };
    }
    if (method === 'GET' && p === '/api/today') return today();
    if (method === 'GET' && p === '/api/conversations') return chatList(url.searchParams.get('q'));
    if (method === 'GET' && p === '/api/contacts') {
      const fromChats = db.conversations.filter((c) => c.kind !== 'group' && c.tier !== 'unknown' && !/no-?reply|news@/.test(c.address || ''))
        .map((c) => ({ id: c.id, name: c.title, channel: c.channel, address: c.address, conversation: c.id }));
      return [...fromChats, ...db.contacts].sort((a, b) => a.name.localeCompare(b.name));
    }
    if ((mm = p.match(/^\/api\/conversations\/([\w-]+)$/)) && method === 'GET') {
      const c = find(mm[1]);
      return { conversation: c, channel: CHANNELS.find((x) => x.id === c.channel),
               item: c.open && c.suggestion ? itemFor(c, now) : null };
    }
    if (method === 'POST' && p === '/api/conversations/new') {
      const person = db.contacts.find((x) => x.id === body.contact);
      if (!person) throw new Error('unknown contact');
      let c = db.conversations.find((x) => x.address === person.address);
      if (!c) {
        c = { id: `c-${person.id}`, channel: person.channel, kind: person.kind || 'direct', title: person.name, address: person.address,
              group_size: 0, external: false, subject: person.kind === 'email' ? 'New message' : null, tier: 'normal',
              muted: false, open: false, snoozed: null, blocked: false, messages: [], suggestion: null };
        db.conversations.push(c);
      }
      return { id: c.id };
    }
    if ((mm = p.match(/^\/api\/conversations\/([\w-]+)\/(\w+)$/)) && method === 'POST') {
      const [, id, action] = mm, c = find(id);
      switch (action) {
        case 'reply':
          c.messages.push({ id: uid('msg'), from: 'me', sender: 'You', body: body.text, at: now, reactions: [] });
          c.open = false; c.snoozed = null;
          console.info(`[demo] to ${c.title}: ${body.text}`);
          return { ok: true };
        case 'react': {
          const target = [...c.messages].reverse().find((x) => x.from === 'them');
          if (target) target.reactions.push({ emoji: body.emoji, by: 'You' });
          c.open = false;
          return { ok: true };
        }
        case 'done': c.open = false; return { ok: true };
        case 'block': c.blocked = true; c.open = false; return { ok: true };
        case 'allow': c.tier = 'normal'; c.suggestion.lane = 'needs_you'; return { ok: true };
        case 'mute': c.muted = !c.muted; return { ok: true, muted: c.muted };
        case 'snooze': c.snoozed = new Date(body.until); return { ok: true };
        case 'invite': {
          // Answering an invitation doesn't close the conversation: you may still want to reply to the email.
          // response null = undo (takes the event back out).
          const inv = c.suggestion.invite;
          if (inv.event_id) { db.events = db.events.filter((e) => e.id !== inv.event_id); inv.event_id = null; }
          inv.response = body.response || null;
          if (inv.response && inv.response !== 'decline') {
            const e = { id: uid('work-'), calendar: 'work', title: inv.response === 'maybe' ? `Maybe: ${inv.title}` : inv.title,
                        start: inv.start, end: inv.end, location: inv.location, added_by: 'You' };
            db.events.push(e);
            inv.event_id = e.id;
          }
          return { ok: true, response: inv.response };
        }
        case 'event': {
          const e = { id: uid(`${body.calendar}-`), calendar: body.calendar, title: body.title, start: new Date(body.start),
                      end: new Date(body.end), location: body.location || null, added_by: 'You' };
          db.events.push(e);
          return e;
        }
        case 'task': {
          const t = { id: uid('t-'), title: body.title, due: body.due ? new Date(body.due) : null, source_channel: c.channel, done: false };
          db.tasks.push(t);
          return t;
        }
      }
    }
    if (method === 'GET' && p === '/api/agenda') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 14 * 86400000);
      const pending = db.conversations.filter((c) => c.open && c.suggestion?.invite && !c.suggestion.invite.response)
        .map((c) => ({ id: `invite-${c.id}`, calendar: 'work', title: c.suggestion.invite.title, start: c.suggestion.invite.start,
                       end: c.suggestion.invite.end, location: c.suggestion.invite.location, added_by: c.suggestion.invite.organiser,
                       pending: true, conversation: c.id }));
      return [...eventsBetween(start, end), ...pending.filter((e) => e.start < end)].sort((a, b) => a.start - b.start);
    }
    if (method === 'GET' && p === '/api/tasks') {
      return [...db.tasks].sort((a, b) => (a.done - b.done) || ((a.due ? a.due.getTime() : Infinity) - (b.due ? b.due.getTime() : Infinity)));
    }
    if ((mm = p.match(/^\/api\/events\/[\w-]+\/([\w-]+)$/)) && method === 'DELETE') {
      db.events = db.events.filter((e) => e.id !== mm[1]);
      return { ok: true };
    }
    if ((mm = p.match(/^\/api\/tasks\/([\w-]+)\/toggle$/)) && method === 'POST') {
      const t = db.tasks.find((x) => x.id === mm[1]); t.done = !t.done; return t;
    }
    if ((mm = p.match(/^\/api\/tasks\/([\w-]+)$/)) && method === 'DELETE') {
      db.tasks = db.tasks.filter((t) => t.id !== mm[1]);
      return { ok: true };
    }
    if (method === 'POST' && p === '/api/reset') { db = build(new Date()); return { ok: true }; }
    throw new Error(`${method} ${p} not handled in demo`);
  }

  /** Serialise like a JSON API: Dates become naive local ISO strings; returns a deep copy. */
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
