/**
 * Memisahkan orang dari background di browser memakai MediaPipe Image Segmenter
 * (model selfie_segmenter). Model + WASM diunduh dari internet saat pertama dipakai.
 */
import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import { loadImage, type PersonMask } from './photo-edit';

// Versi WASM harus sama dengan versi paket @mediapipe/tasks-vision di package.json
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const MODEL_URL =
  (import.meta.env.VITE_SEGMENTER_MODEL_URL as string | undefined) ||
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function createSegmenter(): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import(
    '@mediapipe/tasks-vision'
  );
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate: 'GPU' | 'CPU') =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  try {
    return await make('GPU');
  } catch {
    return await make('CPU');
  }
}

/** Dipanggil lebih awal (mis. saat sesi mulai) supaya model sudah siap saat dibutuhkan. */
export function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter().catch((error) => {
      segmenterPromise = null; // boleh dicoba lagi
      throw error;
    });
  }
  return segmenterPromise;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export async function segmentPerson(src: string): Promise<PersonMask> {
  const segmenter = await getSegmenter();
  const img = await loadImage(src);
  const result = segmenter.segment(img);

  try {
    const masks = result.confidenceMasks ?? [];
    if (masks.length === 0) {
      throw new Error('Model tidak menghasilkan mask');
    }
    // Model 2 kelas: [background, orang]. Model 1 kelas: langsung peluang orang.
    const mask = masks.length > 1 ? masks[1] : masks[0];
    const { width, height } = mask;
    const values = mask.getAsFloat32Array();

    // Pengaman urutan label: orang biasanya di tengah foto selfie.
    // Jika bagian tengah justru lebih "background" daripada tepi, balik maskernya.
    let center = 0;
    let centerN = 0;
    let border = 0;
    let borderN = 0;
    const bx = Math.floor(width * 0.1);
    const by = Math.floor(height * 0.1);
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const v = values[y * width + x];
        if (x > width * 0.3 && x < width * 0.7 && y > height * 0.3 && y < height * 0.7) {
          center += v;
          centerN++;
        } else if (x < bx || x >= width - bx || y < by || y >= height - by) {
          border += v;
          borderN++;
        }
      }
    }
    const invert = centerN > 0 && borderN > 0 && center / centerN < border / borderN;

    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i++) {
      const v = invert ? 1 - values[i] : values[i];
      alpha[i] = Math.round(smoothstep(0.35, 0.65, v) * 255);
    }
    return { width, height, alpha };
  } finally {
    result.close();
  }
}
