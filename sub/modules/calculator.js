/* Rōvn subpage module · calculator. One question at a time; the "So far" card fills in as you answer;
   the result keeps cash, capacity and contribution separate (they are never summed). Registered with sub.js. */
(window.RovnSubModules = window.RovnSubModules || []).push({
  name: 'calculator',
  init(K) {
    const { gsap, R, $, $$ } = K;
    const root = $('.calc');
    if (!root) return;

    /* ------------------------------------------------------------ model */
    const N = 5, RESULT = N;
    const v = { hours: 300, premium: 38, hires: 10, hpHire: 6, shifts: 8, perShift: 650, ramp: 3, period: 6 };
    const RANGE = { hours: [1, 50000], premium: [1, 500], hires: [1, 1000], hpHire: [1, 100], shifts: [1, 5000], perShift: [1, 100000], ramp: [0, 12], period: [1, 36], setup: [0, 10000000], monthly: [0, 1000000] };
    const STEP_KEY = ['hours', 'premium', 'hires', 'shifts', 'ramp'];
    const costs = { setup: null, monthly: null };
    const answered = [false, false, false, false, false];
    let cur = 0, seenResult = false, busy = null;

    const n0 = (x) => Math.round(x).toLocaleString('en-US');
    const usd = (x) => '$' + n0(x);
    const calc = () => {
      const cash = v.hours * v.premium, cap = v.hires * v.hpHire, con = v.shifts * v.perShift;
      return { cash, cap, con };
    };
    // month by month: output builds in even steps to full ramp; the quote is paid in full from month 1
    function ledger() {
      const { cash } = calc();
      let cum = -costs.setup, payback = null, pcts = [];
      for (let m = 1; m <= v.period; m++) {
        const pct = m > v.ramp ? 1 : m / (v.ramp + 1);
        pcts.push(pct);
        cum += cash * pct - costs.monthly;
        if (payback === null && cum >= 0) payback = m;
      }
      return { net: cum, payback, pcts };
    }
    const parse = (s) => { s = String(s).replace(/[\s,$]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN; return parseFloat(s); };
    const inRange = (key, x) => Number.isFinite(x) && x >= RANGE[key][0] && x <= RANGE[key][1];
    const rangeMsg = (key) => `Try a number from ${n0(RANGE[key][0])} to ${n0(RANGE[key][1])}.`;

    /* ------------------------------------------------------------ motion helpers */
    function count(el, to, fmt, from) {
      if (el.__t) el.__t.kill();
      const start = from === undefined ? (el.__v ?? 0) : from;
      el.__v = to;
      if (R.reduce || start === to) { el.textContent = fmt(to); return; }
      const o = { x: start };
      el.__t = gsap.to(o, { x: to, duration: 0.6, ease: 'expo.out', onUpdate: () => { el.textContent = fmt(Math.round(o.x)); }, onComplete: () => { el.textContent = fmt(to); } });
    }
    const rise = (els, { y = 8, ...vars } = {}) => { if (!R.reduce) gsap.fromTo(els, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', ...vars }); };

    /* ------------------------------------------------------------ progress pills */
    const panels = $$('.cp', root);
    const side = { sf: $('.sf', root), res: $('.cside', root) };
    function pillState(p, step, label) {
      $$('.cpro__pill', p).forEach((b, i) => {
        b.classList.toggle('is-now', step === i);
        b.classList.toggle('is-done', step === RESULT || (step !== i && (answered[i] || i < step)));
        b.disabled = !(b.classList.contains('is-done'));
        b.tabIndex = b.disabled ? -1 : 0;
      });
      $('.cpro__txt', p).textContent = label;
    }
    const labelFor = (i) => (i === RESULT ? 'Done. Three results, never added together.' : `Step ${i + 1} of ${N}`);
    panels.forEach((p) => {
      const wrap = $('.cpro__pills', p);
      for (let i = 0; i < N; i++) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cpro__pill'; b.setAttribute('aria-label', `Go to step ${i + 1}`);
        b.addEventListener('click', () => { if (!b.disabled) go(i, { edit: seenResult }); });
        wrap.append(b);
      }
      pillState(p, +p.dataset.step, labelFor(+p.dataset.step));
    });
    const stepOf = (p) => +p.dataset.step;
    panels.forEach((p) => { if (stepOf(p) !== cur) p.setAttribute('inert', ''); });

    /* ------------------------------------------------------------ "So far" card */
    const rows = $$('.sfr', root);
    const info = {
      cash: () => [calc().cash, usd, 'agency premium avoided'],
      cap: () => [calc().cap, (x) => n0(x) + ' h', 'credentialing time back'],
      con: () => [calc().con, usd, 'from uncovered shifts filled'],
    };
    function updateSoFar() {
      rows.forEach((r) => {
        const k = r.dataset.row, st = +r.dataset.step; // the question that completes this row
        const show = answered[st] || cur === st || cur === RESULT;
        const [val, fmt, desc] = info[k]();
        const n = $('.sfr__n', r);
        r.classList.toggle('is-live', cur === st);
        if (show) {
          const first = !r.classList.contains('is-full');
          r.classList.add('is-full');
          $('.sfr__d', r).textContent = desc;
          if (first) { count(n, val, fmt, 0); rise($('.sfr__val', r), { y: 6 }); } else count(n, val, fmt);
        } else { r.classList.remove('is-full'); n.__v = 0; n.textContent = ''; }
      });
    }

    /* ------------------------------------------------------------ result */
    const fmtVal = [
      () => `${n0(v.hours)} a month`,
      () => `$${n0(v.premium)} an hour`,
      () => `${n0(v.hires)} a month, ${n0(v.hpHire)} h saved each`,
      () => `${n0(v.shifts)} a month at ${usd(v.perShift)}`,
      () => `${n0(v.ramp)} month${v.ramp === 1 ? '' : 's'}, over ${n0(v.period)}`,
    ];
    function updateResult(animate) {
      const c = calc();
      const set = { cash: [c.cash, usd, `${n0(v.hours)} h × ${usd(v.premium)}`], cap: [c.cap, (x) => n0(x) + ' h', `${n0(v.hires)} hires × ${n0(v.hpHire)} h`], con: [c.con, usd, `${n0(v.shifts)} shifts × ${usd(v.perShift)}`] };
      Object.keys(set).forEach((k) => { $(`[data-f="${k}"]`, root).textContent = set[k][2]; count($(`[data-n="${k}"]`, root), set[k][0], set[k][1], animate ? 0 : undefined); });
      $$('[data-a]', root).forEach((el) => { el.textContent = fmtVal[+el.dataset.a](); });
      renderNet(animate);
    }
    const netEl = $('.net', root);
    function renderNet(animate) {
      const known = costs.setup !== null && costs.monthly !== null;
      if (!known) { if (netEl.dataset.state === 'result') netEl.dataset.state = 'unknown'; return; }
      const L = ledger();
      count($('.net__n', netEl), Math.round(L.net), (x) => (x < 0 ? '−' : '') + usd(Math.abs(x)), animate ? 0 : undefined);
      $('.net__d', netEl).textContent = `over ${n0(v.period)} months`;
      $('.net__pay', netEl).textContent = L.payback ? `Pays back in month ${L.payback}.` : `Not paid back within ${n0(v.period)} months.`;
      const steps = L.pcts.filter((p) => p < 1).map((p) => Math.round(p * 100) + '%');
      $('.net__note', netEl).textContent = `${usd(costs.setup)} setup, then ${usd(costs.monthly)} a month. Output ramps ${steps.concat('100%').join(', ')}.`;
      netEl.dataset.state = 'result';
    }
    const netInputs = $$('.nf__i', root), netMsg = $('.net__msg', root);
    function setNet(state) {
      netEl.dataset.state = state;
      if (state === 'edit') { netInputs[0].focus({ preventScroll: true }); }
      rise($$('.net__s', netEl).filter((s) => getComputedStyle(s).display !== 'none'), { y: 4, duration: 0.5 });
    }
    function saveNet() {
      const vals = {};
      for (const i of netInputs) {
        const key = i.dataset.ckey, raw = i.value.trim() === '' ? i.placeholder : i.value;
        const x = parse(raw);
        if (!inRange(key, x)) { netMsg.textContent = rangeMsg(key).replace(/^Try a number/, 'Try a number'); i.focus({ preventScroll: true }); return; }
        vals[key] = x;
      }
      netMsg.textContent = '';
      costs.setup = vals.setup; costs.monthly = vals.monthly;
      renderNet(true);
      rise($$('.net__s--result > *', netEl), { y: 6, stagger: 0.05 });
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-net]');
      if (!b) return;
      const a = b.dataset.net;
      if (a === 'edit') { netInputs[0].value = costs.setup === null ? '' : String(costs.setup); netInputs[1].value = costs.monthly === null ? '' : String(costs.monthly); netMsg.textContent = ''; setNet('edit'); }
      else if (a === 'cancel') setNet(costs.setup !== null ? 'result' : 'unknown');
      else if (a === 'save') saveNet();
    });
    netInputs.forEach((i, idx) => i.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (idx === 0) netInputs[1].focus({ preventScroll: true }); else saveNet(); }
      if (e.key === 'Escape') setNet(costs.setup !== null ? 'result' : 'unknown');
    }));
    netInputs.forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/[^\d.,$ ]/g, ''); netMsg.textContent = ''; }));

    // edit links jump back to their question
    $$('[data-edit]', root).forEach((b) => b.addEventListener('click', () => go(+b.dataset.edit, { edit: true })));

    // CSV (a text link): inputs, the three results and the month-by-month ledger when costs are known
    $('[data-csv]', root).addEventListener('click', () => {
      const c = calc(), q = (s) => `"${String(s).replace(/"/g, '""')}"`;
      const out = [['Item', 'Value'], ['Agency hours covered a month', v.hours], ['Premium over staff rate, $ an hour', v.premium], ['Hires a month', v.hires], ['Hours saved per hire', v.hpHire],
        ['Uncovered shifts filled a month', v.shifts], ['Contribution per shift, $', v.perShift], ['Months to full ramp', v.ramp], ['Period, months', v.period],
        ['Cash, $ a month at full ramp', c.cash], ['Capacity, hours a month', c.cap], ['Contribution, $ a month', c.con]];
      if (costs.setup !== null) { const L = ledger(); out.push(['Setup cost, $', costs.setup], ['Quote, $ a month', costs.monthly], ['Net cash over period, $', Math.round(L.net)], ['Payback month', L.payback || 'Not within period']); }
      const blob = new Blob([out.map((r) => r.map(q).join(',')).join('\n') + '\n'], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rovn-roi.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    /* ------------------------------------------------------------ inputs */
    const msgOn = (p, text) => { const m = $('.cin__msg', p); if (text) m.textContent = text; m.classList.toggle('is-on', !!text); };
    function wireInput(p) {
      const i = $('.cin__i', p), key = i.dataset.key;
      i.addEventListener('input', () => {
        const clean = i.value.replace(/[^\d.,]/g, '');
        if (clean !== i.value) i.value = clean;
        const x = parse(i.value);
        if (i.value === '' || inRange(key, x)) { msgOn(p, ''); if (i.value !== '') { v[key] = x; updateSoFar(); } } else msgOn(p, rangeMsg(key));
      });
      i.addEventListener('focus', () => requestAnimationFrame(() => i.select()));
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
    }
    // the assumption line: the sentence's number turns into a small field
    function wireAssume(p) {
      const as = $('.as', p); if (!as) return;
      const key = as.dataset.akey, val = $('.as__v', as), btn = $('.as__chg', as), pre = val.dataset.pre;
      let input = null;
      const commit = () => {
        if (!input) return true;
        const raw = input.value.trim() === '' ? String(v[key]) : input.value, x = parse(raw);
        if (!inRange(key, x)) { as.classList.add('is-bad'); msgOn(p, rangeMsg(key)); input.focus({ preventScroll: true }); return false; }
        v[key] = x; as.classList.remove('is-bad'); msgOn(p, '');
        val.textContent = pre + n0(x); input = null; btn.textContent = 'Change'; updateSoFar();
        return true;
      };
      btn.addEventListener('click', () => {
        if (input) { commit(); return; }
        input = document.createElement('input');
        input.className = 'as__i'; input.type = 'text'; input.inputMode = 'decimal'; input.value = String(v[key]); input.setAttribute('aria-label', 'Assumption');
        val.textContent = ''; val.append(input); btn.textContent = 'Done'; input.focus({ preventScroll: true }); input.select();
        input.addEventListener('input', () => { input.value = input.value.replace(/[^\d.,]/g, ''); as.classList.remove('is-bad'); msgOn(p, ''); const x = parse(input.value); if (inRange(key, x)) { v[key] = x; updateSoFar(); } });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); $('.cin__i', p).focus({ preventScroll: true }); } });
      });
      p.__commitAssume = commit;
    }

    /* ------------------------------------------------------------ steps */
    function validateCurrent() {
      const p = panels[cur], i = $('.cin__i', p), key = i.dataset.key;
      if (i.value.trim() === '') i.value = i.placeholder; // gentle: an empty answer keeps the example
      const x = parse(i.value);
      if (!inRange(key, x)) { msgOn(p, rangeMsg(key)); i.focus({ preventScroll: true }); return false; }
      if (p.__commitAssume && !p.__commitAssume()) return false;
      v[key] = x; msgOn(p, '');
      return true;
    }
    function next() {
      if (cur >= N || busy) return;
      if (!validateCurrent()) return;
      answered[cur] = true;
      go(seenResult || cur === N - 1 ? RESULT : cur + 1);
    }
    function back() { if (cur > 0 && cur < N && !busy) go(cur - 1, { edit: seenResult }); }

    function go(to, opts = {}) {
      if (to === cur) return;
      const from = panels[cur], dest = panels[to], dir = to > cur || to === RESULT ? 1 : -1;
      const toResult = to === RESULT, fromResult = cur === RESULT;
      cur = to;
      if (toResult) seenResult = true;
      // the input shows the current value
      if (!toResult) { const i = $('.cin__i', dest), k = i.dataset.key; i.value = String(v[k]); msgOn(dest, ''); }
      panels.forEach((p) => { if (p !== from && p !== dest) { gsap.killTweensOf(p); p.classList.remove('is-on'); p.setAttribute('inert', ''); } });
      pillState(dest, to, labelFor(to));
      updateSoFar();
      if (toResult) updateResult(true);
      else if (fromResult) updateResult(false);

      dest.removeAttribute('inert'); from.setAttribute('inert', '');
      if (R.reduce) {
        from.classList.remove('is-on'); dest.classList.add('is-on'); gsap.set([from, dest], { clearProps: 'all' });
      } else {
        // the question leaves up, the next one rises (reversed when going back)
        gsap.killTweensOf([from, dest]);
        gsap.set(dest, { autoAlpha: 0, y: 28 * dir });
        dest.classList.add('is-on');
        from.style.pointerEvents = 'none';
        gsap.to(from, { autoAlpha: 0, y: -28 * dir, duration: 0.4, ease: 'power2.in', onComplete: () => { from.classList.remove('is-on'); gsap.set(from, { clearProps: 'all' }); } });
        gsap.to(dest, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.12, ease: 'expo.out', onComplete: () => { gsap.set(dest, { clearProps: 'all' }); dest.classList.add('is-on'); } });
        if (toResult) rise([...$$('.cres__title, .cres__row', dest)], { y: 14, duration: 0.8, delay: 0.25, stagger: 0.08, onComplete() { gsap.set(this.targets(), { clearProps: 'all' }); } });
      }
      // the right-hand column: "So far" while answering, the net card and answers on the result
      if (toResult !== fromResult) {
        const on = toResult ? side.res : side.sf, off = toResult ? side.sf : side.res;
        on.removeAttribute('inert'); off.setAttribute('inert', '');
        if (R.reduce) { off.classList.remove('is-on'); on.classList.add('is-on'); }
        else {
          gsap.killTweensOf([on, off]);
          on.classList.add('is-on');
          gsap.fromTo(on, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.15, ease: 'expo.out', onComplete: () => gsap.set(on, { clearProps: 'transform' }) });
          gsap.to(off, { autoAlpha: 0, duration: 0.3, ease: 'power1.in', onComplete: () => { off.classList.remove('is-on'); } });
          if (toResult) rise($$('.net, .ans, .cside__act', on), { y: 12, delay: 0.3, stagger: 0.08, duration: 0.8 });
        }
      }
      if (toResult) { const t = $('.cres__title', dest); setTimeout(() => t.focus({ preventScroll: true }), 50); }
      else setTimeout(() => { const i = $('.cin__i', dest); i.focus({ preventScroll: true }); i.select(); }, R.reduce ? 0 : 160);
    }

    /* ------------------------------------------------------------ wire up */
    panels.forEach((p) => {
      if (stepOf(p) < N) {
        wireInput(p); wireAssume(p);
        $('[data-next]', p).addEventListener('click', next);
        const b = $('[data-back]', p); b.addEventListener('click', back);
      }
    });
    side.sf.classList.add('is-on');
    side.res.classList.remove('is-on');
    updateSoFar();
    updateResult(false);
    // keep the "Not yet" state of the net card until costs are given
    netEl.dataset.state = 'unknown';
    root.__calc = { v, go: (i) => go(i), get step() { return cur; } };
  },
});
