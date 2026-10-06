// Jobs pages: /jobs (P06) and /jobs/{slug} (P07), hash-routed for the prototype.
import { api, scenario, session, mockAddToRecord } from './api.js';
import { readRoleList, readRoleDetail, readMatch, readApplication, readError, ContractError } from './contract.js';

const $main = document.getElementById('main');
const $live = document.getElementById('live');

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BACK = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EYE = '<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>';
const DASH = '<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

const EMPLOYMENT = { full_time: 'Full time', part_time: 'Part time', per_diem: 'Per diem', contract: 'Contract', temporary: 'Temporary' };
const SHIFT = { day: 'Days', night: 'Nights', evening: 'Evenings', rotating: 'Rotating' };
const PERIOD = { hour: 'an hour', year: 'a year', week: 'a week' };
const human = (map, v) => map[v] ?? (v ? v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');
const day = (iso, year = false) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
const time = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const money = (v) => '$' + Number(v).toFixed(Number(v) % 1 ? 2 : 0);
function pay(r) {
  if (!r.payMin && !r.payMax) return null;
  const range = r.payMin && r.payMax ? `${money(r.payMin)}–${money(r.payMax)}` : money(r.payMin || r.payMax);
  return `${range} ${PERIOD[r.payPeriod] ?? ''}`.trim();
}
const announce = (msg) => { $live.textContent = ''; requestAnimationFrame(() => { $live.textContent = msg; }); };
const setTitle = (t) => { document.title = `${t} | Rōvn`; };

// Employer copy arrives sanitized from the backend; keep only basic text tags as a second guard.
function safeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ok = new Set(['P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'BR']);
  const walk = (n) => [...n.childNodes].map((c) => {
    if (c.nodeType === 3) return esc(c.textContent);
    if (c.nodeType !== 1) return '';
    const inner = walk(c);
    return ok.has(c.tagName) ? `<${c.tagName.toLowerCase()}>${inner}</${c.tagName.toLowerCase()}>` : inner;
  }).join('');
  return walk(doc.body);
}

// ---------------------------------------------------------------- router
function route() {
  const [path, query] = (location.hash.slice(1) || '/jobs').split('?');
  const parts = path.split('/').filter(Boolean);
  document.querySelectorAll('.top nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#/jobs'));
  if (parts[0] === 'jobs' && parts[1]) return rolePage(decodeURIComponent(parts[1]));
  return listPage(new URLSearchParams(query).get('q') || '');
}
window.addEventListener('hashchange', () => { route(); $main.focus({ preventScroll: true }); window.scrollTo(0, 0); });

// ---------------------------------------------------------------- list (P06)
let listCache = null;

async function listPage(q) {
  listView.matches = new Map();
  setTitle('Healthcare roles');
  $main.innerHTML = `<div class="wrap"><div class="list-head">${skel(56, 60)}${skel(20, 70)}</div><ul class="cards">${[1, 2, 3, 4].map(() => `<li><div class="skel" style="height:188px;border-radius:24px"></div></li>`).join('')}</ul></div>`;
  const res = await api.listRoles();
  if (res.status !== 200) return listState('unreachable');
  try { listCache = readRoleList(res.body); } catch (e) { console.warn(e); return listState('malformed'); }
  if (!listCache.roles.length) return listState('empty');
  renderList(q);
}

function listState(kind) {
  const copy = {
    empty: ['Your next role starts with a clear plan.', 'There are no open roles published here yet. Use the next-role guide to prepare your questions and see how Rōvn is building the path from opportunity to first shift.'],
    unreachable: ['Roles couldn’t load right now.', 'The live list couldn’t be reached, so nothing is shown rather than something out of date. Try again in a moment.'],
    malformed: ['Roles couldn’t be shown.', 'The list we received was incomplete, so we’re not showing it. Try again in a moment.'],
  }[kind];
  const actions = kind === 'empty'
    ? `<a class="btn btn--primary" href="#/guide">Plan my next move ${ARROW}</a><a class="btn btn--quiet" href="#/organizations">Hiring? Explore Rōvn</a>`
    : `<button class="btn btn--primary" data-retry>Try again</button>`;
  $main.innerHTML = `<div class="wrap"><section class="state" aria-labelledby="h"><h1 id="h" class="display">${copy[0]}</h1><p>${copy[1]}</p><div class="btn-row">${actions}</div></section></div>`;
  $main.querySelector('[data-retry]')?.addEventListener('click', () => route());
  announce(copy[0]);
}

// The list mirrors the role page: tiles over text, and when signed in, a qualification chip per role.
// Order stays newest first; matches never reorder or filter roles unless the person asks to.
const listView = { q: '', f: '', matches: new Map(), loading: false };
const FILTERS = [
  ['ready', 'You qualify', (r) => listView.matches.get(r.id)?.met === listView.matches.get(r.id)?.total],
  ['day', 'Days', (r) => r.shift === 'day'], ['night', 'Nights', (r) => r.shift === 'night'], ['evening', 'Evenings', (r) => r.shift === 'evening'],
  ['full_time', 'Full time', (r) => r.employmentType === 'full_time'], ['part_time', 'Part time', (r) => r.employmentType === 'part_time'],
];

function renderList(q) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  Object.assign(listView, { q, f: params.get('f') || '' });
  const present = FILTERS.filter(([k, , fn]) => (k === 'ready' ? session.signedIn : listCache.roles.some(fn)));
  $main.innerHTML = `<div class="wrap">
    <div class="list-head"><h1 class="display">Find work worth moving for.</h1></div>
    <div class="finder">
      <div class="search" role="search">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <label class="sr-only" for="q">Search roles</label>
        <input id="q" type="search" placeholder="Role, organization or city" value="${esc(q)}" autocomplete="off">
      </div>
      <div class="chips" role="group" aria-label="Filter roles">${present.map(([k, label]) => `<button class="chip" data-f="${k}" aria-pressed="${listView.f === k}">${k === 'ready' ? `<i class="dot"></i>` : ''}${label}</button>`).join('')}</div>
    </div>
    ${session.signedIn ? '' : `<div class="nudge"><div><b>See which roles you qualify for.</b><span>Sign in and every role shows where you stand.</span></div><button class="btn btn--secondary btn--sm" data-signin>Check my matches</button></div>`}
    <p class="count" id="count" aria-live="polite"></p>
    <div id="results"></div>
    <p class="note" style="margin-top:32px">Newest first. Roles are never ranked by who you are.</p>
  </div>`;
  const $q = $main.querySelector('#q');
  let t;
  $q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { listView.q = $q.value.trim(); syncListUrl(); renderRows(); }, 150); });
  $main.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    listView.f = listView.f === c.dataset.f ? '' : c.dataset.f;
    $main.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === listView.f)));
    syncListUrl(); renderRows();
  }));
  $main.querySelector('[data-signin]')?.addEventListener('click', () => { view.role = null; openSignIn(); });
  renderRows();
  if (session.signedIn) loadListMatches();
}

function syncListUrl() {
  const p = new URLSearchParams();
  if (listView.q) p.set('q', listView.q);
  if (listView.f) p.set('f', listView.f);
  history.replaceState(null, '', `#/jobs${p.toString() ? '?' + p : ''}`);
}

// One match call per role for now. A batch match endpoint would be needed at real list sizes (ask Anish).
async function loadListMatches() {
  listView.loading = true; renderRows();
  await Promise.all(listCache.roles.map(async (r) => {
    const res = await api.getMatch(r.id);
    if (res.status === 200) { try { listView.matches.set(r.id, readMatch(res.body)); } catch { /* chip stays hidden */ } }
  }));
  listView.loading = false; renderRows();
}

function matchChip(r) {
  if (!session.signedIn) return `<span class="posted">${day(r.publishedAt)}</span>`;
  const m = listView.matches.get(r.id);
  if (!m) return listView.loading ? `<span class="mchip skel" style="width:110px"></span>` : '';
  const open = m.lines.filter((l) => l.status !== 'satisfied');
  if (!open.length) return `<span class="mchip mchip--ready">${CHECK} You qualify</span>`;
  const review = open.every((l) => l.status === 'human_review_required');
  return `<span class="mchip"><i class="dot ${review ? 'dot--amber' : 'dot--grey'}"></i>${open.length} ${review ? (open.length === 1 ? 'thing' : 'things') + ' to add' : 'missing'}</span>`;
}

function renderRows() {
  const needle = listView.q.toLowerCase();
  const filter = FILTERS.find(([k]) => k === listView.f)?.[2];
  const rows = listCache.roles.filter((r) => (!needle || [r.title, r.employer, r.city, r.state, r.profession].join(' ').toLowerCase().includes(needle)) && (!filter || filter(r)));
  const total = listCache.roles.length;
  $main.querySelector('#count').textContent = rows.length === total ? `${total} open roles` : `${rows.length} of ${total} roles`;
  const $r = $main.querySelector('#results');
  if (!rows.length) {
    $r.innerHTML = `<div class="state" style="padding:48px 0"><h2 class="section">No roles match.</h2><p class="muted">Try another search or filter.</p><div class="btn-row"><button class="btn btn--secondary" data-clear>Clear all</button></div></div>`;
    $r.querySelector('[data-clear]').addEventListener('click', () => { listView.q = ''; listView.f = ''; syncListUrl(); renderList(''); });
    return;
  }
  $r.innerHTML = `<ul class="cards">${rows.map((r) => {
    const p = pay(r);
    const facts = [
      p ? `<span class="fact fact--pay">${icon('pay')}<b>${esc(p.replace(' an hour', ''))}</b>${r.payPeriod === 'hour' ? '<span>/hr</span>' : ''}</span>` : '',
      r.shift ? `<span class="fact">${icon(shiftIcon(r.shift))}${esc(human(SHIFT, r.shift))}</span>` : '',
      `<span class="fact">${icon('type')}${esc(human(EMPLOYMENT, r.employmentType))}</span>`,
    ].join('');
    return `<li><a class="jcard" href="#/jobs/${encodeURIComponent(r.id)}">
      <div class="jcard__top"><span class="mono-tile">${esc(initials(r.employer))}</span>
        <div class="jcard__who"><b>${esc(r.employer)}</b><span>${esc([r.city, r.state].filter(Boolean).join(', '))}</span></div>${matchChip(r)}</div>
      <h2 class="jcard__title">${esc(r.title)}</h2>
      <div class="facts-row">${facts}</div>
    </a></li>`;
  }).join('')}</ul>`;
}

// ---------------------------------------------------------------- role (P07)
// At a glance: what the job is (fact tiles), then one answer, "can I apply?", with one next step.
// Requirements and details fold away; nothing on the page ranks the person.
const view = { role: null, match: null, matchState: 'idle', applyState: 'idle', receipt: null, error: null };

const ICON = {
  pay: '<path d="M12 3v18M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.6 0-4.5 1.3-4.5 3.2 0 4.3 9 2.3 9 6.6 0 1.9-1.9 3.2-4.5 3.2-2.2 0-3.9-.9-4.7-2.3" />',
  shift: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />',
  day: '<circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />',
  evening: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4.5v3M5.2 9.2l2 1.6M18.8 9.2l-2 1.6" />',
  place: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />',
  type: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />',
  date: '<rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />',
};
const shiftIcon = (v) => ({ day: 'day', evening: 'evening' }[v] ?? 'shift');
const icon = (k) => `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const NEXT = { state_license: 'Add your license', bls: 'Add your BLS card' };

async function rolePage(id) {
  Object.assign(view, { role: null, match: null, matchState: 'idle', applyState: 'idle', receipt: null, error: null });
  $main.innerHTML = `<div class="wrap narrow">${skel(16, 15)}<div style="height:24px"></div>${skel(20, 40)}<div style="height:12px"></div>${skel(52, 75)}
    <div style="height:24px"></div><div class="tiles">${[1, 2, 3, 4].map(() => `<div class="skel" style="height:76px;border-radius:14px"></div>`).join('')}</div>
    <div style="height:24px"></div><div class="skel" style="height:150px;border-radius:24px"></div></div>`;
  setTitle('Loading role');
  const res = await api.getRole(id);
  if (res.status === 404) return roleState('not_found');
  if (res.status !== 200) return roleState('unavailable', id);
  try { view.role = readRoleDetail(res.body); } catch (e) { console.warn(e); return roleState('malformed'); }
  renderRole();
  if (session.signedIn) loadMatch();
}

function roleState(kind, id) {
  const c = {
    not_found: ['This role isn’t available.', 'It may have been removed, or the link may be wrong.', `<a class="btn btn--primary" href="#/jobs">See current roles ${ARROW}</a>`],
    unavailable: ['This role couldn’t load.', 'Roles are briefly unavailable. Nothing about your applications has changed.', `<button class="btn btn--primary" data-retry>Try again</button><a class="btn btn--quiet" href="#/jobs">Back to roles</a>`],
    malformed: ['This role couldn’t be shown.', 'The details we received were incomplete, so we’re not showing them.', `<a class="btn btn--primary" href="#/jobs">Back to roles ${ARROW}</a>`],
  }[kind];
  setTitle(c[0]);
  $main.innerHTML = `<div class="wrap narrow"><a class="back" href="#/jobs">${BACK} All roles</a><section class="state"><h1 class="display">${c[0]}</h1><p>${c[1]}</p><div class="btn-row">${c[2]}</div></section></div>`;
  $main.querySelector('[data-retry]')?.addEventListener('click', () => rolePage(id));
  announce(c[0]);
}

const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

function tiles(r) {
  const t = [];
  const p = pay(r);
  if (p) t.push(['pay', p.replace(' an hour', ''), PERIOD[r.payPeriod] === 'an hour' ? 'an hour' : PERIOD[r.payPeriod] ?? 'Pay']);
  if (r.shift) t.push([shiftIcon(r.shift), human(SHIFT, r.shift), 'Shift']);
  t.push(['type', human(EMPLOYMENT, r.employmentType), 'Employment']);
  t.push(['place', r.location, 'Location']);
  if (t.length < 4 && r.validThrough) t.push(['date', day(r.validThrough), 'Open until']);
  return `<ul class="tiles" aria-label="Role at a glance">${t.slice(0, 4).map(([k, v, l]) => `<li class="tile">${icon(k)}<b>${esc(v)}</b><span>${esc(l)}</span></li>`).join('')}</ul>`;
}

function renderRole() {
  const r = view.role;
  setTitle(`${r.title} at ${r.employer}`);
  const reqLabel = { true: 'Needed to apply', false: 'Preferred' };
  $main.innerHTML = `<div class="wrap narrow"><article class="glance">
    <a class="back" href="#/jobs">${BACK} All roles</a>
    <div class="who"><span class="mono-tile">${esc(initials(r.employer))}</span><div><b>${esc(r.employer)}</b><span>${esc(r.freshness.label)}</span></div></div>
    <h1 class="display">${esc(r.title)}</h1>
    ${tiles(r)}
    <section class="verdict" id="verdict" aria-live="polite"></section>
    <div class="more">
      <details id="reqs"><summary><span>What’s required</span><span class="muted">${r.requirements.length}</span></summary>
        <ul class="reqs">${r.requirements.map((q) => `<li data-field="${esc(q.field)}"><b>${esc(q.label)}</b><span class="muted small">${reqLabel[q.required]}</span></li>`).join('')}</ul>
        <p class="source">${esc(r.employer)} reviews requirements and makes its own hiring decisions.</p></details>
      <details><summary><span>About the role</span></summary><div class="prose">${safeHtml(r.summaryHtml)}</div>
        <p class="source">Supplied by ${esc(r.employer)}. Last reviewed ${day(r.reviewedDate, true)}.${r.validThrough ? ` Open until ${day(r.validThrough)}.` : ''}</p></details>
    </div></article></div>`;
  renderVerdict();
}

function segs(m) {
  return `<div class="segs" aria-hidden="true">${m.lines.map((l) => `<i class="seg seg--${l.status === 'satisfied' ? 'ok' : l.status === 'human_review_required' ? 'review' : 'miss'}"></i>`).join('')}</div>`;
}

function renderVerdict() {
  const r = view.role;
  const $v = $main.querySelector('#verdict');
  if (!$v) return;
  $v.className = 'verdict';

  if (!r.apply.available) {
    $v.innerHTML = `<div class="v-text"><h2>Applications aren’t open on Rōvn.</h2><p>Nothing can be sent from this page.</p></div>`;
    return;
  }
  if (view.applyState === 'done') return renderReceipt($v);

  if (!session.signedIn) {
    $v.innerHTML = `<div class="v-text"><h2>Do you qualify?</h2><p>We’ll check this role’s ${r.requirements.length} requirements against your record. Nothing is sent to ${esc(r.employer)}.</p></div>
      <div class="v-act"><button class="btn btn--primary" data-signin>Check if I qualify ${ARROW}</button></div>`;
    $v.querySelector('[data-signin]').addEventListener('click', openSignIn);
    return;
  }
  if (view.matchState === 'loading' || view.matchState === 'idle') {
    $v.innerHTML = `<div class="v-text">${skel(30, 60)}<div style="height:10px"></div>${skel(16, 80)}</div><div class="v-act">${skel(48, 100)}</div>`;
    return;
  }
  if (view.matchState === 'error') {
    $v.innerHTML = `<div class="v-text"><h2>We couldn’t check your record.</h2><p>You can still apply, or try again.</p></div>
      <div class="v-act"><button class="btn btn--primary" data-apply>Apply for this role ${ARROW}</button><button class="btn btn--quiet" data-rematch>Try again</button></div>`;
    wireVerdict($v);
    return;
  }

  const m = view.match;
  const labels = Object.fromEntries(r.requirements.map((q) => [q.field, q.label]));
  const open = m.lines.filter((l) => l.status !== 'satisfied');
  const sending = view.applyState === 'submitting';
  const err = applyErrorHtml();
  const blocked = view.error?.code === 'role_not_open' || view.error?.code === 'application_scope_conflict';
  const applyLabel = sending ? 'Sending…<span class="spin" aria-hidden="true"></span>' : view.error ? `Try again ${ARROW}` : `Apply for this role ${ARROW}`;
  const meta = `<div class="v-meta">${segs(m)}<span>${m.met} of ${m.total} requirements met</span></div>`;

  if (!open.length) {
    $v.classList.add('verdict--ready');
    $v.innerHTML = `<div class="v-text">${meta}<h2>You meet every requirement.</h2><p>A person at ${esc(r.employer)} reviews your application and decides.</p>${err}</div>
      <div class="v-act">${blocked ? '' : `<button class="btn btn--primary" data-apply ${sending ? 'aria-disabled="true"' : ''}>${applyLabel}</button>`}</div>`;
  } else {
    const first = open[0];
    const review = first.status === 'human_review_required';
    const head = open.length === 1 ? (review ? 'Almost. One thing to add.' : 'Not yet. One thing missing.') : `Not yet. ${open.length} things missing.`;
    const why = first.wouldChangeIf ? `Changes if ${first.wouldChangeIf.charAt(0).toLowerCase()}${first.wouldChangeIf.slice(1)}` : 'Add it to your record to change this.';
    $v.innerHTML = `<div class="v-text">${meta}<h2>${head}</h2>
        <div class="gap"><span class="ico ${review ? 'ico--review' : 'ico--miss'}">${review ? EYE : DASH}</span><div><b>${esc(labels[first.field] ?? human({}, first.field))}</b><span>${esc(why)}</span></div></div>${err}</div>
      <div class="v-act"><button class="btn btn--primary" data-fix>${esc(NEXT[first.field] ?? 'Add it to your record')} ${ARROW}</button>
        ${blocked ? '' : `<button class="btn btn--secondary" data-apply ${sending ? 'aria-disabled="true"' : ''}>${sending ? applyLabel : view.error ? 'Try again' : 'Apply now'}</button>
        <p class="note">${review ? `${esc(r.employer)} can review it with your application.` : `You can still apply. ${esc(r.employer)} decides.`}</p>`}</div>`;
  }
  wireVerdict($v);
}

function wireVerdict($v) {
  $v.querySelector('[data-apply]')?.addEventListener('click', () => { if (view.applyState !== 'submitting') submit(); });
  $v.querySelector('[data-rematch]')?.addEventListener('click', loadMatch);
  $v.querySelector('[data-fix]')?.addEventListener('click', () => {
    // Real: opens the worker record to add the document (where that lives is B06). Prototype: simulate it being added.
    mockAddToRecord(view.role.id);
    announce('Prototype: added to your record. Checking again.');
    loadMatch();
  });
}

function applyErrorHtml() {
  const e = view.error;
  if (!e) return '';
  const r = view.role;
  if (e.code === 'role_not_open') return `<div class="alert alert--attention"><b>This role is no longer accepting applications.</b><span class="small">Your details weren’t sent. <a class="link" href="#/jobs">See current roles</a></span></div>`;
  if (e.code === 'application_scope_conflict') return `<div class="alert alert--attention"><b>You already have an application for this role.</b><span class="small">It was sent with different sharing settings, so nothing new was sent.</span></div>`;
  if (e.code === 'unconfirmed') return `<div class="alert alert--critical"><b>We couldn’t confirm your application.</b><span class="small">Don’t assume it was sent. Trying again won’t send it twice.</span></div>`;
  return `<div class="alert alert--critical"><b>Your application was not saved.</b><span class="small">Nothing was sent to ${esc(r.employer)}. Trying again won’t send it twice.</span></div>`;
}

function renderReceipt($v) {
  const a = view.receipt;
  $v.classList.add('verdict--sent');
  $v.innerHTML = `<div class="v-text"><span class="done-ico">${CHECK}</span><h2>Sent to the ${esc(a.destination)}.</h2>
      <p>${a.replayed ? 'You’d already applied, so this is the same application. ' : ''}A person on the hiring team reviews it and decides. This isn’t an offer.</p></div>
    <div class="v-act"><dl class="receipt"><div><dt>Receipt</dt><dd class="mono">${esc(a.receiptId.slice(0, 8))}</dd></div><div><dt>Sent</dt><dd>${time(a.submittedAt)}</dd></div></dl>
      <a class="btn btn--secondary" href="#/jobs">Back to roles</a></div>`;
  announce(`Application sent to the ${a.destination}. Receipt ${a.receiptId.slice(0, 8)}.`);
}

async function loadMatch() {
  view.matchState = 'loading'; renderVerdict();
  const res = await api.getMatch(view.role.id);
  if (res.status === 401) { session.signOut(); view.matchState = 'idle'; return renderVerdict(); }
  if (res.status !== 200) { view.matchState = 'error'; return renderVerdict(); }
  try { view.match = readMatch(res.body); view.matchState = 'ready'; } catch (e) { console.warn(e); view.matchState = 'error'; }
  markReqs();
  renderVerdict();
}

// Once signed in, the folded requirement list shows status per line.
function markReqs() {
  if (!view.match) return;
  for (const l of view.match.lines) {
    const li = $main.querySelector(`#reqs li[data-field="${CSS.escape(l.field)}"] .muted`);
    if (li) li.textContent = l.status === 'satisfied' ? 'Met' : l.status === 'human_review_required' ? 'To be reviewed' : 'Missing';
  }
}

async function submit() {
  view.applyState = 'submitting'; view.error = null; renderVerdict();
  const res = await api.apply(view.role.id);
  if (res.status === 200) {
    try { view.receipt = readApplication(res.body); view.applyState = 'done'; }
    catch (e) { console.warn(e); view.applyState = 'error'; view.error = { code: 'unconfirmed' }; }
    return renderVerdict();
  }
  if (res.status === 401) { session.signOut(); view.applyState = 'idle'; renderVerdict(); return openSignIn(); }
  view.applyState = 'error';
  view.error = res.status === 0 ? { code: 'unconfirmed' } : readError(res.status, res.body);
  renderVerdict();
  announce(view.error.code === 'role_not_open' ? 'This role is no longer accepting applications.' : 'Your application was not saved.');
}

// ---------------------------------------------------------------- sign in (stand-in until B06 decides where it lives)
const $dialog = document.getElementById('signin');
function openSignIn() {
  const r = view.role;
  $dialog.querySelector('[data-ctx]').innerHTML = r
    ? `<span class="mono-tile">${esc(r.employer.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span><div><b class="small" style="display:block">${esc(r.title)}</b><span class="xs muted">${esc(r.employer)}</span></div>` : '';
  $dialog.querySelector('#signin-h').textContent = r ? 'Sign in to apply.' : 'Sign in to see your matches.';
  $dialog.querySelector('#signin-h + p').textContent = r ? 'You’ll come straight back to this role.' : 'You’ll come straight back to the list.';
  $dialog.showModal();
}
$dialog.addEventListener('click', (e) => {
  if (e.target === $dialog || e.target.closest('[data-close]')) return $dialog.close();
  if (e.target.closest('[data-method]')) {
    session.signIn();
    $dialog.close();
    syncPanel();
    announce('Signed in. Back on the role.');
    if (view.role) loadMatch(); else route();
  }
});

// ---------------------------------------------------------------- skeleton + prototype panel
function skel(h, wPct) { return `<div class="skel" style="height:${h}px;width:${wPct}%"></div>`; }

const $panel = document.getElementById('proto');
function syncPanel() {
  $panel.querySelector('[name=list]').value = scenario.list;
  $panel.querySelector('[name=detail]').value = scenario.detail;
  $panel.querySelector('[name=apply]').value = scenario.apply;
  $panel.querySelector('[name=match]').value = scenario.match;
  $panel.querySelector('[name=signedin]').checked = session.signedIn;
}
$panel.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'signedin') { t.checked ? session.signIn() : session.signOut(); }
  else scenario[t.name] = t.value;
  sessionStorage.setItem('rovn-proto-scenario', JSON.stringify(scenario));
  route();
});
Object.assign(scenario, JSON.parse(sessionStorage.getItem('rovn-proto-scenario') || '{}'));
if (api.real()) $panel.hidden = true;
syncPanel();
route();
