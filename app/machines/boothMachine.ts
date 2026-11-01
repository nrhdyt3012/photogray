import { assign, createMachine, fromPromise } from 'xstate';
import { getDefaultFrame, getFrameById, type FrameConfig } from '~/lib/frame-config';

// Jumlah foto yang diambil, dan jumlah foto yang dipilih untuk masuk frame
export const TOTAL_PHOTOS = 10;
export const REQUIRED_PHOTOS = 3;

export interface BoothContext {
  images: string[]; // semua foto hasil jepretan (base64 data URLs), maks TOTAL_PHOTOS
  currentImageIndex: number; // 0-9 untuk progress
  selectedIndexes: number[]; // index foto terpilih, urutannya = urutan slot di frame
  finalStripBlob: Blob | null; // hasil stitching lokal
  uploadUrl: string | null; // Cloudinary secure_url
  publicId: string | null; // Cloudinary public_id untuk QR code
  error: string | null;
  countdown: number; // 3, 2, 1 untuk tampilan UI
  uploadRetries: number;
  selectedFrameId: string;
}

export type BoothEvent =
  | { type: 'START' }
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'COUNTDOWN_DONE' }
  | { type: 'CAPTURE_DONE'; image: string }
  | { type: 'CAPTURE_ERROR'; error: string }
  | { type: 'TOGGLE_PHOTO'; index: number }
  | { type: 'CONFIRM_SELECTION' }
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
      images: [],
      currentImageIndex: 0,
      selectedIndexes: [],
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
          images: [],
          currentImageIndex: 0,
          selectedIndexes: [],
          finalStripBlob: null,
          uploadUrl: null,
          publicId: null,
          error: null,
          countdown: 3,
          uploadRetries: 0,
          selectedFrameId: getDefaultFrame().id,
        }),
        on: {
          START: 'countdown',
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
            guard: ({ context }) => context.images.length < TOTAL_PHOTOS,
            target: 'countdown',
          },
          {
            target: 'selecting',
          },
        ],
      },

      // Pilih 3 dari 10 foto
      selecting: {
        entry: assign({ selectedIndexes: [] }),
        on: {
          TOGGLE_PHOTO: {
            actions: assign({
              selectedIndexes: ({ context, event }) => {
                const { selectedIndexes } = context;
                if (selectedIndexes.includes(event.index)) {
                  return selectedIndexes.filter((i) => i !== event.index);
                }
                if (selectedIndexes.length >= REQUIRED_PHOTOS) {
                  return selectedIndexes;
                }
                return [...selectedIndexes, event.index];
              },
            }),
          },
          CONFIRM_SELECTION: {
            guard: ({ context }) =>
              context.selectedIndexes.length === REQUIRED_PHOTOS,
            target: 'framing',
          },
          RESET: 'idle',
        },
      },

      // Pilih frame, dengan preview dari 3 foto terpilih
      framing: {
        on: {
          SELECT_FRAME: {
            actions: assign({
              selectedFrameId: ({ event }) => event.frameId,
            }),
          },
          CONFIRM_FRAME: 'stitching',
          BACK: 'selecting',
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
              // Hanya 3 foto terpilih, sesuai urutan pilihan
              images: context.selectedIndexes.map((i) => context.images[i]),
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
      stitchPhotos: fromPromise<Blob, StitchInput>(async () => {
        throw new Error('Stitch service not provided');
      }),
      uploadToCloudinary: fromPromise<{ url: string; publicId: string }, UploadInput>(async () => {
        throw new Error('Upload service not provided');
      }),
    },
  }
);
