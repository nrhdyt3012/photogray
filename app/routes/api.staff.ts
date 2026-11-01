/**
 * API server untuk pengelolaan akun staf. Membuat user auth butuh service role key,
 * yang TIDAK boleh ada di browser, jadi dilakukan di sini dan hanya untuk owner.
 *
 * POST /api/staff
 *   { action: 'create', email, password, full_name, role, branch_id }
 *   { action: 'set_password', user_id, password }
 * Header: Authorization: Bearer <access_token milik owner>
 */
import { createClient } from '@supabase/supabase-js';
import type { Route } from './+types/api.staff';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method tidak diizinkan' }, 405);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ error: 'Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY)' }, 500);
  }

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Belum login' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Verifikasi pemanggil adalah owner aktif
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Sesi tidak valid' }, 401);
  const { data: me } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!me || !me.is_active || me.role !== 'owner') {
    return json({ error: 'Hanya owner yang boleh mengelola akun' }, 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') return json({ error: 'Permintaan tidak valid' }, 400);

  if (body.action === 'create') {
    const { email, password, full_name, role, branch_id } = body;
    if (!email || !full_name || typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Email, nama, dan kata sandi (min. 8 karakter) wajib diisi' }, 400);
    }
    if (role !== 'owner' && role !== 'cashier') return json({ error: 'Peran tidak valid' }, 400);
    if (role === 'cashier' && !branch_id) return json({ error: 'Kasir harus punya cabang' }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'Gagal membuat akun' }, 400);
    }
    const { error: profileErr } = await admin.from('profiles').insert({
      id: created.user.id,
      full_name,
      role,
      branch_id: role === 'owner' ? null : branch_id,
    });
    if (profileErr) {
      // Batalkan user auth supaya tidak ada akun tanpa profil
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileErr.message }, 400);
    }
    return json({ ok: true, id: created.user.id });
  }

  if (body.action === 'set_password') {
    const { user_id, password } = body;
    if (!user_id || typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Kata sandi minimal 8 karakter' }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(user_id, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Aksi tidak dikenal' }, 400);
}
