import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { getAllFrames, getFrameById } from '~/lib/frame-config';
import { cn } from '~/lib/utils';

interface FrameSelectionViewProps {
  selectedImages: string[]; // 3 foto terpilih, berurutan sesuai slot
  selectedFrameId: string;
  onSelectFrame: (frameId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

type OrientationFilter = 'all' | 'vertical' | 'horizontal';

export function FrameSelectionView({
  selectedImages,
  selectedFrameId,
  onSelectFrame,
  onConfirm,
  onBack,
}: FrameSelectionViewProps) {
  const [filter, setFilter] = useState<OrientationFilter>('all');

  const frames = getAllFrames().filter(
    (f) => filter === 'all' || f.orientation === filter,
  );
  const current = getFrameById(selectedFrameId);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8">
      <div className="w-full max-w-6xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-5xl font-bold">Pilih Frame</h2>
          <p className="text-xl text-blue-100">
            Pratinjau di bawah memakai 3 foto pilihanmu
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Preview: frame di bawah, foto ditempel di slot (sama seperti hasil stitcher) */}
          <div className="flex justify-center">
            {current && (
              <div
                className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
                style={{
                  aspectRatio: `${current.width} / ${current.height}`,
                  height: current.orientation === 'vertical' ? '60vh' : undefined,
                  width: current.orientation === 'horizontal' ? '100%' : undefined,
                  maxWidth: '100%',
                }}
              >
                <img
                  src={current.path}
                  alt={current.name}
                  className="absolute inset-0 w-full h-full"
                />
                {current.photoSlots.map((slot, i) => (
                  <div
                    key={i}
                    className="absolute bg-cover bg-center"
                    style={{
                      left: `${(slot.x / current.width) * 100}%`,
                      top: `${(slot.y / current.height) * 100}%`,
                      width: `${(slot.width / current.width) * 100}%`,
                      height: `${(slot.height / current.height) * 100}%`,
                      backgroundImage: `url(${selectedImages[i]})`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pilihan frame */}
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {(['all', 'vertical', 'horizontal'] as const).map((f) => (
                <Button
                  key={f}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'capitalize border-2 transition-all',
                    filter === f
                      ? 'bg-white text-purple-600 border-white hover:bg-white'
                      : 'bg-transparent text-white border-white/50 hover:bg-white/20 hover:border-white',
                  )}
                >
                  {f}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {frames.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => onSelectFrame(frame.id)}
                  className={cn(
                    'relative p-1.5 rounded-lg border-2 transition-all duration-200 hover:scale-105',
                    selectedFrameId === frame.id
                      ? 'border-yellow-400 bg-white/20 shadow-2xl'
                      : 'border-white/30 bg-white/10',
                  )}
                >
                  <div className="aspect-[3/4] bg-white rounded overflow-hidden">
                    <img
                      src={frame.path}
                      alt={frame.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="mt-1 text-sm font-medium">{frame.name}</p>
                  {selectedFrameId === frame.id && (
                    <div className="absolute top-1 left-1 text-lg bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center text-purple-600">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
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
            Selesai
          </Button>
        </div>
      </div>
    </div>
  );
}
