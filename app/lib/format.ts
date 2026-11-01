/** Utilitas tanggal (zona WIB, UTC+7, tanpa DST) dan format rupiah. */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const formatRupiah = (n: number) =>
  'Rp' + new Intl.NumberFormat('id-ID').format(n);

/** Tanggal hari ini di WIB, format YYYY-MM-DD. */
export function todayWib(): string {
  return new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Rentang [from, to) satu hari penuh WIB, dalam ISO untuk query. */
export function dayRange(dateStr: string): { from: string; to: string } {
  return {
    from: new Date(`${dateStr}T00:00:00+07:00`).toISOString(),
    to: new Date(`${addDays(dateStr, 1)}T00:00:00+07:00`).toISOString(),
  };
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });

export const formatDateLong = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

export const STATUS_LABEL = {
  ready: 'Menunggu tamu',
  in_progress: 'Sedang foto',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
} as const;

export const PAYMENT_LABEL = { cash: 'Tunai', qris: 'QRIS' } as const;
