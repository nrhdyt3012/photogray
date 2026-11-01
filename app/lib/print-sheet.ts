import type { PrintLayout } from '~/lib/supabase/types';

const DPI = 300;
const SHEET_W = 4 * DPI; // 4R = 4 x 6 inci
const SHEET_H = 6 * DPI;

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat foto untuk dicetak'));
    img.src = src;
  });

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * Susun lembar cetak 4R (10x15 cm, 300 dpi) dari hasil foto.
 * - 'full': satu desain memenuhi lembar (diputar otomatis untuk frame horizontal).
 * - 'half': desain yang sama dicetak dua kali berdampingan, lalu lembar dipotong tengah
 *   menjadi dua strip.
 * Mengembalikan object URL; panggil URL.revokeObjectURL setelah dipakai.
 */
export async function composePrintSheet(imageUrl: string, layout: PrintLayout): Promise<string> {
  const img = await load(imageUrl);
  const horizontal = img.width > img.height;

  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);

  const cells =
    layout === 'half'
      ? [
          { x: 0, y: 0, w: SHEET_W / 2, h: SHEET_H },
          { x: SHEET_W / 2, y: 0, w: SHEET_W / 2, h: SHEET_H },
        ]
      : [{ x: 0, y: 0, w: SHEET_W, h: SHEET_H }];

  for (const c of cells) {
    // Frame horizontal diputar 90 derajat supaya memenuhi sel yang berdiri
    if (horizontal) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(Math.PI / 2);
      drawContain(ctx, img, -c.h / 2, -c.w / 2, c.h, c.w);
      ctx.restore();
    } else {
      drawContain(ctx, img, c.x, c.y, c.w, c.h);
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat lembar cetak'))), 'image/jpeg', 0.95),
  );
  return URL.createObjectURL(blob);
}
