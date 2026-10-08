// Isolated PostgreSQL-compatible test database. No network or production credentials.
// npm install --prefix /tmp/cevai-sql-tests --cache /tmp/cevai-npm-cache @electric-sql/pglite
// PGLITE_MODULE=/tmp/cevai-sql-tests/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-create-experience.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let passed = 0;
const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
async function test(name, fn) { await fn(); console.log(`OK ${++passed}: ${name}`); }
async function call(scores = { Atendimento: 5 }, overrides = {}, requestId = randomUUID()) {
  const input = { place: 'place', category: 'bar', rating: 4, comment: ' visita ', would: true, stall: null, ...overrides };
  return db.query('SELECT public.create_experience_once($1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb) AS id', [requestId, input.place, input.category, input.rating, input.comment, input.would, input.stall, JSON.stringify(scores)]);
}
async function counts() {
  await db.exec('RESET ROLE');
  const r = await db.query('SELECT (SELECT count(*)::integer FROM experiences) AS experiences, (SELECT count(*)::integer FROM experience_scores) AS scores');
  await db.exec('SET ROLE authenticated');
  return r.rows[0];
}
async function rejectWithoutChanges(scores, overrides, pattern) {
  const before = await counts();
  await assert.rejects(() => call(scores, overrides), pattern);
  assert.deepEqual(await counts(), before);
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    CREATE TABLE experiences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, place_id text NOT NULL, category text NOT NULL, rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment text, would_return boolean NOT NULL DEFAULT true, stall_id uuid, is_public boolean NOT NULL DEFAULT false);
    CREATE TABLE experience_scores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE, criterion text NOT NULL, score integer NOT NULL CHECK(score BETWEEN 1 AND 5));
    ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
    ALTER TABLE experience_scores ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_insert ON experiences FOR INSERT TO authenticated WITH CHECK(user_id = auth.uid());
    CREATE POLICY own_read ON experiences FOR SELECT TO authenticated USING(user_id = auth.uid() OR is_public);
    CREATE POLICY score_insert ON experience_scores FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM experiences e WHERE e.id = experience_scores.experience_id AND e.user_id = auth.uid()));
    CREATE POLICY score_read ON experience_scores FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM experiences e WHERE e.id = experience_scores.experience_id AND e.user_id = auth.uid()));
    GRANT SELECT, INSERT ON experiences, experience_scores TO authenticated;
  `);
  await db.exec(await readFile(new URL('../docs/sql/etapa4_create_experience_NAO_APLICADO.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../docs/sql/etapa4_create_experience_once_NAO_APLICADO.sql', import.meta.url), 'utf8'));
  await db.exec(`SET ROLE authenticated; SET test.uid = '${a}'`);
  await test('experience and all scores commit; owner, privacy and trimmed comment preserved', async () => {
    const { rows } = await call({ Atendimento: 5, Ambiente: 3 });
    const exp = (await db.query('SELECT * FROM experiences WHERE id = $1', [rows[0].id])).rows[0];
    assert.equal(exp.user_id, a); assert.equal(exp.is_public, false); assert.equal(exp.comment, 'visita');
    assert.deepEqual(await counts(), { experiences: 1, scores: 2 });
  });
  await test('no criteria is valid', async () => { await call({}); assert.deepEqual(await counts(), { experiences: 2, scores: 2 }); });
  await test('a failure DURING score insert rolls back the new experience too', async () => {
    await db.exec("RESET ROLE; ALTER TABLE experience_scores ADD CONSTRAINT simulated_failure CHECK(criterion <> 'Failure'); SET ROLE authenticated");
    await rejectWithoutChanges({ Failure: 4 }, {}, /simulated_failure/);
    await db.exec('RESET ROLE; ALTER TABLE experience_scores DROP CONSTRAINT simulated_failure; SET ROLE authenticated');
  });
  await test('invalid score rejects everything', () => rejectWithoutChanges({ Atendimento: 6 }, {}, /bad_score/));
  await test('invalid rating rejects everything', () => rejectWithoutChanges({}, { rating: 0 }, /bad_rating/));
  await test('invalid criteria and score shapes reject everything', async () => {
    for (const s of [null, [], 'x']) await rejectWithoutChanges(s, {}, /bad_scores/);
    for (const s of [{ '': 1 }, { ['x'.repeat(61)]: 1 }, Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`c${i}`, 1]))]) await rejectWithoutChanges(s, {}, /bad_criterion/);
    for (const value of ['5', 1.5, true, null]) await rejectWithoutChanges({ c: value }, {}, /bad_score/);
  });
  await test('comment over 2000 characters rejects everything', () => rejectWithoutChanges({}, { comment: 'x'.repeat(2001) }, /bad_comment/));
  await test('missing session is refused', async () => {
    await db.exec("SET test.uid = ''"); await rejectWithoutChanges({}, {}, /not_authenticated/); await db.exec(`SET test.uid = '${a}'`);
  });
  await test('anonymous execution is refused', async () => {
    await db.exec('RESET ROLE; SET ROLE anon'); await assert.rejects(() => call(), /permission denied/); await db.exec('RESET ROLE; SET ROLE authenticated');
  });
  await test('B creates only for B and cannot read A private records', async () => {
    await db.exec(`SET test.uid = '${b}'`); const { rows } = await call();
    const mine = (await db.query('SELECT * FROM experiences')).rows;
    assert.equal(mine.length, 1); assert.equal(mine[0].id, rows[0].id); assert.equal(mine[0].user_id, b);
  });
  await test('INVOKER respects an additional rejecting RLS policy', async () => {
    await db.exec("RESET ROLE; CREATE POLICY reject_criteria ON experience_scores AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false); SET ROLE authenticated");
    await rejectWithoutChanges({ c: 1 }, {}, /row-level security/);
    await db.exec('RESET ROLE; DROP POLICY reject_criteria ON experience_scores; SET ROLE authenticated');
  });
  await test('same request repeated after a lost response returns the same ID without extra rows', async () => {
    const key = randomUUID(); const first = await call({ c: 4 }, {}, key); const before = await counts();
    const second = await call({ c: 4 }, {}, key);
    assert.equal(first.rows[0].id, key); assert.equal(second.rows[0].id, key);
    assert.deepEqual(await counts(), before);
  });
  await test('same request with different rating or scores refuses without changing saved data', async () => {
    const key = randomUUID(); await call({ c: 4 }, {}, key); const before = await counts();
    await assert.rejects(() => call({ c: 4 }, { rating: 2 }, key), /request_conflict/);
    await assert.rejects(() => call({ c: 2 }, {}, key), /request_conflict/);
    assert.equal((await db.query('SELECT rating FROM experiences WHERE id=$1', [key])).rows[0].rating, 4);
    assert.deepEqual(await counts(), before);
  });
  await test('request ID cannot be reused by another owner', async () => {
    const key = randomUUID(); await call({}, {}, key);
    await db.exec(`SET test.uid = '${a}'`);
    await assert.rejects(() => call({}, {}, key), /request_conflict|row-level security/);
    await db.exec(`SET test.uid = '${b}'`);
  });
  await test('an initial transaction failure does not consume the request ID', async () => {
    const key = randomUUID();
    await db.exec("RESET ROLE; ALTER TABLE experience_scores ADD CONSTRAINT fail_retry CHECK(criterion <> 'Failure'); SET ROLE authenticated");
    await assert.rejects(() => call({ Failure: 4 }, {}, key), /fail_retry/);
    await db.exec('RESET ROLE; ALTER TABLE experience_scores DROP CONSTRAINT fail_retry; SET ROLE authenticated');
    assert.equal((await call({ Failure: 4 }, {}, key)).rows[0].id, key);
  });
  await test('null request ID is rejected', async () => {
    const before = await counts(); await assert.rejects(() => call({}, {}, null), /bad_request_id/); assert.deepEqual(await counts(), before);
  });
  await test('different request IDs allow deliberate separate visits to the same place', async () => {
    const first = await call(); const second = await call(); assert.notEqual(first.rows[0].id, second.rows[0].id);
  });
  await test('legacy creation function remains unchanged and executable', async () => {
    const result = await db.query("SELECT public.create_experience('place','bar',4,'',true,null,'{}'::jsonb) AS id");
    assert.ok(result.rows[0].id);
  });
  await test('rollback removes only the new function, retaining records', async () => {
    const before = await counts(); await db.exec('RESET ROLE');
    await db.exec(await readFile(new URL('../docs/sql/etapa4_create_experience_once_REVERSAO.sql', import.meta.url), 'utf8'));
    await db.exec('SET ROLE authenticated'); assert.deepEqual(await counts(), before);
    await assert.rejects(() => call(), /does not exist/);
  });
  console.log(`${passed}/${passed} isolated SQL scenarios passed`);
} finally { await db.close(); }
