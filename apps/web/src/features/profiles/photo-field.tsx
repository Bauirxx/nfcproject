import { toSafeImageUrl } from '@nfc-business/shared/links';
import { ImageUp, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { toast } from '@/shared/components/ui/toast-store';
import { profileTexts } from '@/shared/i18n/panel/profiles';
import { PHOTO_LIMITS, checkImageFile, type ImageValidationError } from '@/shared/lib/image-validation';
import { PhotoCropDialog } from './photo-crop-dialog';

export type PhotoState =
  | { status: 'keep' }
  | { status: 'remove' }
  | { status: 'replace'; blob: Blob; previewUrl: string };

const UPLOAD_ERROR_TEXT: Record<ImageValidationError, string> = {
  file_too_large: profileTexts.upload.tooLarge,
  unsupported_file_type: profileTexts.upload.unsupported,
  image_too_small: profileTexts.upload.tooSmall,
  image_too_large: profileTexts.upload.tooBig,
  invalid_image: profileTexts.upload.invalid,
};

interface PhotoFieldProps {
  currentUrl: string | null;
  displayName: string;
  state: PhotoState;
  onChange: (state: PhotoState) => void;
}

export function PhotoField({ currentUrl, displayName, state, onChange }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const createdUrls = useRef<string[]>([]);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(
    () => () => {
      for (const url of createdUrls.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* sem suporte: sem efeito */
        }
      }
    },
    [],
  );

  const safeCurrent = toSafeImageUrl(currentUrl);
  const preview = state.status === 'replace' ? state.previewUrl : state.status === 'remove' ? null : safeCurrent;
  const hasPhoto = state.status === 'replace' || (state.status === 'keep' && safeCurrent !== null);

  async function handleFile(file: File) {
    const result = await checkImageFile(file, PHOTO_LIMITS);
    if (!result.ok) {
      toast.error(UPLOAD_ERROR_TEXT[result.error]);
      return;
    }
    setCropFile(file);
  }

  function handleCropped(blob: Blob) {
    let previewUrl = '';
    try {
      previewUrl = URL.createObjectURL(blob);
      createdUrls.current.push(previewUrl);
    } catch {
      /* sem suporte */
    }
    onChange({ status: 'replace', blob, previewUrl });
    setCropFile(null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
        {preview ? (
          <img src={preview} alt={profileTexts.photo.alt(displayName)} className="size-full object-cover" />
        ) : (
          <UserRound aria-hidden="true" className="size-10 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{profileTexts.photo.hint}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <ImageUp aria-hidden="true" />
            {hasPhoto ? profileTexts.photo.change : profileTexts.photo.choose}
          </Button>
          {hasPhoto ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ status: 'remove' })}>
              <Trash2 aria-hidden="true" />
              {profileTexts.photo.remove}
            </Button>
          ) : null}
        </div>
        {state.status === 'replace' ? (
          <p className="text-xs text-success">{profileTexts.photo.pendingReplace}</p>
        ) : state.status === 'remove' && safeCurrent ? (
          <p className="text-xs text-warning">{profileTexts.photo.pendingRemove}</p>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={profileTexts.photo.choose}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleFile(file);
          }}
        />
      </div>

      {cropFile ? (
        <PhotoCropDialog file={cropFile} onClose={() => setCropFile(null)} onCropped={handleCropped} />
      ) : null}
    </div>
  );
}
