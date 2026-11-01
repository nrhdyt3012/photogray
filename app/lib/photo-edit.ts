/**
 * Editing foto: tone (filter warna) dan penggantian background.
 * Alur per foto: foto asli -> tone -> (jika background dipilih) ganti background
 * memakai mask orang -> hasil JPEG data URL.
 */

export interface PersonMask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray; // 0 = background, 255 = orang
}

export interface ToneDef {
  id: string;
  name: string;
  filter: string; // CSS filter string (dipakai ctx.filter)
  tint?: { color: string; alpha: number }; // lapisan warna soft-light
}

export const TONES: ToneDef[] = [
  { id: 'original', name: 'Original', filter: 'none' },
  {
    id: 'warm',
    name: 'Warm',
    filter: 'saturate(1.1) brightness(1.04)',
    tint: { color: '#ff9a3c', alpha: 0.5 },
  },
  {
    id: 'bright',
    name: 'Bright',
    filter: 'brightness(1.18) contrast(1.05) saturate(1.1)',
  },
  { id: 'bw', name: 'Black & White', filter: 'grayscale(1) contrast(1.12)' },
  {
    id: 'cold',
    name: 'Cold',
    filter: 'saturate(0.95) brightness(1.03)',
    tint: { color: '#3c8cff', alpha: 0.5 },
  },
  { id: 'vivid', name: 'Vivid', filter: 'saturate(1.7) contrast(1.12)' },
];

export interface BackgroundDef {
  id: string;
  name: string;
  swatch: string; // CSS background untuk kotak pilihan
  paint?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function solid(id: string, name: string, color: string): BackgroundDef {
  return {
    id,
    name,
    swatch: color,
    paint: (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

function gradient(
  id: string,
  name: string,
  stops: [number, string][],
): BackgroundDef {
  return {
    id,
    name,
    swatch: `linear-gradient(135deg, ${stops
      .map(([p, c]) => `${c} ${p * 100}%`)
      .join(', ')})`,
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      stops.forEach(([p, c]) => g.addColorStop(p, c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'original', name: 'Original', swatch: '#e5e7eb' },
  solid('red', 'Merah', '#dc2626'),
  solid('pink', 'Pink', '#f472b6'),
  solid('blue', 'Biru', '#2563eb'),
  solid('green', 'Hijau', '#16a34a'),
  solid('yellow', 'Kuning', '#facc15'),
  solid('black', 'Hitam', '#111827'),
  solid('white', 'Putih', '#ffffff'),
  gradient('rainbow', 'Warna-warni', [
    [0, '#ef4444'],
    [0.2, '#f59e0b'],
    [0.4, '#facc15'],
    [0.6, '#22c55e'],
    [0.8, '#3b82f6'],
    [1, '#a855f7'],
  ]),
  gradient('sunset', 'Sunset', [
    [0, '#fde047'],
    [0.5, '#fb7185'],
    [1, '#7c3aed'],
  ]),
  gradient('ocean', 'Ocean', [
    [0, '#67e8f9'],
    [1, '#1d4ed8'],
  ]),
];

export function getToneById(id: string): ToneDef {
  return TONES.find((t) => t.id === id) ?? TONES[0];
}

export function getBackgroundById(id: string): BackgroundDef {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = src;
  });
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  return { canvas, ctx };
}

function drawToned(img: HTMLImageElement, w: number, h: number, tone: ToneDef) {
  const { canvas, ctx } = makeCanvas(w, h);
  // ctx.filter tidak ada di sebagian browser lama (mis. Safari); jika tidak ada, filter dilewati
  if ('filter' in ctx) ctx.filter = tone.filter;
  ctx.drawImage(img, 0, 0, w, h);
  if ('filter' in ctx) ctx.filter = 'none';
  if (tone.tint) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = tone.tint.alpha;
    ctx.fillStyle = tone.tint.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

export interface RenderOptions {
  src: string;
  toneId: string;
  backgroundId?: string;
  mask?: PersonMask | null;
  maxWidth?: number; // untuk pratinjau (kecil); kosong = resolusi asli
  quality?: number;
}

/** Terapkan tone + background, kembalikan JPEG data URL. */
export async function renderPhoto({
  src,
  toneId,
  backgroundId = 'original',
  mask,
  maxWidth,
  quality = 0.92,
}: RenderOptions): Promise<string> {
  const img = await loadImage(src);
  const scale = maxWidth ? Math.min(1, maxWidth / img.width) : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const toned = drawToned(img, w, h, getToneById(toneId));
  const bg = getBackgroundById(backgroundId);

  if (!bg.paint || !mask) {
    return toned.toDataURL('image/jpeg', quality);
  }

  // Mask kecil -> canvas RGBA (alpha = orang)
  const small = makeCanvas(mask.width, mask.height);
  const imageData = small.ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.alpha.length; i++) {
    const o = i * 4;
    imageData.data[o] = 255;
    imageData.data[o + 1] = 255;
    imageData.data[o + 2] = 255;
    imageData.data[o + 3] = mask.alpha[i];
  }
  small.ctx.putImageData(imageData, 0, 0);

  // Potong orang dari foto ber-tone: mask diperbesar dan sedikit di-blur agar tepinya halus.
  // Digambar sedikit lebih besar dari canvas supaya blur tidak memudarkan tepi bawah/samping.
  const blur = Math.max(1, w / 640);
  const pad = blur * 3;
  const personCtx = toned.getContext('2d')!;
  personCtx.globalCompositeOperation = 'destination-in';
  personCtx.imageSmoothingEnabled = true;
  personCtx.imageSmoothingQuality = 'high';
  if ('filter' in personCtx) personCtx.filter = `blur(${blur}px)`;
  personCtx.drawImage(small.canvas, -pad, -pad, w + pad * 2, h + pad * 2);
  if ('filter' in personCtx) personCtx.filter = 'none';
  personCtx.globalCompositeOperation = 'source-over';

  // Background baru, lalu tempel orangnya
  const out = makeCanvas(w, h);
  bg.paint(out.ctx, w, h);
  out.ctx.drawImage(toned, 0, 0);
  return out.canvas.toDataURL('image/jpeg', quality);
}
