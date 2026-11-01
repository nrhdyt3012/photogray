import { useEffect, useRef, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import Webcam from 'react-webcam';
import { fromPromise } from 'xstate';
import { match } from 'ts-pattern';
import { boothMachine, TOTAL_PHOTOS } from '~/machines/boothMachine';
import { stitchPhotos } from '~/lib/canvas-stitcher';
import { uploadToCloudinary } from '~/lib/cloudinary-upload';
import { generateBeepSound, generateShutterSound } from '~/lib/audio-utils';
import type { FrameConfig } from '~/lib/frame-config';
import { IdleView } from './views/IdleView';
import { CountdownView } from './views/CountdownView';
import { CaptureView } from './views/CaptureView';
import { ProcessingView } from './views/ProcessingView';
import { SuccessView } from './views/SuccessView';
import { FailureView } from './views/FailureView';
import { PhotoSelectionView } from './views/PhotoSelectionView';
import { FrameSelectionView } from './views/FrameSelectionView';

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
    .with('countdown', () => (
      <CountdownView
        countdown={state.context.countdown}
        webcamRef={webcamRef}
        currentPhotoNumber={state.context.currentImageIndex + 1}
        totalPhotos={TOTAL_PHOTOS}
        onWebcamReady={handleWebcamReady}
      />
    ))
    .with('capture', () => (
      <CaptureView
        webcamRef={webcamRef}
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
    .with('framing', () => (
      <FrameSelectionView
        selectedImages={state.context.selectedIndexes.map(
          (i) => state.context.images[i],
        )}
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
        images={state.context.selectedIndexes.map((i) => state.context.images[i])}
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
