# Jobs pages prototype (P06 `/jobs`, P07 `/jobs/{slug}`)

Plain, working pages on the Drop 1 defaults. They read Anish's A-03 contract examples, not real data.

- Run: `cd prototypes && python3 -m http.server 8777`, then open http://localhost:8777/jobs/
- Prototype panel (bottom right): switch signed in or out and pick list, role and apply scenarios (empty, 404, 503, closed, already applied, no receipt…).
- Contract test: `node --test prototypes/jobs/contract.test.mjs`
- Real API: set `window.ROVN_API_BASE` in index.html. Sign-in isn't wired for real yet (B06, Arju).

Files:
- `contract.js`: readers for each response. A malformed response becomes an error state, never a guess.
- `api.js`: the mock and real transport.
- `app.js`: pages and states.
- `fixtures/`: the A-03 examples, plus a synthetic list shaped like the current `GET /job-postings`.
