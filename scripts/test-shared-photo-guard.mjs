// Isolated PostgreSQL-engine tests only. No remote database, HTTP or credentials.
// PGLITE_MODULE must point to an installed @electric-sql/pglite module.
// Auth and Storage operation context are simulated; this is not an HTTP Storage test.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to the installed PGlite module path');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
let passed = 0;
const check = (label, actual, expected) => { assert.deepEqual(actual, expected, label); passed++; console.log(`OK ${label}`); };
try {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    CREATE FUNCTION storage.operation() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT coalesce(current_setting('test.operation', true), '') $$;
    CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT storage.operation() <> '' AND regexp_replace(storage.operation(), '^storage\\.', '') = regexp_replace(expected_operation, '^storage\\.', '') $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon, service_role;
    CREATE TABLE public.experiences(id integer PRIMARY KEY, user_id uuid, is_public boolean);
    CREATE TABLE public.experience_photos(experience_id integer, user_id uuid, storage_path text);
    CREATE TABLE storage.buckets(id text PRIMARY KEY, public boolean);
    CREATE TABLE storage.objects(name text PRIMARY KEY, bucket_id text);
    ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.experience_photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.experiences, public.experience_photos, storage.objects TO authenticated;
    GRANT ALL ON public.experiences, public.experience_photos, storage.objects TO service_role;
    CREATE POLICY experience_read ON public.experiences FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_public);
    CREATE POLICY photo_read ON public.experience_photos FOR SELECT TO authenticated USING (
      user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_id AND e.is_public));
    CREATE POLICY "Users read own experience photos" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'experience-photos' AND split_part(name, '/', 1) = auth.uid()::text);
    CREATE POLICY "Users upload own experience photos" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'experience-photos' AND split_part(name, '/', 1) = auth.uid()::text);
    CREATE POLICY "Users delete own experience photos" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'experience-photos' AND split_part(name, '/', 1) = auth.uid()::text);
    INSERT INTO storage.buckets VALUES ('experience-photos', false);
    INSERT INTO public.experiences VALUES (1, '${a}', true), (2, '${a}', false);
    INSERT INTO public.experience_photos VALUES (1, '${a}', '${a}/shared'), (2, '${a}', '${a}/private'),
      (1, '${b}', '${b}/bad-owner'), (1, '${a}', '${b}/bad-folder');
    INSERT INTO storage.objects VALUES ('${a}/shared', 'experience-photos'), ('${a}/private', 'experience-photos'),
      ('${a}/book', 'experience-photos'), ('${a}/unlinked', 'experience-photos'),
      ('${b}/bad-owner', 'experience-photos'), ('${b}/bad-folder', 'experience-photos'), ('${a}/elsewhere', 'other');
  `);
  await db.exec(await readFile(new URL('../drizzle/migrations/0013_p3_read_shared_experience_photos.sql', import.meta.url), 'utf8'));
  const beforePolicies = (await db.query(`SELECT polname, polcmd, polpermissive, pg_get_expr(polqual, polrelid) AS qual, pg_get_expr(polwithcheck, polrelid) AS check FROM pg_policy WHERE polrelid='storage.objects'::regclass ORDER BY polname`)).rows;
  const read = async (user, operation, path, role = 'authenticated') => {
    await db.exec('RESET ROLE');
    await db.query(`SELECT set_config('test.uid', $1, false), set_config('test.operation', $2, false)`, [user, operation]);
    await db.exec(`SET ROLE ${role}`);
    try { return (await db.query('SELECT name FROM storage.objects WHERE name=$1', [path])).rows.length; }
    finally { await db.exec('RESET ROLE'); }
  };
  check('before: B can request a signed shared-photo URL', await read(b, 'storage.object.sign', `${a}/shared`), 1);
  await db.exec(await readFile(new URL('../drizzle/migrations/0019_shared_photo_authenticated_download.sql', import.meta.url), 'utf8'));
  check('shared authenticated download', await read(b, 'storage.object.get_authenticated', `${a}/shared`), 1);
  for (const op of ['storage.object.sign', 'storage.object.sign_many', 'storage.object.list', 'storage.object.copy', 'storage.render.image_authenticated', 'storage.s3.object.get', '', 'unknown']) {
    check(`B blocked: ${op || 'unset operation'}`, await read(b, op, `${a}/shared`), 0);
  }
  for (const path of ['private', 'book', 'unlinked']) {
    check(`B cannot download ${path}`, await read(b, 'storage.object.get_authenticated', `${a}/${path}`), 0);
    check(`owner keeps signed access to ${path}`, await read(a, 'storage.object.sign', `${a}/${path}`), 1);
  }
  check('owner keeps bulk signing', await read(a, 'storage.object.sign_many', `${a}/shared`), 1);
  // The unrelated third user cannot exploit inconsistent links from the historical P1 gap.
  const c = '00000000-0000-0000-0000-000000000003';
  check('mismatched owner rejected', await read(c, 'storage.object.get_authenticated', `${b}/bad-owner`), 0);
  check('mismatched folder rejected', await read(c, 'storage.object.get_authenticated', `${b}/bad-folder`), 0);
  await db.exec('UPDATE public.experiences SET is_public=false WHERE id=1');
  check('private toggle blocks the next new download', await read(b, 'storage.object.get_authenticated', `${a}/shared`), 0);
  check('owner still downloads after private toggle', await read(a, 'storage.object.get_authenticated', `${a}/shared`), 1);
  await db.exec('UPDATE public.experiences SET is_public=true WHERE id=1');
  check('server bypass remains unchanged', await read('', '', `${a}/shared`, 'service_role'), 1);
  // Future permissive policy cannot bypass the restrictive operation guard.
  await db.exec('GRANT SELECT ON storage.objects TO anon; CREATE POLICY temporary_open ON storage.objects FOR SELECT TO PUBLIC USING (true)');
  check('open permissive policy still cannot sign as B', await read(b, 'storage.object.sign', `${a}/shared`), 0);
  check('anonymous download still denied', await read('', 'storage.object.get_authenticated', `${a}/shared`, 'anon'), 0);
  check('guard leaves other buckets unchanged', await read(b, 'storage.object.sign', `${a}/elsewhere`), 1);
  await db.exec('DROP POLICY temporary_open ON storage.objects; REVOKE SELECT ON storage.objects FROM anon');
  await db.exec(await readFile(new URL('../docs/sql/0019_shared_photo_authenticated_download_rollback.sql', import.meta.url), 'utf8'));
  check('rollback restores previous signing behavior', await read(b, 'storage.object.sign', `${a}/shared`), 1);
  const afterPolicies = (await db.query(`SELECT polname, polcmd, polpermissive, pg_get_expr(polqual, polrelid) AS qual, pg_get_expr(polwithcheck, polrelid) AS check FROM pg_policy WHERE polrelid='storage.objects'::regclass ORDER BY polname`)).rows;
  check('rollback restores exact policy snapshot', afterPolicies, beforePolicies);
  console.log(`${passed} checks passed; isolated engine only; Storage HTTP test still required.`);
} finally { await db.close(); }
