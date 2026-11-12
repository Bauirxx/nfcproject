import { downloadBlob, downloadText } from '@/shared/lib/download';
import { qrSvgMarkup } from '@/shared/lib/qr';

export function downloadQrSvg(value: string, filename: string): void {
  downloadText(qrSvgMarkup(value), filename, 'image/svg+xml');
}

/** Converte o SVG do QR num PNG, desenhando-o num canvas. */
export async function downloadQrPng(value: string, filename: string, pixels = 512): Promise<void> {
  const svg = qrSvgMarkup(value, { scale: 1 });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.width = pixels;
    image.height = pixels;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('qr_image_failed'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas_unsupported');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, pixels, pixels);
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
        resolve();
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
