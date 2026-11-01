import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import Webcam from 'react-webcam';
import { fromPromise } from 'xstate';
import { match } from 'ts-pattern';
import { boothMachine, TOTAL_PHOTOS } from '~/machines/boothMachine';
import { stitchPhotos } from '~/lib/canvas-stitcher';
import { uploadToCloudinary } from '~/lib/cloudinary-upload';
import { renderPhoto, type PersonMask } from '~/lib/photo-edit';
import { getSegmenter, segmentPerson } from '~/lib/person-segmentation';
import { generateBeepSound, generateShutterSound } from '~/lib/audio-utils';
import type { FrameConfig } from '~/lib/frame-config';
import { IdleView } from './views/IdleView';
import { CountdownView } from './views/CountdownView';
import { ProcessingView } from './views/ProcessingView';
import { SuccessView } from './views/SuccessView';
import { FailureView } from './views/FailureView';
import { PhotoSelectionView } from './views/PhotoSelectionView';
import { FrameSelectionView } from './views/FrameSelectionView';
import { ToneSelectionView } from './views/ToneSelectionView';
import { BackgroundSelectionView } from './views/BackgroundSelectionView';

export function BoothContainer() {
  const webcamRef = useRef<Webcam | null>(null);
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const shutterAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webcamReadyRef = useRef(false);

  // Initialize state machine with service implementations
  const [state, send] = useMachine(
    boothMachine.provide({
      actors: {
        segmentPhotos: fromPromise(async ({ input }) => {
          const { images, selectedIndexes, cache } = input as {
            images: string[];
            selectedIndexes: number[];
            cache: Record<number, PersonMask>;
          };
          const next = { ...cache };
          // Berurutan (bukan paralel) supaya pemakaian memori tetap kecil
          for (const i of selectedIndexes) {
            if (!next[i]) next[i] = await segmentPerson(images[i]);
          }
          return next;
        }),
        applyEdits: fromPromise(async ({ input }) => {
          const { images, toneId, backgroundId, masks } = input as {
            images: string[];
            toneId: string;
            backgroundId: string;
            masks: (PersonMask | undefined)[];
          };
          return await Promise.all(
            images.map((src, i) =>
              renderPhoto({ src, toneId, backgroundId, mask: masks[i] }),
            ),
          );
        }),
        stitchPhotos: fromPromise(async ({ input }) => {
          const { images, frameConfig } = input as {
            images: string[];
            frameConfig: FrameConfig;
          };
          return await stitchPhotos(images, frameConfig);
        }),
        uploadToCloudinary: fromPromise(async ({ input }) => {
          const { blob, cloudName, uploadPreset } = input as {
            blob: Blob;
            cloudName: string;
            uploadPreset: string;
          };
          return await uploadToCloudinary(blob, cloudName, uploadPreset);
        }),
      }
    })
  );

  // Foto terpilih & mask-nya (di-memo agar tidak memicu render ulang pratinjau)
  const { images, selectedIndexes, maskCache } = state.context;
  const selectedImages = useMemo(
    () => selectedIndexes.map((i) => images[i]),
    [selectedIndexes, images],
  );
  const selectedMasks = useMemo(
    () => selectedIndexes.map((i) => maskCache[i]),
    [selectedIndexes, maskCache],
  );

  // Muat model pemisah background lebih awal (selama sesi foto berjalan)
  useEffect(() => {
    getSegmenter().catch(() => {});
  }, []);

  // Handle webcam ready
  const handleWebcamReady = useCallback(() => {
    webcamReadyRef.current = true;
  }, []);

  // Initialize audio on mount
  useEffect(() => {
    try {
      const beepDataUrl = generateBeepSound();
      const shutterDataUrl = generateShutterSound();

      beepAudioRef.current = new Audio(beepDataUrl);
      shutterAudioRef.current = new Audio(shutterDataUrl);

      // Preload
      beepAudioRef.current.load();
      shutterAudioRef.current.load();
    } catch (error) {
      // Ignore error
    }

    return () => {
      beepAudioRef.current = null;
      shutterAudioRef.current = null;
    };
  }, []);

  // Reset webcam ready flag on state transitions
  useEffect(() => {
    // Reset webcam ready when entering countdown (new webcam instance)
    if (state.matches('countdown')) {
      webcamReadyRef.current = false;
    }
  }, [state.value]);

  // Handle countdown ticks and audio
  useEffect(() => {
    if (state.matches('countdown')) {
      // Play beep sound
      beepAudioRef.current?.play().catch(() => {});

      // Start countdown tick interval
      let tickCount = 0;
      countdownIntervalRef.current = setInterval(() => {
        tickCount++;
        if (tickCount < 3) {
          send({ type: 'COUNTDOWN_TICK' });
          beepAudioRef.current?.play().catch(() => {});
        }
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [state.value, send]);

  // Capture photo callback
  const capturePhoto = useCallback(() => {
    try {
      if (!webcamRef.current) {
        throw new Error('Webcam ref is null');
      }

      const screenshot = webcamRef.current.getScreenshot();

      if (!screenshot) {
        throw new Error('Screenshot returned null - check camera permissions');
      }

      return screenshot;
    } catch (error) {
      throw error;
    }
  }, []);

  // Handle capture with retry logic
useEffect(() => {
  if (!state.matches('capture')) return;

  shutterAudioRef.current?.play().catch(() => {});

  let cancelled = false;
  let attempts = 0;
  const maxAttempts = 30; // ±6 detik
  let timer: ReturnType<typeof setTimeout>;

  const attemptCapture = () => {
    if (cancelled) return;
    attempts++;

    const video = webcamRef.current?.video;
    if (video && video.readyState === 4) {
      const shot = webcamRef.current!.getScreenshot();
      if (shot) {
        send({ type: 'CAPTURE_DONE', image: shot });
        return;
      }
    }

    if (attempts < maxAttempts) {
      timer = setTimeout(attemptCapture, 200);
    } else {
      console.error('Capture gagal', {
        attempts,
        hasRef: !!webcamRef.current,
        readyState: video?.readyState,
      });
      send({ type: 'CAPTURE_ERROR', error: 'Camera not ready' });
    }
  };

  timer = setTimeout(attemptCapture, 300);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [state.value, send]);

  // Render appropriate view based on state using pattern matching
  return match(state.value)
    .with('idle', () => (
      <IdleView onStart={() => send({ type: 'START' })} />
    ))
    .with('countdown', 'capture', () => (
      <CountdownView
        countdown={state.context.countdown}
        webcamRef={webcamRef}
        currentPhotoNumber={Math.min(state.context.currentImageIndex + 1, TOTAL_PHOTOS)}
        totalPhotos={TOTAL_PHOTOS}
        isCapturing={state.matches('capture')}
        onWebcamReady={handleWebcamReady}
      />
    ))
    .with('checkProgress', () => (
      <ProcessingView message="Processing..." />
    ))
    .with('selecting', () => (
      <PhotoSelectionView
        images={state.context.images}
        selectedIndexes={state.context.selectedIndexes}
        onToggle={(index: number) => send({ type: 'TOGGLE_PHOTO', index })}
        onConfirm={() => send({ type: 'CONFIRM_SELECTION' })}
        onStartOver={() => send({ type: 'RESET' })}
      />
    ))
    .with('toning', () => (
      <ToneSelectionView
        images={selectedImages}
        selectedToneId={state.context.selectedToneId}
        onSelectTone={(toneId: string) => send({ type: 'SELECT_TONE', toneId })}
        onConfirm={() => send({ type: 'CONFIRM_TONE' })}
        onBack={() => send({ type: 'BACK' })}
      />
    ))
    .with('segmenting', () => (
      <ProcessingView message="Menyiapkan editor background..." />
    ))
    .with('background', () => (
      <BackgroundSelectionView
        images={selectedImages}
        masks={selectedMasks}
        toneId={state.context.selectedToneId}
        selectedBackgroundId={state.context.selectedBackgroundId}
        segmentationError={state.context.segmentationError}
        onSelectBackground={(backgroundId: string) =>
          send({ type: 'SELECT_BACKGROUND', backgroundId })
        }
        onConfirm={() => send({ type: 'CONFIRM_BACKGROUND' })}
        onBack={() => send({ type: 'BACK' })}
        onRetry={() => send({ type: 'RETRY_SEGMENTATION' })}
      />
    ))
    .with('applyingEdits', () => (
      <ProcessingView message="Menerapkan editan fotomu..." />
    ))
    .with('framing', () => (
      <FrameSelectionView
        selectedImages={state.context.editedImages}
        selectedFrameId={state.context.selectedFrameId}
        onSelectFrame={(frameId: string) => send({ type: 'SELECT_FRAME', frameId })}
        onConfirm={() => send({ type: 'CONFIRM_FRAME' })}
        onBack={() => send({ type: 'BACK' })}
      />
    ))
    .with('stitching', () => (
      <ProcessingView message="Creating your photo strip..." />
    ))
    .with('uploading', () => (
      <ProcessingView message="Uploading your photos..." />
    ))
    .with('success', () => (
      <SuccessView
        uploadUrl={state.context.uploadUrl!}
        publicId={state.context.publicId!}
        images={state.context.editedImages}
        onReset={() => send({ type: 'RESET' })}
      />
    ))
    .with('failure', () => (
      <FailureView
        error={state.context.error || 'An unknown error occurred'}
        onRetry={() => send({ type: 'RETRY' })}
      />
    ))
    .otherwise(() => <div>Loading...</div>);
}
