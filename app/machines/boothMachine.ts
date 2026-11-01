import { assign, createMachine, fromPromise } from 'xstate';
import { getDefaultFrame, getFrameById, type FrameConfig } from '~/lib/frame-config';
import type { PersonMask } from '~/lib/photo-edit';

// Nilai awal saja. Jumlah foto sebenarnya datang dari paket yang dibayar (event START).
export const DEFAULT_TOTAL_PHOTOS = 10;
export const DEFAULT_REQUIRED_PHOTOS = 3;

export type PrintLayout = 'half' | 'full';

export interface StartParams {
  transactionId: string;
  totalPhotos: number; // jumlah foto yang diambil
  requiredPhotos: number; // jumlah foto yang dipilih untuk masuk frame
  printLayout: PrintLayout; // half = 4R dibagi 2, full = 4R penuh
}

export interface BoothContext {
  transactionId: string | null; // transaksi kasir yang sedang dijalankan
  totalPhotos: number;
  requiredPhotos: number;
  printLayout: PrintLayout;
  images: string[]; // semua foto hasil jepretan (base64 data URLs), maks totalPhotos
  currentImageIndex: number; // 0-9 untuk progress
  selectedIndexes: number[]; // index foto terpilih, urutannya = urutan slot di frame
  selectedToneId: string; // tone foto (original, warm, bright, bw, cold, vivid)
  selectedBackgroundId: string; // background pengganti ('original' = tidak diganti)
  maskCache: Record<number, PersonMask>; // mask orang per index foto (hasil segmentasi)
  segmentationError: string | null; // pesan jika pemisahan background gagal
  editedImages: string[]; // 3 foto hasil edit (tone + background), siap masuk frame
  finalStripBlob: Blob | null; // hasil stitching lokal
  uploadUrl: string | null; // Cloudinary secure_url
  publicId: string | null; // Cloudinary public_id untuk QR code
  error: string | null;
  countdown: number; // 3, 2, 1 untuk tampilan UI
  uploadRetries: number;
  selectedFrameId: string;
}

export type BoothEvent =
  | ({ type: 'START' } & StartParams)
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'COUNTDOWN_DONE' }
  | { type: 'CAPTURE_DONE'; image: string }
  | { type: 'CAPTURE_ERROR'; error: string }
  | { type: 'TOGGLE_PHOTO'; index: number }
  | { type: 'CONFIRM_SELECTION' }
  | { type: 'SELECT_TONE'; toneId: string }
  | { type: 'CONFIRM_TONE' }
  | { type: 'SELECT_BACKGROUND'; backgroundId: string }
  | { type: 'CONFIRM_BACKGROUND' }
  | { type: 'RETRY_SEGMENTATION' }
  | { type: 'SELECT_FRAME'; frameId: string }
  | { type: 'CONFIRM_FRAME' }
  | { type: 'BACK' }
  | { type: 'STITCH_DONE'; blob: Blob }
  | { type: 'STITCH_ERROR'; error: string }
  | { type: 'UPLOAD_DONE'; url: string; publicId: string }
  | { type: 'UPLOAD_ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export interface CountdownInput {
  duration: number;
}

export interface SegmentInput {
  images: string[]; // semua foto hasil jepretan
  selectedIndexes: number[];
  cache: Record<number, PersonMask>;
}

export interface EditInput {
  images: string[]; // 3 foto terpilih
  toneId: string;
  backgroundId: string;
  masks: (PersonMask | undefined)[];
}

export interface StitchInput {
  images: string[];
  frameConfig: FrameConfig;
}

export interface UploadInput {
  blob: Blob;
  cloudName: string;
  uploadPreset: string;
}

export const boothMachine = createMachine(
  {
    id: 'booth',
    initial: 'idle',
    types: {} as {
      context: BoothContext;
      events: BoothEvent;
    },
    context: {
      transactionId: null,
      totalPhotos: DEFAULT_TOTAL_PHOTOS,
      requiredPhotos: DEFAULT_REQUIRED_PHOTOS,
      printLayout: 'half',
      images: [],
      currentImageIndex: 0,
      selectedIndexes: [],
      selectedToneId: 'original',
      selectedBackgroundId: 'original',
      maskCache: {},
      segmentationError: null,
      editedImages: [],
      finalStripBlob: null,
      uploadUrl: null,
      publicId: null,
      error: null,
      countdown: 3,
      uploadRetries: 0,
      selectedFrameId: getDefaultFrame().id,
    },
    states: {
      idle: {
        entry: assign({
          transactionId: null,
          totalPhotos: DEFAULT_TOTAL_PHOTOS,
          requiredPhotos: DEFAULT_REQUIRED_PHOTOS,
          printLayout: 'half' as PrintLayout,
          images: [],
          currentImageIndex: 0,
          selectedIndexes: [],
          selectedToneId: 'original',
          selectedBackgroundId: 'original',
          maskCache: {},
          segmentationError: null,
          editedImages: [],
          finalStripBlob: null,
          uploadUrl: null,
          publicId: null,
          error: null,
          countdown: 3,
          uploadRetries: 0,
          selectedFrameId: getDefaultFrame().id,
        }),
        on: {
          START: {
            target: 'countdown',
            actions: assign({
              transactionId: ({ event }) => event.transactionId,
              totalPhotos: ({ event }) => event.totalPhotos,
              requiredPhotos: ({ event }) => event.requiredPhotos,
              printLayout: ({ event }) => event.printLayout,
              selectedFrameId: ({ event }) =>
                getDefaultFrame(event.requiredPhotos).id,
            }),
          },
        },
      },

      countdown: {
        entry: assign({ countdown: 3 }),
        invoke: {
          id: 'countdownTimer',
          src: fromPromise(async () => {
            return new Promise<void>((resolve) => {
              setTimeout(resolve, 3000);
            });
          }),
          onDone: {
            target: 'capture',
          },
        },
        on: {
          COUNTDOWN_TICK: {
            actions: assign({
              countdown: ({ context }) => Math.max(0, context.countdown - 1),
            }),
          },
        },
      },

      capture: {
        on: {
          CAPTURE_DONE: {
            actions: assign({
              images: ({ context, event }) => [...context.images, event.image],
              currentImageIndex: ({ context }) => context.currentImageIndex + 1,
            }),
            target: 'checkProgress',
          },
          CAPTURE_ERROR: {
            actions: assign({
              error: ({ event }) => event.error,
            }),
            target: 'failure',
          },
        },
      },

      checkProgress: {
        always: [
          {
            guard: ({ context }) => context.images.length < context.totalPhotos,
            target: 'countdown',
          },
          {
            target: 'selecting',
          },
        ],
      },

      // Pilih sejumlah foto (sesuai paket) dari semua foto yang diambil
      selecting: {
        on: {
          TOGGLE_PHOTO: {
            actions: assign({
              selectedIndexes: ({ context, event }) => {
                const { selectedIndexes } = context;
                if (selectedIndexes.includes(event.index)) {
                  return selectedIndexes.filter((i) => i !== event.index);
                }
                if (selectedIndexes.length >= context.requiredPhotos) {
                  return selectedIndexes;
                }
                return [...selectedIndexes, event.index];
              },
            }),
          },
          CONFIRM_SELECTION: {
            guard: ({ context }) =>
              context.selectedIndexes.length === context.requiredPhotos,
            target: 'toning',
          },
          RESET: 'idle',
        },
      },

      // Pilih tone foto (warm, bright, B&W, cold, vivid)
      toning: {
        on: {
          SELECT_TONE: {
            actions: assign({ selectedToneId: ({ event }) => event.toneId }),
          },
          CONFIRM_TONE: 'segmenting',
          BACK: 'selecting',
        },
      },

      // Memisahkan orang dari background (sekali per foto, hasilnya di-cache)
      segmenting: {
        invoke: {
          id: 'segmentService',
          src: 'segmentPhotos',
          input: ({ context }) => ({
            images: context.images,
            selectedIndexes: context.selectedIndexes,
            cache: context.maskCache,
          }),
          onDone: {
            target: 'background',
            actions: assign({
              maskCache: ({ event }) =>
                event.output as Record<number, PersonMask>,
              segmentationError: null,
            }),
          },
          onError: {
            // Tetap lanjut ke halaman background, tapi hanya "Original" yang bisa dipilih
            target: 'background',
            actions: assign({
              selectedBackgroundId: 'original',
              segmentationError: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : 'Pemisahan background gagal',
            }),
          },
        },
      },

      // Pilih background pengganti di belakang orang
      background: {
        on: {
          SELECT_BACKGROUND: {
            actions: assign({
              selectedBackgroundId: ({ event }) => event.backgroundId,
            }),
          },
          RETRY_SEGMENTATION: 'segmenting',
          CONFIRM_BACKGROUND: {
            guard: ({ context }) =>
              context.selectedBackgroundId === 'original' ||
              context.selectedIndexes.every((i) => !!context.maskCache[i]),
            target: 'applyingEdits',
          },
          BACK: 'toning',
        },
      },

      // Terapkan tone + background ke 3 foto terpilih (resolusi penuh)
      applyingEdits: {
        invoke: {
          id: 'editService',
          src: 'applyEdits',
          input: ({ context }) => ({
            images: context.selectedIndexes.map((i) => context.images[i]),
            toneId: context.selectedToneId,
            backgroundId: context.selectedBackgroundId,
            masks: context.selectedIndexes.map((i) => context.maskCache[i]),
          }),
          onDone: {
            target: 'framing',
            actions: assign({
              editedImages: ({ event }) => event.output as string[],
            }),
          },
          onError: {
            target: 'failure',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : 'Edit foto gagal',
            }),
          },
        },
      },

      // Pilih layout (vertikal/horizontal) lalu frame, dengan preview dari 3 foto hasil edit
      framing: {
        on: {
          SELECT_FRAME: {
            actions: assign({
              selectedFrameId: ({ event }) => event.frameId,
            }),
          },
          CONFIRM_FRAME: 'stitching',
          BACK: 'background',
        },
      },

      stitching: {
        invoke: {
          id: 'stitchService',
          src: 'stitchPhotos',
          input: ({ context }) => {
            const frameConfig = getFrameById(context.selectedFrameId);
            if (!frameConfig) {
              throw new Error(`Frame not found: ${context.selectedFrameId}`);
            }
            return {
              // 3 foto terpilih yang sudah diedit, sesuai urutan pilihan
              images: context.editedImages,
              frameConfig,
            };
          },
          onDone: {
            target: 'uploading',
            actions: assign({
              finalStripBlob: ({ event }) => event.output as Blob,
            }),
          },
          onError: {
            target: 'failure',
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : 'Image processing failed',
            }),
          },
        },
      },

      // Upload ke Cloudinary baru terjadi di sini, setelah foto & frame dipilih
      uploading: {
        invoke: {
          id: 'uploadService',
          src: 'uploadToCloudinary',
          input: ({ context }) => ({
            blob: context.finalStripBlob!,
            cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
            uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
          }),
          onDone: {
            target: 'success',
            actions: assign({
              uploadUrl: ({ event }) => (event.output as { url: string; publicId: string }).url,
              publicId: ({ event }) => (event.output as { url: string; publicId: string }).publicId,
              uploadRetries: 0,
            }),
          },
          onError: [
            {
              guard: ({ context }) => context.uploadRetries < 3,
              target: 'uploading',
              actions: assign({
                uploadRetries: ({ context }) => context.uploadRetries + 1,
              }),
            },
            {
              target: 'failure',
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : 'Upload failed after 3 retries',
              }),
            },
          ],
        },
      },

      success: {
        after: {
          60000: 'idle',
        },
        on: {
          RESET: 'idle',
        },
      },

      failure: {
        on: {
          RETRY: 'idle',
        },
      },
    },
  },
  {
    actors: {
      segmentPhotos: fromPromise<Record<number, PersonMask>, SegmentInput>(async () => {
        throw new Error('Segment service not provided');
      }),
      applyEdits: fromPromise<string[], EditInput>(async () => {
        throw new Error('Edit service not provided');
      }),
      stitchPhotos: fromPromise<Blob, StitchInput>(async () => {
        throw new Error('Stitch service not provided');
      }),
      uploadToCloudinary: fromPromise<{ url: string; publicId: string }, UploadInput>(async () => {
        throw new Error('Upload service not provided');
      }),
    },
  }
);
