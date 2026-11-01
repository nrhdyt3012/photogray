import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface PhotoSelectionViewProps {
  images: string[];
  selectedIndexes: number[]; // urutan = urutan slot di frame
  requiredPhotos: number; // jumlah foto yang harus dipilih (dari paket)
  onToggle: (index: number) => void;
  onConfirm: () => void;
  onStartOver: () => void;
}

export function PhotoSelectionView({
  images,
  selectedIndexes,
  requiredPhotos,
  onToggle,
  onConfirm,
  onStartOver,
}: PhotoSelectionViewProps) {
  const isComplete = selectedIndexes.length === requiredPhotos;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-8">
      <div className="w-full max-w-6xl space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-5xl font-bold">Pilih {requiredPhotos} Foto Terbaikmu</h2>
          <p className="text-xl text-blue-100">
            Ketuk foto untuk memilih. Urutan pilihan = urutan di frame.
          </p>
          <p className="text-2xl font-semibold">
            {selectedIndexes.length} / {requiredPhotos} dipilih
          </p>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {images.map((image, index) => {
            const order = selectedIndexes.indexOf(index);
            const isSelected = order !== -1;
            const isLocked = !isSelected && isComplete;

            return (
              <button
                key={index}
                type="button"
                onClick={() => onToggle(index)}
                className={cn(
                  'relative rounded-lg overflow-hidden border-4 transition-all duration-200',
                  isSelected
                    ? 'border-yellow-400 scale-105 shadow-2xl'
                    : 'border-white/30 hover:border-white/70',
                  isLocked && 'opacity-40',
                )}
              >
                <img
                  src={image}
                  alt={`Foto ${index + 1}`}
                  className="w-full aspect-video object-cover"
                />
                {isSelected && (
                  <div className="absolute top-2 left-2 w-10 h-10 rounded-full bg-yellow-400 text-purple-700 text-xl font-bold flex items-center justify-center shadow-lg">
                    {order + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 pt-4">
          <Button
            onClick={onStartOver}
            size="lg"
            variant="outline"
            className="text-xl px-8 py-6 bg-transparent text-white border-2 border-white hover:bg-white/20 rounded-full"
          >
            Ulangi dari Awal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!isComplete}
            size="lg"
            className="text-xl px-10 py-6 bg-white text-purple-600 hover:bg-blue-50 rounded-full shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Lanjut Pilih Frame
          </Button>
        </div>
      </div>
    </div>
  );
}
