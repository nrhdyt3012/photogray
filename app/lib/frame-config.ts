/**
 * Frame configuration system for photobooth
 * Defines frame templates with photo slot coordinates
 */

export interface PhotoSlot {
  x: number; // Top-left X coordinate
  y: number; // Top-left Y coordinate
  width: number; // Slot width
  height: number; // Slot height
}

export interface FrameConfig {
  id: string; // Unique identifier
  name: string; // Display name
  path: string; // Asset path
  width: number; // Frame width
  height: number; // Frame height
  orientation: 'vertical' | 'horizontal';
  photoSlots: PhotoSlot[]; // Jumlah kotak foto = foto yang dipilih tamu
  isDefault?: boolean; // Default selection flag
}

export type FrameOrientation = 'vertical' | 'horizontal';

/**
 * Frame configurations
 * NOTE: Photo slot coordinates are estimated and need verification
 * TODO: Measure exact coordinates using image editor or measurement tool
 */
/** Frame bawaan: dipakai hanya jika data frame dari database tidak bisa dimuat. */
export const FALLBACK_FRAMES: Record<string, FrameConfig> = {
  'classic-vertical': {
    id: 'classic-vertical',
    name: 'Classic',
    path: '/assets/frame-classic-vertical.png',
    width: 514,
    height: 1170,
    orientation: 'vertical',
    isDefault: true,
    photoSlots: [
      // Measured coordinates accounting for brown frame borders
      // Border margins: ~25px sides, ~20px top/bottom of each slot
      { x: 50, y: 46, width: 418, height: 304 },
      { x: 50, y: 384, width: 418, height: 304 },
      { x: 50, y: 723, width: 418, height: 304 },
    ],
  },
  'bright-bold-vertical': {
    id: 'bright-bold-vertical',
    name: 'Bright & Bold',
    path: '/assets/frame-bright-and-bold-vertical.png',
    width: 688,
    height: 1506,
    orientation: 'vertical',
    photoSlots: [
      // Measured coordinates accounting for decorative borders and oval shapes
      // Border margins: ~60px sides, ~40px top/bottom, plus bottom text area
      { x: 94, y: 110, width: 568, height: 370 },
      { x: 94, y: 528, width: 568, height: 370 },
      { x: 94, y: 935, width: 568, height: 370 },
    ],
  },
  'elegant-horizontal': {
    id: 'elegant-horizontal',
    name: 'Elegant',
    path: '/assets/frame-elegant-horizontal.png',
    width: 2758,
    height: 988,
    orientation: 'horizontal',
    photoSlots: [
      { x: 135, y: 130, width: 805, height: 526 },
      { x: 978, y: 129, width: 802, height: 528 },
      { x: 1811, y: 127, width: 805, height: 525 },
    ],
  },
  'modern-horizontal': {
    id: 'modern-horizontal',
    name: 'Modern',
    path: '/assets/frame-modern-horizontal.png',
    width: 2494,
    height: 786,
    orientation: 'horizontal',
    photoSlots: [
      { x: 76, y: 152, width: 705, height: 535 },
      { x: 828, y: 144, width: 701, height: 548 },
      { x: 1585, y: 140, width: 693, height: 546 },
    ],
  },
};

/** Frame aktif yang sedang dipakai (diisi dari database lewat setFrames). */
let activeFrames: Record<string, FrameConfig> = FALLBACK_FRAMES;

export interface FrameDbRow {
  id: string;
  name: string;
  orientation: FrameOrientation;
  image_url: string;
  width: number;
  height: number;
  photo_slots: PhotoSlot[];
  is_default: boolean;
}

/** Ganti daftar frame aktif dengan data dari database. Daftar kosong = pakai fallback. */
export function setFrames(rows: FrameDbRow[]): void {
  if (rows.length === 0) {
    activeFrames = FALLBACK_FRAMES;
    return;
  }
  activeFrames = Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        path: r.image_url,
        width: r.width,
        height: r.height,
        orientation: r.orientation,
        photoSlots: r.photo_slots,
        isDefault: r.is_default,
      } satisfies FrameConfig,
    ]),
  );
}

/** Frame utama untuk jumlah kotak foto tertentu (atau frame mana pun jika tidak ada yang cocok). */
export function getDefaultFrame(slotCount?: number): FrameConfig {
  const all = Object.values(activeFrames);
  const fit = slotCount ? all.filter((f) => f.photoSlots.length === slotCount) : all;
  const pool = fit.length ? fit : all;
  return pool.find((f) => f.isDefault) || pool[0];
}

export function getFrameById(id: string): FrameConfig | undefined {
  return activeFrames[id];
}

/** Frame menurut layout; slotCount menyaring frame yang jumlah kotaknya cocok dengan paket. */
export function getFramesByOrientation(
  orientation: FrameOrientation,
  slotCount?: number,
): FrameConfig[] {
  return Object.values(activeFrames).filter(
    (f) =>
      f.orientation === orientation &&
      (slotCount === undefined || f.photoSlots.length === slotCount),
  );
}

export function getAllFrames(): FrameConfig[] {
  return Object.values(activeFrames);
}
