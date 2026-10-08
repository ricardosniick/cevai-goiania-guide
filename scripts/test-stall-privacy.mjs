// Isolated database only. PGLITE_MODULE=/tmp/cevai-sql-tests/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-stall-privacy.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite(); let passed = 0;
const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
async function test(name, fn) { await fn(); console.log(`OK ${++passed}: ${name}`); }
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    CREATE TABLE fair_stalls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), place_id text NOT NULL, name text NOT NULL, kind text, emoji text, created_at timestamptz DEFAULT now(), created_by uuid NOT NULL);
    ALTER TABLE fair_stalls ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Authenticated can view stalls" ON fair_stalls FOR SELECT TO authenticated USING(true);
    CREATE POLICY "Users create stalls" ON fair_stalls FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid());
    CREATE POLICY "Creators update stalls" ON fair_stalls FOR UPDATE TO authenticated USING(created_by=auth.uid());
    CREATE POLICY "Creators delete stalls" ON fair_stalls FOR DELETE TO authenticated USING(created_by=auth.uid());
    GRANT ALL ON fair_stalls TO anon,authenticated;
    INSERT INTO fair_stalls(id,place_id,name,created_by) VALUES('${a}','place','A','${a}'),('${b}','place','B','${b}');
    CREATE TABLE experiences(id uuid PRIMARY KEY, stall_id uuid REFERENCES fair_stalls(id));
    INSERT INTO experiences VALUES('${a}','${b}');
    GRANT SELECT ON experiences TO authenticated;
  `);
  const before=(await db.query("SELECT relacl::text FROM pg_class WHERE oid='fair_stalls'::regclass")).rows[0].relacl;
  await db.exec(`SET ROLE authenticated; SET test.uid='${a}'`);
  await test('baseline exposes both creator IDs', async () => { assert.equal((await db.query('SELECT created_by FROM fair_stalls')).rows.length,2); });
  await db.exec('RESET ROLE');
  await db.exec(await readFile(new URL('../docs/sql/seguranca_fair_stalls_NAO_APLICADO.sql',import.meta.url),'utf8'));
  await db.exec(`SET ROLE authenticated; SET test.uid='${a}'`);
  await test('shared catalog still readable and ordered', async () => { assert.equal((await db.query('SELECT id,place_id,name,kind,emoji FROM fair_stalls ORDER BY created_at')).rows.length,2); });
  await test('creator IDs and SELECT * are denied', async () => {
    await assert.rejects(()=>db.query('SELECT created_by FROM fair_stalls'),/permission denied/);
    await assert.rejects(()=>db.query('SELECT * FROM fair_stalls'),/permission denied/);
  });
  await test('own stall creation succeeds without RETURNING creator ID', async () => { await db.query("INSERT INTO fair_stalls(place_id,name,created_by) VALUES('place','new',$1)",[a]); });
  await test('forged creator is denied', async () => { await assert.rejects(()=>db.query("INSERT INTO fair_stalls(place_id,name,created_by) VALUES('place','forged',$1)",[b]),/row-level security/); });
  await test('own update remains available', async () => { const r=await db.query("UPDATE fair_stalls SET name='updated' WHERE id=$1 RETURNING name",[a]); assert.equal(r.rows[0].name,'updated'); });
  await test('ownership transfer stays denied through existing USING fallback', async () => { await assert.rejects(()=>db.query('UPDATE fair_stalls SET created_by=$1 WHERE id=$2',[b,a]),/row-level security/); });
  await test('update/delete another owner affects zero rows', async () => {
    assert.equal((await db.query("UPDATE fair_stalls SET name='bad' WHERE id=$1 RETURNING id",[b])).rows.length,0);
    assert.equal((await db.query('DELETE FROM fair_stalls WHERE id=$1 RETURNING id',[b])).rows.length,0);
  });
  await test('existing experience join still reads stall name/emoji', async () => { assert.equal((await db.query('SELECT s.name,s.emoji FROM experiences e JOIN fair_stalls s ON s.id=e.stall_id')).rows[0].name,'B'); });
  await test('own deletion remains available', async () => { assert.equal((await db.query('DELETE FROM fair_stalls WHERE id=$1 RETURNING id',[a])).rows.length,1); });
  await test('authenticated cannot truncate shared catalog', async () => { await assert.rejects(()=>db.exec('TRUNCATE fair_stalls CASCADE'),/permission denied/); });
  await db.exec('RESET ROLE; SET ROLE anon');
  await test('anonymous reading/writing/truncating is denied by privileges', async () => {
    for (const sql of ['SELECT name FROM fair_stalls',"INSERT INTO fair_stalls(place_id,name,created_by) VALUES('p','x',null)","UPDATE fair_stalls SET name='x'",'DELETE FROM fair_stalls','TRUNCATE fair_stalls CASCADE']) await assert.rejects(()=>db.exec(sql),/permission denied/);
  });
  await db.exec('RESET ROLE');
  await test('rollback restores exact audited table grants and removes added column grants', async () => {
    await db.exec(await readFile(new URL('../docs/sql/seguranca_fair_stalls_REVERSAO.sql',import.meta.url),'utf8'));
    const after=(await db.query("SELECT relacl::text FROM pg_class WHERE oid='fair_stalls'::regclass")).rows[0].relacl;
    const normalize = acl => acl.slice(1,-1).split(',').sort();
    assert.deepEqual(normalize(after),normalize(before));
    const cols=await db.query("SELECT coalesce(cardinality(attacl),0) AS grants FROM pg_attribute WHERE attrelid='fair_stalls'::regclass AND attnum>0 AND NOT attisdropped");
    assert.ok(cols.rows.every(row=>row.grants===0));
  });
  console.log(`${passed}/${passed} isolated SQL scenarios passed`);
} finally { await db.close(); }
