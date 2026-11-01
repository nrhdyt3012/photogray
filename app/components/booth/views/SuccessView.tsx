import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { printImage } from '~/lib/print-image';
import { composePrintSheet } from '~/lib/print-sheet';
import type { PrintLayout } from '~/machines/boothMachine';

interface SuccessViewProps {
  uploadUrl: string;
  publicId: string;
  images: string[]; // foto terpilih hasil edit (base64)
  printLayout: PrintLayout; // half = 4R dibagi 2, full = 4R penuh
  onReset: () => void;
}

export function SuccessView({
  uploadUrl,
  publicId,
  images,
  printLayout,
  onReset,
}: SuccessViewProps) {
  const [printing, setPrinting] = useState(false);
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const sheet = await composePrintSheet(uploadUrl, printLayout);
      printImage(sheet);
      setTimeout(() => URL.revokeObjectURL(sheet), 60000);
    } finally {
      setPrinting(false);
    }
  };

  // Detect image orientation
  const [imageOrientation, setImageOrientation] = useState<
    'vertical' | 'horizontal'
  >('vertical');

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageOrientation(
        img.width > img.height ? 'horizontal' : 'vertical',
      );
    };
    img.src = uploadUrl;
  }, [uploadUrl]);

  // Construct the retrieval URL using base URL from env or production default
  const baseUrl = import.meta.env.VITE_BASE_URL || '';
  const retrievalUrl = `${baseUrl}/photo/${encodeURIComponent(
    publicId,
  )}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-500 to-blue-600 text-white p-8">
      <div className="text-center space-y-8 max-w-4xl">
        <div className="space-y-4">
          <div className="text-6xl">✓</div>
          <h2 className="text-5xl font-bold">All Done!</h2>
          <p className="text-2xl text-green-100">
            Your photo strip is ready
          </p>
        </div>

        {/* Display all 3 captured photos */}
        <div className="flex justify-center gap-4 flex-wrap">
          {images.map((image, index) => (
            <div
              key={index}
              className="bg-white p-3 rounded-lg shadow-2xl"
            >
              <img
                src={image}
                alt={`Photo ${index + 1}`}
                className="w-48 h-auto rounded shadow-lg"
              />
              <p className="text-gray-700 text-sm mt-2 font-semibold">
                Photo {index + 1}
              </p>
            </div>
          ))}
        </div>

        {/* Photo Strip and QR Code - responsive layout based on orientation */}
        <div
          className={cn(
            'flex justify-center items-start gap-8 flex-wrap',
            imageOrientation === 'horizontal'
              ? 'flex-col items-center'
              : '',
          )}
        >
          {/* Final stitched photo strip */}
          <div className="flex flex-col items-center">
            <h3 className="text-2xl font-semibold mb-4">
              Final Photo Strip
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-2xl">
              <img
                src={uploadUrl}
                alt="Your photo strip"
                className={cn(
                  'rounded shadow-lg',
                  imageOrientation === 'vertical'
                    ? 'w-64 h-auto'
                    : 'h-64 w-auto',
                )}
              />
            </div>
          </div>

          {/* QR Code with Instructions and Button */}
          <div className="flex flex-col items-center">
            <h3 className="text-2xl font-semibold mb-4">
              Scan to Download
            </h3>
            <div className="bg-white p-8 rounded-2xl shadow-2xl">
              <div className="mb-4">
                <p className="text-gray-600 text-center">
                  Use your phone camera
                </p>
              </div>
              <QRCodeSVG
                value={retrievalUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Instructions below QR code */}
            <div className="mt-6 space-y-2 text-lg text-green-100">
              <p>📱 Open your phone camera</p>
              <p>📸 Point at the QR code</p>
              <p>💾 Download your photo strip</p>
            </div>

            {/* Print + Start New Session */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                onClick={handlePrint}
                disabled={printing}
                size="lg"
                className="text-xl px-8 py-6 bg-white text-green-700 hover:bg-green-50 rounded-full shadow-2xl"
              >
                {printing ? 'Menyiapkan...' : printLayout === 'half' ? 'Cetak (4R dibagi 2)' : 'Cetak (4R penuh)'}
              </Button>
              <Button
                onClick={onReset}
                size="lg"
                variant="outline"
                className="text-xl px-8 py-6 bg-white/20 hover:bg-white/30 text-white border-2 border-white rounded-full"
              >
                Start New Session
              </Button>
            </div>
          </div>
        </div>

        <p className="text-sm text-green-200 opacity-75">
          This session will auto-reset in 60 seconds
        </p>
      </div>
    </div>
  );
}
