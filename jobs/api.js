// Transport for the jobs pages. Every call resolves to { status, body } so the page
// handles real and mock responses the same way.
//
// MOCK (default): answers from Anish's synthetic examples in ./fixtures, with the
// scenario switches in the prototype panel deciding which response comes back.
// REAL: set window.ROVN_API_BASE (e.g. 'https://api.rovn.to') before app.js loads.
// Sign-in is not wired for real yet (B06); the real adapter only sends cookies.

const SIGNED_IN_KEY = 'rovn-proto-signed-in';
const APPS_KEY = 'rovn-proto-applications';

export const scenario = {
  list: 'filled',      // filled | empty | unreachable | malformed
  detail: 'ready',     // ready | slow | not_found | unavailable | malformed
  apply: 'success',    // success | role_not_open | scope_conflict | not_saved | malformed
};

export const session = {
  get signedIn() { return sessionStorage.getItem(SIGNED_IN_KEY) === '1'; },
  signIn() { sessionStorage.setItem(SIGNED_IN_KEY, '1'); },
  signOut() { sessionStorage.removeItem(SIGNED_IN_KEY); sessionStorage.removeItem(APPS_KEY); },
};

let fixtures = null;
async function load() {
  if (!fixtures) {
    const [a03, list] = await Promise.all([
      fetch('./fixtures/a03-contract-examples.synthetic.json').then((r) => r.json()),
      fetch('./fixtures/job-postings.synthetic.json').then((r) => r.json()),
    ]);
    fixtures = { a03, list };
  }
  return fixtures;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));
const LABEL = { full_time: 'full_time', part_time: 'part_time' };

// Roles other than the contract's example are synthesized from the list row,
// in the target A-03 shape, so every row in the prototype opens a working page.
function synthDetail(a03, row) {
  const d = clone(a03.role_detail.success.body);
  Object.assign(d, {
    role_id: row.id, slug: row.id, role_title: row.title, employer_name: row.facility_name_snapshot,
    profession: row.role_key, employment_type: LABEL[row.employment_type] ?? row.employment_type,
    valid_through: row.valid_through, published_at: row.published_at,
    tested_application_route: `/demand/worker/jobs/${row.id}/applications`,
  });
  d.location = { city: row.location_city, state: row.location_state, display: `${row.location_city}, ${row.location_state}` };
  d.employer_approved_requirements = d.employer_approved_requirements.map((q) =>
    q.field === 'state_license' ? { ...q, label: `Active Georgia ${row.role_key} license` } : q);
  return d;
}

async function mockGet(path) {
  const { a03, list } = await load();
  await wait(scenario.detail === 'slow' && path !== '/job-postings' ? 2200 : 350);

  if (path === '/job-postings') {
    if (scenario.list === 'unreachable') return { status: 503, body: { detail: { code: 'role_service_unavailable', message: 'Roles are temporarily unavailable.', retryable: true } } };
    if (scenario.list === 'malformed') return { status: 200, body: { postings: 'oops' } };
    const body = clone(list);
    if (scenario.list === 'empty') body.postings = [];
    return { status: 200, body };
  }

  const detail = path.match(/^\/job-postings\/([^/]+)$/);
  if (detail) {
    const row = list.postings.find((p) => p.id === detail[1]);
    if (scenario.detail === 'not_found' || !row) return clone(a03.role_detail.never_public_or_unknown);
    if (scenario.detail === 'unavailable') return clone(a03.role_detail.recoverable_failure);
    const body = row.id === a03.role_detail.success.body.role_id ? clone(a03.role_detail.success.body) : synthDetail(a03, row);
    if (scenario.detail === 'malformed') delete body.reviewed_date;
    return { status: 200, body };
  }

  const match = path.match(/^\/demand\/worker\/jobs\/([^/]+)\/match$/);
  if (match) {
    if (!session.signedIn) return { status: 401, body: { detail: 'Not authenticated' } };
    const body = clone(a03.match.success.body);
    body.requisition_id = match[1];
    return { status: 200, body };
  }
  return { status: 404, body: { detail: { code: 'not_found', message: 'Not found.' } } };
}

async function mockPost(path) {
  const { a03 } = await load();
  await wait(700);
  const m = path.match(/^\/demand\/worker\/jobs\/([^/]+)\/applications/);
  if (!m) return { status: 404, body: {} };
  if (!session.signedIn) return { status: 401, body: { detail: 'Not authenticated' } };
  const ex = a03.apply;
  if (scenario.apply === 'role_not_open') return clone(ex.role_no_longer_open);
  if (scenario.apply === 'scope_conflict') return clone(ex.different_consent_scope_on_retry);
  if (scenario.apply === 'not_saved') return clone(ex.recoverable_failure);

  // Idempotent: an exact retry returns the same application and receipt, replayed: true.
  const apps = JSON.parse(sessionStorage.getItem(APPS_KEY) || '{}');
  const body = clone(ex.success.body);
  body.requisition_id = m[1];
  if (apps[m[1]]) Object.assign(body, ex.exact_retry.body_delta_from_success);
  apps[m[1]] = true;
  sessionStorage.setItem(APPS_KEY, JSON.stringify(apps));
  if (scenario.apply === 'malformed') body.receipt = { receipt_id: '', named_destination: body.receipt.named_destination };
  return { status: 200, body };
}

async function realCall(method, path) {
  try {
    const r = await fetch(window.ROVN_API_BASE + path, { method, credentials: 'include', headers: { Accept: 'application/json' } });
    let body = null;
    try { body = await r.json(); } catch { /* non-JSON body */ }
    return { status: r.status, body };
  } catch {
    return { status: 0, body: null }; // network failure: treated like 503, nothing confirmed
  }
}

const isReal = () => typeof window !== 'undefined' && !!window.ROVN_API_BASE;

export const api = {
  real: isReal,
  listRoles: () => (isReal() ? realCall('GET', '/job-postings?limit=100') : mockGet('/job-postings')),
  getRole: (id) => (isReal() ? realCall('GET', `/job-postings/${encodeURIComponent(id)}`) : mockGet(`/job-postings/${id}`)),
  getMatch: (id) => (isReal() ? realCall('GET', `/demand/worker/jobs/${encodeURIComponent(id)}/match`) : mockGet(`/demand/worker/jobs/${id}/match`)),
  apply: (id) => {
    const p = `/demand/worker/jobs/${encodeURIComponent(id)}/applications?consent_scope=identity_opportunity_fit_application_status`;
    return isReal() ? realCall('POST', p) : mockPost(p);
  },
};
