import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { TONES, renderPhoto } from '~/lib/photo-edit';
import { cn } from '~/lib/utils';

interface ToneSelectionViewProps {
  images: string[]; // 3 foto terpilih (asli)
  selectedToneId: string;
  onSelectTone: (toneId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function ToneSelectionView({
  images,
  selectedToneId,
  onSelectTone,
  onConfirm,
  onBack,
}: ToneSelectionViewProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Pratinjau 3 foto dengan tone yang dipilih
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      images.map((src) =>
        renderPhoto({ src, toneId: selectedToneId, maxWidth: 640 }),
      ),
    )
      .then((result) => {
        if (!cancelled) setPreviews(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [images, selectedToneId]);

  // Thumbnail tiap tone (dari foto pertama)
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TONES.map(async (tone) => [
        tone.id,
        await renderPhoto({ src: images[0], toneId: tone.id, maxWidth: 240 }),
      ] as const),
    )
      .then((entries) => {
        if (!cancelled) setThumbs(Object.fromEntries(entries));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [images]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8">
      <div className="w-full max-w-6xl space-y-8 text-center">
        <div className="space-y-2">
          <h2 className="text-5xl font-bold">Pilih Tone Foto</h2>
          <p className="text-xl text-blue-100">
            Pilih suasana warna untuk ketiga fotomu
          </p>
        </div>

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

        {/* Pilihan tone */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              onClick={() => onSelectTone(tone.id)}
              className={cn(
                'relative p-1.5 rounded-lg border-2 transition-all duration-200 hover:scale-105',
                selectedToneId === tone.id
                  ? 'border-yellow-400 bg-white/20 shadow-2xl'
                  : 'border-white/30 bg-white/10',
              )}
            >
              <div className="aspect-video bg-black/30 rounded overflow-hidden">
                {thumbs[tone.id] && (
                  <img
                    src={thumbs[tone.id]}
                    alt={tone.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <p className="mt-1 text-sm font-medium">{tone.name}</p>
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4 pt-2">
          <Button
            onClick={onBack}
            size="lg"
            variant="outline"
            className="text-xl px-8 py-6 bg-transparent text-white border-2 border-white hover:bg-white/20 rounded-full"
          >
            Ganti Foto
          </Button>
          <Button
            onClick={onConfirm}
            size="lg"
            className="text-xl px-10 py-6 bg-white text-purple-600 hover:bg-blue-50 rounded-full shadow-2xl"
          >
            Lanjut Pilih Background
          </Button>
        </div>
      </div>
    </div>
  );
}
