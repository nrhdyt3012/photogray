import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';

export interface IdleSession {
  status: 'ready' | 'in_progress';
  packageName: string;
  photosTaken: number;
  photosSelected: number;
  printLayout: 'half' | 'full';
}

interface IdleViewProps {
  onStart: () => void;
  roomName: string;
  /** Sesi yang sudah dibayar kasir untuk ruangan ini (null = belum ada). */
  session: IdleSession | null;
  starting: boolean;
  connectionError: boolean;
}

type CameraStatus = 'checking' | 'granted' | 'denied' | 'error';

export function IdleView({
  onStart,
  roomName,
  session,
  starting,
  connectionError,
}: IdleViewProps) {
  // Tombol hanya menyala jika kasir sudah menyimpan transaksi untuk ruangan ini
  const unlocked = session?.status === 'ready';
  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>('checking');

  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Request camera permission on mount
    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });

        // Permission granted - stop the stream immediately
        stream.getTracks().forEach((track) => track.stop());
        setCameraStatus('granted');
      } catch (error) {
        setCameraStatus('denied');

        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setErrorMessage(
              'Camera permission denied. Please allow camera access.',
            );
          } else if (error.name === 'NotFoundError') {
            setErrorMessage('No camera found on this device.');
          } else {
            setErrorMessage('Camera access error: ' + error.message);
          }
        }
      }
    };

    requestCamera();
  }, []);

  const handleRetryPermission = async () => {
    setCameraStatus('checking');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraStatus('granted');
    } catch (error) {
      setCameraStatus('denied');
      if (error instanceof Error) {
        setErrorMessage(
          'Camera permission denied. Please check browser settings.',
        );
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold animate-pulse">
          Snap & Go
        </h1>
        <p className="text-2xl text-blue-100">{roomName}</p>

        {/* Camera status indicator */}
        <div className="mt-8">
          {cameraStatus === 'checking' && (
            <div className="flex items-center justify-center gap-2 text-yellow-200">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Requesting camera access...</span>
            </div>
          )}
          {cameraStatus === 'granted' && (
            <div className="text-green-200 flex items-center justify-center gap-2">
              <span className="text-2xl">✓</span>
              <span>Camera ready</span>
            </div>
          )}
          {cameraStatus === 'denied' && (
            <div className="text-red-200 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">✗</span>
                <span>{errorMessage}</span>
              </div>
              <Button
                onClick={handleRetryPermission}
                variant="outline"
                className="text-white border-white hover:bg-white hover:text-purple-600"
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        <div className="mt-12">
          <Button
            onClick={onStart}
            disabled={cameraStatus !== 'granted' || !unlocked || starting}
            size="lg"
            className="text-2xl px-12 py-8 bg-white text-purple-600 hover:bg-blue-50 hover:scale-105 transition-all duration-300 rounded-full shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {starting ? 'Memulai...' : 'Start Photo Session'}
          </Button>
        </div>

        <div className="mt-10 text-blue-100 space-y-2 min-h-[7rem]" aria-live="polite">
          {connectionError ? (
            <p className="text-lg text-yellow-200">
              Tidak bisa terhubung ke server. Hubungi petugas.
            </p>
          ) : !session ? (
            <p className="text-xl">Silakan lakukan pembayaran di kasir untuk memulai.</p>
          ) : session.status === 'in_progress' ? (
            <p className="text-xl text-yellow-200">
              Sesi sebelumnya belum selesai. Hubungi petugas.
            </p>
          ) : (
            <>
              <p className="text-lg">✓ {session.packageName}</p>
              <p className="text-lg">✓ Ambil {session.photosTaken} foto dengan hitung mundur</p>
              <p className="text-lg">
                ✓ Pilih {session.photosSelected} foto terbaik &amp; satu frame
              </p>
              <p className="text-lg">
                ✓ Cetak 4R {session.printLayout === 'half' ? 'dibagi 2' : 'penuh'} &amp; unduh lewat QR
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
