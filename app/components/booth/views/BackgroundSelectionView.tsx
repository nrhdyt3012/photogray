import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { BACKGROUNDS, renderPhoto, type PersonMask } from '~/lib/photo-edit';
import { cn } from '~/lib/utils';

interface BackgroundSelectionViewProps {
  images: string[]; // 3 foto terpilih (asli)
  masks: (PersonMask | undefined)[]; // mask orang per foto (kosong jika segmentasi gagal)
  toneId: string;
  selectedBackgroundId: string;
  segmentationError: string | null;
  onSelectBackground: (backgroundId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  onRetry: () => void;
}

export function BackgroundSelectionView({
  images,
  masks,
  toneId,
  selectedBackgroundId,
  segmentationError,
  onSelectBackground,
  onConfirm,
  onBack,
  onRetry,
}: BackgroundSelectionViewProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const hasMasks = masks.length > 0 && masks.every((m) => !!m);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      images.map((src, i) =>
        renderPhoto({
          src,
          toneId,
          backgroundId: selectedBackgroundId,
          mask: masks[i],
          maxWidth: 640,
        }),
      ),
    )
      .then((result) => {
        if (!cancelled) setPreviews(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [images, masks, toneId, selectedBackgroundId]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8">
      <div className="w-full max-w-6xl space-y-8 text-center">
        <div className="space-y-2">
          <h2 className="text-5xl font-bold">Pilih Background</h2>
          <p className="text-xl text-blue-100">
            Ganti latar belakang di belakangmu
          </p>
        </div>

        {segmentationError && (
          <div className="bg-red-500/30 border border-red-200 rounded-xl p-4 space-y-3">
            <p>
              Background tidak bisa diganti saat ini ({segmentationError}).
              Hanya pilihan Original yang tersedia.
            </p>
            <Button
              onClick={onRetry}
              variant="outline"
              className="bg-transparent text-white border-white hover:bg-white/20"
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Pratinjau 3 foto */}
        <div className="grid grid-cols-3 gap-4">
          {images.map((_, i) => (
            <div
              key={i}
              className="aspect-video bg-black/30 rounded-lg overflow-hidden shadow-2xl"
            >
              {previews[i] && (
                <img
                  src={previews[i]}
                  alt={`Foto ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>

        {/* Pilihan background */}
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {BACKGROUNDS.map((bg) => {
            const disabled = bg.id !== 'original' && !hasMasks;
            return (
              <button
                key={bg.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectBackground(bg.id)}
                className={cn(
                  'relative p-1.5 rounded-lg border-2 transition-all duration-200',
                  selectedBackgroundId === bg.id
                    ? 'border-yellow-400 bg-white/20 shadow-2xl'
                    : 'border-white/30 bg-white/10',
                  disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:scale-105',
                )}
              >
                <div
                  className="aspect-square rounded border border-white/40"
                  style={{ background: bg.swatch }}
                />
                <p className="mt-1 text-sm font-medium">{bg.name}</p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 pt-2">
          <Button
            onClick={onBack}
            size="lg"
            variant="outline"
            className="text-xl px-8 py-6 bg-transparent text-white border-2 border-white hover:bg-white/20 rounded-full"
          >
            Ganti Tone
          </Button>
          <Button
            onClick={onConfirm}
            size="lg"
            className="text-xl px-10 py-6 bg-white text-purple-600 hover:bg-blue-50 rounded-full shadow-2xl"
          >
            Lanjut Pilih Frame
          </Button>
        </div>
      </div>
    </div>
  );
}
