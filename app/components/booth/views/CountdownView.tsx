import Webcam from 'react-webcam';
import type { RefObject } from 'react';

interface CountdownViewProps {
  countdown: number;
  webcamRef: RefObject<Webcam | null>;
  currentPhotoNumber: number; // 1..totalPhotos
  totalPhotos: number;
  isCapturing: boolean; // true saat jepret: sembunyikan angka, tampilkan flash
  onWebcamReady?: () => void;
}

export function CountdownView({ countdown, webcamRef, currentPhotoNumber, totalPhotos, isCapturing, onWebcamReady }: CountdownViewProps) {
  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* Webcam preview (mirrored) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          videoConstraints={{
            width: 1920,
            height: 1080,
            facingMode: 'user',
          }}
          mirrored={true}
          onUserMedia={onWebcamReady}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Photo number indicator */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="bg-white/90 px-6 py-3 rounded-full">
          <p className="text-xl font-semibold text-gray-800">
            Photo {currentPhotoNumber} of {totalPhotos}
          </p>
        </div>
      </div>

      {/* Countdown number (di atas kamera yang tetap menyala) */}
      {!isCapturing && (
        <div className="relative z-10 text-center">
          <div
            key={countdown}
            className="text-white font-bold animate-pulse"
            style={{ fontSize: '20rem', lineHeight: '1', textShadow: '0 0 40px rgba(0,0,0,0.6)' }}
          >
            {countdown}
          </div>
          <p className="text-4xl text-white mt-8 animate-bounce">
            Get ready!
          </p>
        </div>
      )}

      {/* Flash saat jepret */}
      {isCapturing && (
        <>
          <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-20" />
          <style>{`
            @keyframes flash {
              0%, 100% { opacity: 0; }
              50% { opacity: 1; }
            }
            .animate-flash { animation: flash 0.3s ease-in-out; }
          `}</style>
        </>
      )}
    </div>
  );
}
