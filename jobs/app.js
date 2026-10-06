// Jobs pages: /jobs (P06) and /jobs/{slug} (P07), hash-routed for the prototype.
import { api, scenario, session } from './api.js';
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
  setTitle('Healthcare roles');
  $main.innerHTML = `<div class="wrap"><div class="list-head">${skel(56, 60)}${skel(20, 70)}</div>${[1, 2, 3, 4].map(() => `<div style="padding:24px 0">${skel(20, 45)}<div style="height:8px"></div>${skel(16, 30)}</div>`).join('')}</div>`;
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

function renderList(q) {
  const n = listCache.roles.length;
  $main.innerHTML = `<div class="wrap">
    <div class="list-head"><h1 class="display">Find work worth moving for.</h1>
      <p>See the role, the organization, the requirements and the next step before you decide to apply.</p></div>
    <div class="toolbar">
      <div class="search" role="search">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <label class="sr-only" for="q">Search roles</label>
        <input id="q" type="search" placeholder="Search by role, organization or city" value="${esc(q)}" autocomplete="off">
      </div>
      <p class="count" id="count" aria-live="polite"></p>
    </div>
    <div id="results"></div>
    <p class="note" style="margin-top:24px">Newest first. Roles are never ranked by who you are.</p>
  </div>`;
  const $q = $main.querySelector('#q');
  let t;
  $q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const v = $q.value.trim();
      history.replaceState(null, '', v ? `#/jobs?q=${encodeURIComponent(v)}` : '#/jobs');
      renderRows(v);
    }, 150);
  });
  renderRows(q);
  void n;
}

function renderRows(q) {
  const needle = q.toLowerCase();
  const rows = listCache.roles.filter((r) => !needle || [r.title, r.employer, r.city, r.state, r.profession].join(' ').toLowerCase().includes(needle));
  const total = listCache.roles.length;
  $main.querySelector('#count').textContent = q ? `${rows.length} of ${total} roles` : `${total} open roles`;
  const $r = $main.querySelector('#results');
  if (!rows.length) {
    $r.innerHTML = `<div class="state" style="padding:48px 0"><h2 class="section">No roles match “${esc(q)}”.</h2><p class="muted">Try a role, organization or city.</p><div class="btn-row"><button class="btn btn--secondary" data-clear>Clear search</button></div></div>`;
    $r.querySelector('[data-clear]').addEventListener('click', () => { const i = $main.querySelector('#q'); i.value = ''; i.dispatchEvent(new Event('input')); i.focus(); });
    return;
  }
  $r.innerHTML = `<ul class="rows">${rows.map((r) => {
    const p = pay(r);
    return `<li><a class="row" href="#/jobs/${encodeURIComponent(r.id)}">
      <div><div class="row__title">${esc(r.title)}</div><div class="row__sub">${esc(r.employer)} · ${esc([r.city, r.state].filter(Boolean).join(', '))}</div></div>
      <div class="row__meta"><b>${esc(human(EMPLOYMENT, r.employmentType))}${r.shift ? ' · ' + esc(human(SHIFT, r.shift)) : ''}</b>${p ? `<span>${esc(p)}</span>` : ''}<span>Posted ${day(r.publishedAt)}</span></div>
    </a></li>`;
  }).join('')}</ul>`;
}

// ---------------------------------------------------------------- role (P07)
const view = { role: null, match: null, matchState: 'idle', applyState: 'idle', receipt: null, error: null };

async function rolePage(id) {
  Object.assign(view, { role: null, match: null, matchState: 'idle', applyState: 'idle', receipt: null, error: null });
  $main.innerHTML = `<div class="wrap"><div class="role"><div class="role__head">${skel(16, 20)}<div style="height:12px"></div>${skel(52, 60)}${skel(22, 45)}</div>
    <div class="role__aside"><div class="card">${skel(120, 100)}${skel(48, 100)}</div></div><div class="role__body">${skel(18, 90)}${skel(18, 80)}${skel(18, 85)}</div></div></div>`;
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
  $main.innerHTML = `<div class="wrap"><a class="back" href="#/jobs">${BACK} All roles</a><section class="state"><h1 class="display">${c[0]}</h1><p>${c[1]}</p><div class="btn-row">${c[2]}</div></section></div>`;
  $main.querySelector('[data-retry]')?.addEventListener('click', () => rolePage(id));
  announce(c[0]);
}

function renderRole() {
  const r = view.role;
  setTitle(`${r.title} at ${r.employer}`);
  const reqLabel = { true: 'Needed to apply', false: 'Preferred' };
  $main.innerHTML = `<div class="wrap"><article class="role">
    <header class="role__head">
      <a class="back" href="#/jobs">${BACK} All roles</a>
      <h1 class="display">${esc(r.title)}</h1>
      <p class="role__meta">${esc(r.employer)} · ${esc(r.location)} · ${esc(human(EMPLOYMENT, r.employmentType))}</p>
      ${freshTag(r)}
    </header>
    <aside class="role__aside" aria-label="Apply"><div class="card" id="apply"></div></aside>
    <div class="role__body">
      <section><h2 class="section">The role at a glance.</h2><div class="prose">${safeHtml(r.summaryHtml)}</div>
        <p class="source">Details supplied by ${esc(r.employer)}. Last reviewed ${day(r.reviewedDate, true)}.</p></section>
      <section><h2 class="section">What you’ll need.</h2>
        <ul class="reqs">${r.requirements.map((q) => `<li><b>${esc(q.label)}</b><span class="muted small">${reqLabel[q.required]}</span></li>`).join('')}</ul>
        <p class="source">${esc(r.employer)} reviews requirements and makes its own hiring and start decisions.</p></section>
      <section><h2 class="section">What happens after you apply.</h2>
        <p class="prose">You see what’s shared and who receives it, send it, and keep the receipt. Interviews, offers and onboarding follow ${esc(r.employer)}’s process.</p></section>
      <section><h2 class="section">Questions.</h2><dl class="faq">
        <dt>Who will receive my application?</dt><dd>The ${esc(r.employer)} hiring team, named before you send anything.</dd>
        <dt>Is my information sent when I view this page?</dt><dd>No. Viewing a role is separate from applying.</dd></dl></section>
    </div></article></div>`;
  renderApply();
}

function freshTag(r) {
  if (r.freshness.state === 'confirmed_open') return `<span class="tag"><i></i>${esc(r.freshness.label)}</span>`;
  return `<span class="tag tag--warn"><i></i>${esc(r.freshness.label)}</span>`;
}

function factsHtml(r) {
  const rows = [['Employment', human(EMPLOYMENT, r.employmentType)], ['Location', r.location]];
  if (r.validThrough) rows.push(['Open until', day(r.validThrough)]);
  rows.push(['Last reviewed', day(r.reviewedDate, true)]);
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

function renderApply() {
  const r = view.role;
  const $c = $main.querySelector('#apply');
  if (!$c) return;
  const facts = factsHtml(r);

  if (!r.apply.available) {
    $c.innerHTML = `${facts}<div class="alert alert--neutral"><b>Applications aren’t open on Rōvn for this role.</b><span class="small">Nothing can be sent from this page.</span></div>`;
    return;
  }
  if (view.applyState === 'done') return renderReceipt($c);

  if (!session.signedIn) {
    $c.innerHTML = `${facts}<div class="split"></div>
      <button class="btn btn--primary" data-signin>Sign in to apply ${ARROW}</button>
      <p class="note">After you sign in you’ll see which of this role’s requirements you meet. It explains the requirements and never ranks people.</p>`;
    $c.querySelector('[data-signin]').addEventListener('click', openSignIn);
    return;
  }

  let match = '';
  if (view.matchState === 'loading') match = `${skel(32, 50)}${skel(40, 100)}${skel(40, 100)}`;
  else if (view.matchState === 'error') match = `<div class="alert alert--neutral"><b>Your match couldn’t load.</b><span class="small">You can still apply. <button class="btn btn--quiet btn--sm" data-rematch>Try again</button></span></div>`;
  else if (view.match) match = matchHtml(view.match, r);

  const err = applyErrorHtml();
  const sending = view.applyState === 'submitting';
  const blocked = view.error?.code === 'role_not_open' || view.error?.code === 'application_scope_conflict';
  const button = blocked ? '' : `<button class="btn btn--primary" data-apply ${sending ? 'aria-disabled="true"' : ''}>${sending ? 'Sending…<span class="spin" aria-hidden="true"></span>' : view.error ? `Try again ${ARROW}` : `Apply for this role ${ARROW}`}</button>`;
  $c.innerHTML = `${facts}<div class="split"></div>${match}${err}${button}
    ${blocked ? '' : `<p class="note">Applying shares your identity, how you fit this role and your application status with the ${esc(r.employer)} hiring team.</p>`}`;
  $c.querySelector('[data-apply]')?.addEventListener('click', () => { if (!sending) submit(); });
  $c.querySelector('[data-rematch]')?.addEventListener('click', loadMatch);
}

function matchHtml(m, r) {
  const labels = Object.fromEntries(r.requirements.map((q) => [q.field, q.label]));
  const line = (l) => {
    const ok = l.status === 'satisfied';
    const review = l.status === 'human_review_required';
    const ico = ok ? `<span class="ico ico--ok">${CHECK}</span>` : review ? `<span class="ico ico--review">${EYE}</span>` : `<span class="ico ico--miss">${DASH}</span>`;
    const status = ok ? (l.evidence === 'source_confirmed' ? 'Confirmed at the source' : 'Met') : review ? `A person at ${r.employer} will review it` : 'Not shown yet';
    return `<li>${ico}<div><b>${esc(labels[l.field] ?? human({}, l.field))}</b><span>${status}</span>${l.wouldChangeIf ? `<div class="change">${esc(l.wouldChangeIf)}</div>` : ''}</div></li>`;
  };
  return `<div class="met"><strong>${m.met} of ${m.total}</strong><span class="muted small">requirements met</span></div>
    <ul class="lines">${m.lines.map(line).join('')}</ul>`;
}

function applyErrorHtml() {
  const e = view.error;
  if (!e) return '';
  if (e.code === 'role_not_open') return `<div class="alert alert--attention"><b>This role is no longer accepting applications.</b><span class="small">Your details weren’t sent.</span><a class="link small" href="#/jobs">See current roles</a></div>`;
  if (e.code === 'application_scope_conflict') return `<div class="alert alert--attention"><b>You already have an application for this role.</b><span class="small">It was sent with different sharing settings, so nothing new was sent.</span></div>`;
  if (e.code === 'unconfirmed') return `<div class="alert alert--critical"><b>We couldn’t confirm your application.</b><span class="small">Don’t assume it was sent. Trying again won’t send it twice.</span></div>`;
  return `<div class="alert alert--critical"><b>Your application was not saved.</b><span class="small">${esc(e.message ?? 'Nothing was sent.')} Trying again won’t send it twice.</span></div>`;
}

function renderReceipt($c) {
  const a = view.receipt;
  $c.innerHTML = `<span class="done-ico">${CHECK}</span>
    <h2>Sent to the ${esc(a.destination)}.</h2>
    ${a.replayed ? '<p class="small muted">You’d already applied. This is the same application, not a new one.</p>' : ''}
    <dl class="receipt"><div><dt>Receipt</dt><dd class="mono">${esc(a.receiptId.slice(0, 8))}</dd></div>
      <div><dt>Sent</dt><dd>${time(a.submittedAt)}</dd></div><div><dt>Your match when sent</dt><dd>${a.match.met} of ${a.match.total}</dd></div></dl>
    <p class="small">${esc(a.humanGate)}</p>
    <a class="btn btn--secondary" href="#/jobs">Back to roles</a>`;
  announce(`Application sent to the ${a.destination}. Receipt ${a.receiptId.slice(0, 8)}.`);
}

async function loadMatch() {
  view.matchState = 'loading'; renderApply();
  const res = await api.getMatch(view.role.id);
  if (res.status === 401) { session.signOut(); view.matchState = 'idle'; return renderApply(); }
  if (res.status !== 200) { view.matchState = 'error'; return renderApply(); }
  try { view.match = readMatch(res.body); view.matchState = 'ready'; } catch (e) { console.warn(e); view.matchState = 'error'; }
  renderApply();
}

async function submit() {
  view.applyState = 'submitting'; view.error = null; renderApply();
  const res = await api.apply(view.role.id);
  if (res.status === 200) {
    try {
      view.receipt = readApplication(res.body);
      view.applyState = 'done';
    } catch (e) {
      console.warn(e);
      view.applyState = 'error'; view.error = { code: 'unconfirmed' };
    }
    return renderApply();
  }
  if (res.status === 401) { session.signOut(); view.applyState = 'idle'; renderApply(); return openSignIn(); }
  view.applyState = 'error';
  view.error = res.status === 0 ? { code: 'unconfirmed' } : readError(res.status, res.body);
  renderApply();
  announce(view.error.code === 'role_not_open' ? 'This role is no longer accepting applications.' : 'Your application was not saved.');
}

// ---------------------------------------------------------------- sign in (stand-in until B06 decides where it lives)
const $dialog = document.getElementById('signin');
function openSignIn() {
  const r = view.role;
  $dialog.querySelector('[data-ctx]').innerHTML = r
    ? `<span class="mono-tile">${esc(r.employer.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span><div><b class="small" style="display:block">${esc(r.title)}</b><span class="xs muted">${esc(r.employer)}</span></div>` : '';
  $dialog.showModal();
}
$dialog.addEventListener('click', (e) => {
  if (e.target === $dialog || e.target.closest('[data-close]')) return $dialog.close();
  if (e.target.closest('[data-method]')) {
    session.signIn();
    $dialog.close();
    syncPanel();
    announce('Signed in. Back on the role.');
    if (view.role) loadMatch();
  }
});

// ---------------------------------------------------------------- skeleton + prototype panel
function skel(h, wPct) { return `<div class="skel" style="height:${h}px;width:${wPct}%"></div>`; }

const $panel = document.getElementById('proto');
function syncPanel() {
  $panel.querySelector('[name=list]').value = scenario.list;
  $panel.querySelector('[name=detail]').value = scenario.detail;
  $panel.querySelector('[name=apply]').value = scenario.apply;
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
