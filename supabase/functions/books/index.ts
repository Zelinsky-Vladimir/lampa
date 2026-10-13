import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AwsClient } from 'npm:aws4fetch@1.0.20';

const MB = 1024 * 1024;
const QUOTA = Number(Deno.env.get('BOOK_QUOTA_MB') ?? '300') * MB;
const MAX_FILE = 50 * MB;
const PENDING_MS = 60 * 60 * 1000;
const EXTS = new Set(['fb2', 'epub', 'txt', 'zip']);
const HASH = /^[0-9a-f]{16}$/;

const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
});
const bucketUrl = `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${Deno.env.get('R2_BUCKET')}`;

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Row = { hash: string; ext: string; size: number; ready: boolean; created_at: string };

const objectUrl = (user: string, hash: string, ext: string) => `${bucketUrl}/${user}/${hash}.${ext}`;

async function presign(url: string, method: 'GET' | 'PUT') {
  const signed = await r2.sign(`${url}?X-Amz-Expires=900`, { method, aws: { signQuery: true } });
  return signed.url;
}

async function rowsOf(user: string): Promise<Row[]> {
  const { data, error } = await admin.from('book_files').select('hash, ext, size, ready, created_at').eq('user_id', user);
  if (error) throw error;
  return data as Row[];
}

const usedBy = (rows: Row[], except: string, withPending: boolean) =>
  rows
    .filter((r) => r.hash !== except && (r.ready || (withPending && Date.now() - Date.parse(r.created_at) < PENDING_MS)))
    .reduce((n, r) => n + Number(r.size), 0);

async function removeObject(user: string, hash: string, ext: string) {
  const r = await r2.fetch(objectUrl(user, hash, ext), { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`R2 delete ${r.status}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'AUTH' }, 401);
  const user = auth.user.id;

  let body: { action?: string; hash?: string; ext?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }
  const { action, hash = '', ext = '' } = body;
  const validFile = HASH.test(hash) && EXTS.has(ext);

  try {
    if (action === 'list') {
      const rows = await rowsOf(user);
      return json({
        files: rows.filter((r) => r.ready).map(({ hash, ext, size }) => ({ hash, ext, size })),
        used: usedBy(rows, '', false),
        quota: QUOTA,
      });
    }

    if (action === 'deleteAll') {
      const rows = await rowsOf(user);
      for (const r of rows) await removeObject(user, r.hash, r.ext);
      await admin.from('book_files').delete().eq('user_id', user);
      return json({ ok: true });
    }

    if (!validFile) return json({ error: 'BAD_REQUEST' }, 400);

    if (action === 'upload') {
      const size = Number(body.size);
      if (!(size > 0 && size <= MAX_FILE)) return json({ error: 'TOO_LARGE', max: MAX_FILE }, 413);
      const used = usedBy(await rowsOf(user), hash, true);
      if (used + size > QUOTA) return json({ error: 'QUOTA', used, quota: QUOTA }, 413);
      const { error } = await admin
        .from('book_files')
        .upsert({ user_id: user, hash, ext, size, ready: false, created_at: new Date().toISOString() });
      if (error) throw error;
      return json({ url: await presign(objectUrl(user, hash, ext), 'PUT') });
    }

    if (action === 'confirm') {
      const head = await r2.fetch(objectUrl(user, hash, ext), { method: 'HEAD' });
      if (!head.ok) return json({ error: 'NOT_UPLOADED' }, 409);
      const size = Number(head.headers.get('content-length'));
      const used = usedBy(await rowsOf(user), hash, false);
      if (!(size > 0) || size > MAX_FILE || used + size > QUOTA) {
        await removeObject(user, hash, ext);
        await admin.from('book_files').delete().eq('user_id', user).eq('hash', hash);
        return json({ error: 'QUOTA', used, quota: QUOTA }, 413);
      }
      const { error } = await admin.from('book_files').update({ size, ext, ready: true }).eq('user_id', user).eq('hash', hash);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'download') {
      const row = (await rowsOf(user)).find((r) => r.hash === hash && r.ready);
      if (!row) return json({ error: 'NOT_FOUND' }, 404);
      return json({ url: await presign(objectUrl(user, row.hash, row.ext), 'GET') });
    }

    if (action === 'delete') {
      await removeObject(user, hash, ext);
      await admin.from('book_files').delete().eq('user_id', user).eq('hash', hash);
      return json({ ok: true });
    }

    return json({ error: 'BAD_REQUEST' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'SERVER' }, 500);
  }
});
