/* Rōvn record cards — the Matte kit (prototypes/record/cards_v3.py, direction A) as HTML.
   Every dimension is in em on a 1px-at-1440 basis: the host sets font-size: var(--s), so cards
   scale with the page. Text leaves set their own font-size in em; nothing else inside them does. */
(function () {
  const AMBER = 'linear-gradient(160deg, oklab(76% 0.085 0.135), oklab(66% 0.115 0.135))';
  const M = 'home/media/';

  const CARDS = {
    identity: { kind: 'identity', name: 'Renée Okafor', role: 'Family Nurse Practitioner', no: '0427', status: ['verified', 'ID verified'] },
    aprn: { kind: 'doc', tile: 'TX', issuer: 'Texas Board of Nursing', title: 'APRN license', sub: 'Family Nurse Practitioner', meta: '•••• 4821  ·  Exp 01/27', status: ['checked', 'Checked at source'] },
    dea: { kind: 'doc', tile: 'DEA', issuer: 'U.S. Drug Enforcement Administration', title: 'DEA registration', sub: 'Schedules II–V, Texas', meta: '•••• 7731  ·  Exp 08/27', status: ['checked', 'Checked at source'] },
    bls: { kind: 'doc', tile: 'AHA', issuer: 'American Heart Association', title: 'Basic Life Support', sub: 'Provider eCard', meta: '•••• 5520  ·  Exp 12/26', status: ['renew', 'Renews in 74 days'] },
    emp: { kind: 'doc', tile: 'HH', issuer: 'Previous employer', title: 'Home health NP', sub: 'Austin, TX  ·  2019–2025', meta: 'Confirmed by employer, Oct 3', status: ['confirmed', 'Confirmed'] },
    rn: { kind: 'doc', tile: 'TX', issuer: 'Texas Board of Nursing', title: 'RN license', sub: 'Multistate, Nurse Licensure Compact', meta: '•••• 3307  ·  Exp 01/27', status: ['checked', 'Checked at source'] },
    fnp: { kind: 'doc', tile: 'AANP', issuer: 'AANP Certification Board', title: 'Board certified, FNP-C', sub: 'Family Nurse Practitioner', meta: '•••• 1190  ·  Through 2029', status: ['checked', 'Checked at source'] },
    share: { kind: 'share', title: 'Quarrystone Family Medicine', sub: 'BLS, license and DEA', meta: 'Until Dec 3  ·  Revoke anytime', status: ['active', 'Active'] },
    // trust beat b: the same receipt on the dark identity face, without the document name
    shareDark: { kind: 'share', dark: true, title: 'Quarrystone Family Medicine', meta: 'Until Dec 3  ·  Revoke anytime', status: ['active', 'Active'] },
  };

  const FACE = {
    identity: 'background-image:linear-gradient(160deg, #222221, #0E0E0E)',
    shareDark: 'background-image:linear-gradient(160deg, #222221, #0E0E0E)',
    aprn: 'background:#FFFFFF', rn: 'background:#FFFFFF', dea: 'background:#E1E6E8', emp: 'background:#E8E0D1',
    bls: 'background-image:linear-gradient(160deg, #4A5840, #36412E)', fnp: 'background-image:linear-gradient(160deg, #4A5840, #36412E)',
    share: `background-image:${AMBER}`,
  };
  const DARK = new Set(['identity', 'bls', 'fnp', 'shareDark']);

  const dot = '<i class="cdot" aria-hidden="true"></i>';
  const ring = (dark) => `<i class="cring${dark ? ' cring--dark' : ''}" aria-hidden="true"></i>`;

  function chip([kind, label], dark) {
    let cls = 'chip-s', ic = '';
    if (kind === 'checked' || kind === 'verified' || kind === 'active') { cls += dark ? ' chip-s--glass' : ' chip-s--ink'; ic = dot; }
    else if (kind === 'renew') cls += ' chip-s--amber';
    else if (kind === 'confirmed') { cls += dark ? ' chip-s--glass' : ' chip-s--soft'; ic = dark ? ring(true) : '<i class="cdot cdot--ink" aria-hidden="true"></i>'; }
    else { cls += dark ? ' chip-s--glass' : ' chip-s--soft'; ic = ring(dark); }
    return `<span class="${cls}">${ic}<span class="chip-s__label">${label}</span></span>`;
  }

  const tile = (t, dark) => `<span class="ctile${dark ? ' ctile--dark' : ''}"><b class="${t.length > 2 ? 'is-long' : ''}">${t}</b></span>`;

  function html(key) {
    const c = CARDS[key]; if (!c) return '';
    const dark = DARK.has(key);
    let body = '';
    if (c.kind === 'identity') {
      body = `<div class="card__top"><img class="card__word" src="${M}wordmark-paper.svg" alt="Rōvn">${chip(c.status, true)}</div>
        <div class="card__bottom"><div class="card__who"><img class="card__photo" src="${M}portrait.jpg" alt="">
          <div class="card__col"><span class="card__title">${c.name}</span><span class="card__sub">${c.role}</span></div></div>
          <span class="card__no">No. ${c.no}</span></div>`;
    } else if (c.kind === 'share') {
      body = `<div class="card__top"><span class="card__kicker">Share receipt</span>${chip(c.status, dark)}</div>
        <div class="card__bottom"><div class="card__col card__col--share"><span class="card__title card__title--share">${c.title}</span>
          ${c.sub ? `<span class="card__sub">${c.sub}</span>` : ''}<span class="card__meta card__meta--strong">${c.meta}</span></div></div>`;
    } else {
      body = `<div class="card__top">${tile(c.tile, dark)}${chip(c.status, dark)}</div>
        <div class="card__bottom"><div class="card__col"><span class="card__issuer">${c.issuer}</span><span class="card__title">${c.title}</span>
          <span class="card__sub">${c.sub}</span><span class="card__meta">${c.meta}</span></div>
          <img class="card__mark" src="${M}${dark ? 'mark-paper' : 'mark-ink'}.svg" alt=""></div>`;
    }
    const label = c.kind === 'identity' ? `Rōvn ID, ${c.name}` : c.kind === 'share' ? `Share receipt, ${c.title}` : c.title;
    return `<div class="card card--${key}${dark ? ' card--dark' : ''}${c.kind === 'share' && !dark ? ' card--warm' : ''}" data-key="${key}" style="${FACE[key]}" role="img" aria-label="${label}">
      <span class="card__sheen" aria-hidden="true"></span>${body}</div>`;
  }

  // A cascade: back to front, each card shows its top 38px (the storyboards' -176px overlap).
  function stack(el, keys, reveal = 38) {
    el.style.setProperty('--n', keys.length);
    el.style.setProperty('--reveal', reveal);
    el.innerHTML = keys.map((k, i) => `<div class="fly" data-key="${k}" style="--i:${i}">${html(k)}</div>`).join('');
  }

  window.RovnCards = { html, stack, CARDS };
})();
