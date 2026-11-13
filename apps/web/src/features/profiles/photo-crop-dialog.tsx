import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog } from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { commonTexts } from '@/shared/i18n/panel/common';
import { profileTexts } from '@/shared/i18n/panel/profiles';

const OUTPUT_SIZE = 512;
const OUTPUT_TYPE = 'image/jpeg';
const VIEWPORT = 256;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Retângulo de origem (em píxeis naturais) de um recorte quadrado, dado o zoom e o deslocamento (-1 a 1). */
export function computeCropSource(
  naturalWidth: number,
  naturalHeight: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): { sx: number; sy: number; side: number } {
  const minSide = Math.min(naturalWidth, naturalHeight);
  const side = minSide / Math.max(1, zoom);
  const sx = ((naturalWidth - side) * (clamp(offsetX, -1, 1) + 1)) / 2;
  const sy = ((naturalHeight - side) * (clamp(offsetY, -1, 1) + 1)) / 2;
  return { sx, sy, side };
}

interface PhotoCropDialogProps {
  file: File;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}

export function PhotoCropDialog({ file, onClose, onCropped }: PhotoCropDialogProps) {
  const [objectUrl] = useState(() => {
    try {
      return URL.createObjectURL(file);
    } catch {
      return '';
    }
  });
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(
    () => () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* jsdom ou browser sem suporte: sem efeito */
        }
      }
    },
    [objectUrl],
  );

  const minSide = natural ? Math.min(natural.width, natural.height) : 0;
  const scale = natural ? VIEWPORT / (minSide / Math.max(1, zoom)) : 1;
  const source = natural ? computeCropSource(natural.width, natural.height, zoom, offsetX, offsetY) : null;

  const imgStyle =
    natural && source
      ? {
          width: natural.width * scale,
          height: natural.height * scale,
          transform: `translate(${-source.sx * scale}px, ${-source.sy * scale}px)`,
        }
      : { width: VIEWPORT, height: VIEWPORT, transform: 'translate(0px, 0px)' };

  function handleConfirm() {
    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!img || !ctx || !natural) {
      // Ambiente sem canvas (por exemplo, testes): devolve o ficheiro original.
      onCropped(file);
      return;
    }
    const { sx, sy, side } = computeCropSource(natural.width, natural.height, zoom, offsetX, offsetY);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob((blob) => onCropped(blob ?? file), OUTPUT_TYPE, 0.9);
  }

  return (
    <Dialog open onClose={onClose} title={profileTexts.crop.title} description={profileTexts.crop.description}>
      <div className="flex flex-col gap-4">
        <div
          className="relative mx-auto overflow-hidden rounded-full border bg-muted"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          aria-label={profileTexts.crop.preview}
        >
          {objectUrl ? (
            // Pré-visualização interna a partir de um URL de objeto (blob:), permitido para imagens.
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              onLoad={(event) =>
                setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
              }
              className="absolute left-0 top-0 max-w-none"
              style={imgStyle}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crop-zoom">{profileTexts.crop.zoom}</Label>
          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crop-x">{profileTexts.crop.horizontal}</Label>
          <input
            id="crop-x"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={offsetX}
            onChange={(event) => setOffsetX(Number(event.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crop-y">{profileTexts.crop.vertical}</Label>
          <input
            id="crop-y"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={offsetY}
            onChange={(event) => setOffsetY(Number(event.target.value))}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {commonTexts.actions.cancel}
          </Button>
          <Button onClick={handleConfirm}>{profileTexts.crop.confirm}</Button>
        </div>
      </div>
    </Dialog>
  );
}
