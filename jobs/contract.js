// Readers for the A-03 website/backend contract (c-a03-web-handoff-v1).
// Each reader takes a raw response body and returns a plain object the page renders,
// or throws ContractError when a field the page depends on is missing or the wrong type.
// The page never fills a gap with a guess: a malformed response becomes an error state.

export class ContractError extends Error {
  constructor(where, message) {
    super(`${where}: ${message}`);
    this.name = 'ContractError';
  }
}

function need(obj, key, type, where) {
  const v = obj?.[key];
  const ok = type === 'array' ? Array.isArray(v) : type === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : typeof v === type;
  if (!ok) throw new ContractError(where, `expected ${key} to be ${type}`);
  return v;
}

function maybe(obj, key, type, where) {
  const v = obj?.[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== type) throw new ContractError(where, `expected ${key} to be ${type} or null`);
  return v;
}

function expectContract(body, name, where) {
  if (body?.contract !== name) throw new ContractError(where, `expected contract ${name}, got ${body?.contract ?? 'none'}`);
}

// GET /job-postings  (current public projection; not versioned by A-03)
export function readRoleList(body) {
  const where = 'job-postings';
  const rows = need(body, 'postings', 'array', where);
  return {
    ordering: need(body, 'ordering', 'string', where),
    roles: rows.map((r, i) => {
      const w = `${where}[${i}]`;
      return {
        id: need(r, 'id', 'string', w),
        title: need(r, 'title', 'string', w),
        employer: need(r, 'facility_name_snapshot', 'string', w),
        profession: need(r, 'role_key', 'string', w),
        city: maybe(r, 'location_city', 'string', w),
        state: need(r, 'location_state', 'string', w),
        employmentType: need(r, 'employment_type', 'string', w),
        shift: maybe(r, 'shift_type', 'string', w),
        payMin: maybe(r, 'compensation_min', 'string', w),
        payMax: maybe(r, 'compensation_max', 'string', w),
        payPeriod: maybe(r, 'compensation_period', 'string', w),
        publishedAt: need(r, 'published_at', 'string', w),
        validThrough: maybe(r, 'valid_through', 'string', w),
      };
    }),
  };
}

// GET /job-postings/{id}
export function readRoleDetail(body) {
  const where = 'role-detail';
  expectContract(body, 'c-a03-role-detail-v1', where);
  const loc = need(body, 'location', 'object', where);
  const fresh = need(body, 'freshness', 'object', where);
  const apply = need(body, 'apply', 'object', where);
  return {
    id: need(body, 'role_id', 'string', where),
    slug: need(body, 'slug', 'string', where),
    title: need(body, 'role_title', 'string', where),
    employer: need(body, 'employer_name', 'string', where),
    profession: need(body, 'profession', 'string', where),
    location: need(loc, 'display', 'string', `${where}.location`),
    employmentType: need(body, 'employment_type', 'string', where),
    summaryHtml: need(body, 'employer_approved_summary', 'string', where),
    requirements: need(body, 'employer_approved_requirements', 'array', where).map((q, i) => ({
      field: need(q, 'field', 'string', `${where}.requirements[${i}]`),
      label: need(q, 'label', 'string', `${where}.requirements[${i}]`),
      required: need(q, 'required', 'boolean', `${where}.requirements[${i}]`),
    })),
    reviewedDate: need(body, 'reviewed_date', 'string', where),
    validThrough: maybe(body, 'valid_through', 'string', where),
    freshness: {
      state: need(fresh, 'state', 'string', `${where}.freshness`),
      label: need(fresh, 'display_label', 'string', `${where}.freshness`),
    },
    apply: {
      mode: need(apply, 'mode', 'string', `${where}.apply`),
      available: need(apply, 'available', 'boolean', `${where}.apply`),
      requiresAuth: need(apply, 'requires_authentication', 'boolean', `${where}.apply`),
    },
  };
}

function readMatchLines(lines, where) {
  return lines.map((l, i) => {
    const w = `${where}.lines[${i}]`;
    return {
      field: need(l, 'field', 'string', w),
      required: need(l, 'required', 'boolean', w),
      status: need(l, 'status', 'string', w),
      reason: need(l, 'reason', 'string', w),
      evidence: need(l, 'evidence_class', 'string', w),
      receiptId: maybe(l, 'source_receipt_id', 'string', w),
      wouldChangeIf: maybe(l, 'would_change_if', 'string', w),
    };
  });
}

// GET /demand/worker/jobs/{id}/match
export function readMatch(body) {
  const where = 'match';
  expectContract(body, 'c-match-v1', where);
  return {
    contentHash: need(body, 'content_hash', 'string', where),
    met: need(body, 'met', 'number', where),
    total: need(body, 'total', 'number', where),
    lines: readMatchLines(need(body, 'lines', 'array', where), where),
    note: need(body, 'decision_note', 'string', where),
  };
}

// POST /demand/worker/jobs/{id}/applications
// Success is only success when a receipt id is present (contract rule 9 / acceptance test 9).
export function readApplication(body) {
  const where = 'apply';
  expectContract(body, 'c-apply-v1', where);
  const receipt = need(body, 'receipt', 'object', where);
  const receiptId = need(receipt, 'receipt_id', 'string', `${where}.receipt`);
  if (!receiptId) throw new ContractError(where, 'receipt_id is empty');
  if (need(body, 'status', 'string', where) !== 'submitted') throw new ContractError(where, 'status is not submitted');
  const match = need(body, 'match', 'object', where);
  return {
    applicationId: need(body, 'application_id', 'string', where),
    submittedAt: need(body, 'submitted_at', 'string', where),
    replayed: need(body, 'replayed', 'boolean', where),
    receiptId,
    destination: need(receipt, 'named_destination', 'string', `${where}.receipt`),
    humanGate: need(body, 'human_gate', 'string', where),
    match: { met: need(match, 'met', 'number', `${where}.match`), total: need(match, 'total', 'number', `${where}.match`) },
  };
}

// Error bodies: { detail: { code, message, retryable? } }
export function readError(status, body) {
  const d = body?.detail;
  return {
    status,
    code: typeof d?.code === 'string' ? d.code : status === 401 ? 'unauthenticated' : 'unknown',
    message: typeof d?.message === 'string' ? d.message : null,
    retryable: d?.retryable === true,
  };
}
