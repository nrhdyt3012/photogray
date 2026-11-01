import { getSupabase } from '~/lib/supabase/client';
import type { KioskStatus, PrintLayout } from '~/lib/supabase/types';

/** Status ruangan + transaksi terbuka (tanpa login, dijaga kode ruangan). */
export async function fetchKioskStatus(code: string): Promise<KioskStatus> {
  const { data, error } = await getSupabase().rpc('kiosk_status', { p_code: code });
  if (error) throw new Error(error.message);
  return data as KioskStatus;
}

export interface KioskStartResult {
  ok: boolean;
  transaction_id?: string;
  photos_taken?: number;
  photos_selected?: number;
  print_layout?: PrintLayout;
}

/** Tamu menekan Start. Hanya berhasil jika kasir sudah menyimpan transaksi (status ready). */
export async function kioskStart(code: string): Promise<KioskStartResult> {
  const { data, error } = await getSupabase().rpc('kiosk_start', { p_code: code });
  if (error) throw new Error(error.message);
  return data as KioskStartResult;
}

/** Foto selesai diunggah: transaksi selesai dan ruangan terkunci lagi. */
export async function kioskComplete(
  code: string,
  photoUrl: string,
  publicId: string,
): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('kiosk_complete', {
    p_code: code,
    p_photo_url: photoUrl,
    p_public_id: publicId,
  });
  if (error) throw new Error(error.message);
  return !!(data as { ok: boolean }).ok;
}
