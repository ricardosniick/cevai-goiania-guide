// Isolated PostgreSQL engine. cron metadata/schedule are simulated, no real timer/network.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const sql = await readFile(new URL('../docs/sql/0020_clear_stale_place_coords_revisao.sql', import.meta.url), 'utf8');
let passed = 0;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); console.log(`OK ${++passed}: ${name}`); };
const clean = async () => Number((await db.query('SELECT public.clear_stale_place_coords() AS cleaned')).rows[0].cleaned);
const jobs = async () => (await db.query('SELECT jobname, schedule, command FROM cron.job ORDER BY jobname')).rows;
const apply = async () => { try { await db.exec(sql); } catch (e) { await db.exec('ROLLBACK'); throw e; } };
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text, schedule text, command text);
    CREATE FUNCTION cron.unschedule(id bigint) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN DELETE FROM cron.job WHERE jobid=id; RETURN FOUND; END $$;
    CREATE FUNCTION cron.schedule(name text, sched text, cmd text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE id bigint; BEGIN INSERT INTO cron.job(jobname,schedule,command) VALUES(name,sched,cmd) RETURNING jobid INTO id; RETURN id; END $$;
    CREATE TABLE public.places(google_place_id text PRIMARY KEY, name text, address text, category text, photo_name text, photo_url text, lat double precision, lng double precision, coords_fetched_at timestamptz);
    CREATE TABLE public.experiences(id integer PRIMARY KEY, place_id text REFERENCES public.places);
    CREATE TABLE public.saved_places(id integer PRIMARY KEY, place_id text REFERENCES public.places);
    INSERT INTO public.places VALUES ('fresh','Lugar','Rua','Bar','photo','url',-16.68,-49.25,clock_timestamp());
    INSERT INTO public.experiences VALUES(1,'fresh'); INSERT INTO public.saved_places VALUES(1,'fresh');
    SET cron.timezone='GMT';
  `);
  check('preflight: isolated database starts without jobs', await jobs(), []);
  await apply();
  const expected = [{ jobname: 'clear-stale-place-coords', schedule: '0 6 * * *', command: 'SELECT public.clear_stale_place_coords();' }];
  check('03:00 Brasilia = 06:00 UTC cron schedule', await jobs(), expected);
  check('fresh coordinates: zero cleaned', await clean(), 0);
  await apply(); check('reapplying migration does not duplicate job', await jobs(), expected);
  await db.exec(`
    INSERT INTO public.places VALUES
      ('old26','N26','A','Bar','P','U',-16.68,-49.25,clock_timestamp()-interval '26 days'),
      ('old31','N31','A','Bar','P','U',-16.68,-49.25,clock_timestamp()-interval '31 days'),
      ('unknown','NU','A','Bar','P','U',-16.68,-49.25,NULL),
      ('partial','NP','A','Bar','P','U',NULL,-49.25,clock_timestamp()-interval '26 days'),
      ('recent24','NR','A','Bar','P','U',-16.68,-49.25,clock_timestamp()-interval '24 days'),
      ('empty','NE','A','Bar','P','U',NULL,NULL,clock_timestamp()-interval '31 days');
  `);
  const snapshot = (await db.query('SELECT google_place_id,name,address,category,photo_name,photo_url,coords_fetched_at FROM public.places ORDER BY google_place_id')).rows;
  check('expired/unknown/partial coordinates: four rows cleaned', await clean(), 4);
  check('no other Google fields or timestamps changed', (await db.query('SELECT google_place_id,name,address,category,photo_name,photo_url,coords_fetched_at FROM public.places ORDER BY google_place_id')).rows, snapshot);
  check('expired rows retain IDs but no coordinates', (await db.query(`SELECT count(*)::int AS n FROM public.places WHERE google_place_id IN ('old26','old31','unknown','partial') AND lat IS NULL AND lng IS NULL`)).rows[0].n, 4);
  check('fresh and 24-day coordinates stay', (await db.query(`SELECT count(*)::int AS n FROM public.places WHERE google_place_id IN ('fresh','recent24') AND lat IS NOT NULL AND lng IS NOT NULL`)).rows[0].n, 2);
  check('experiences and favorites preserved', (await db.query('SELECT (SELECT count(*)::int FROM public.experiences) AS e,(SELECT count(*)::int FROM public.saved_places) AS s')).rows, [{e:1,s:1}]);
  check('cleanup idempotent', await clean(), 0);
  const f = (await db.query(`SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.clear_stale_place_coords()'::regprocedure`)).rows[0];
  check('security definer', f.prosecdef, true); check('fixed trusted search path', f.proconfig, ['search_path=pg_catalog']);
  for (const role of ['anon','authenticated']) {
    check(`${role}: no execute privilege`, (await db.query(`SELECT has_function_privilege($1,'public.clear_stale_place_coords()','EXECUTE') AS allowed`, [role])).rows[0].allowed, false);
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(clean, /permission denied/); passed++; console.log(`OK ${passed}: ${role} execution denied`);
    await db.exec('RESET ROLE');
  }
  await db.exec("SET cron.timezone='America/Sao_Paulo'"); await apply();
  check('local cron timezone: 03:00 schedule', (await jobs())[0].schedule, '0 3 * * *');
  const beforeFailure = await jobs();
  await db.exec("SET cron.timezone='Asia/Tokyo'");
  await assert.rejects(apply, /Unsupported cron timezone/);
  check('unknown timezone aborts without changing jobs', await jobs(), beforeFailure);
  await db.exec("SET cron.timezone='GMT'; INSERT INTO cron.job(jobname,schedule,command) VALUES('custom-cleanup','0 0 * * *','UPDATE public.places SET lat=NULL,lng=NULL WHERE coords_fetched_at < now()')");
  const customSnapshot = await jobs(); await assert.rejects(apply, /Equivalent cleanup job/);
  check('equivalent job under another name is not duplicated or overwritten', await jobs(), customSnapshot);
  await db.exec("DELETE FROM cron.job WHERE jobname='custom-cleanup'; UPDATE cron.job SET command='SELECT 1' WHERE jobname='clear-stale-place-coords'");
  const collisionSnapshot = await jobs(); await assert.rejects(apply, /Job name collision/);
  check('unrelated name collision stops without touching job', await jobs(), collisionSnapshot);
  console.log(`${passed} checks passed. Cron execution and production counts still require live validation.`);
} finally { await db.close(); }
