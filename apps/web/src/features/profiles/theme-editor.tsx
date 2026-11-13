import { CONTRAST_AA_LARGE, CONTRAST_AA_TEXT, contrastRatio, meetsContrast } from '@nfc-business/shared/contrast';
import { THEME_TEMPLATES, type ThemeTemplate } from '@nfc-business/shared/constants';
import { toSafeImageUrl } from '@nfc-business/shared/links';
import type { ProfileTheme } from '@nfc-business/shared/schemas';
import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ColorField } from '@/shared/components/ui/color-field';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';
import { profileTexts, themeTemplateLabels } from '@/shared/i18n/panel/profiles';
import { LOGO_LIMITS, checkImageFile, type ImageValidationError } from '@/shared/lib/image-validation';
import { useUpdateProfile } from './queries';
import { uploadImage } from '@/shared/lib/upload';

type LogoState = { status: 'keep' } | { status: 'remove' } | { status: 'replace'; blob: Blob; previewUrl: string };

const UPLOAD_ERROR_TEXT: Record<ImageValidationError, string> = {
  file_too_large: profileTexts.upload.tooLarge,
  unsupported_file_type: profileTexts.upload.unsupported,
  image_too_small: profileTexts.upload.tooSmall,
  image_too_large: profileTexts.upload.tooBig,
  invalid_image: profileTexts.upload.invalid,
};

function formatRatio(ratio: number | null): string {
  return ratio === null ? '—' : ratio.toFixed(2);
}

interface ThemeEditorProps {
  profileId: string;
  theme: ProfileTheme;
  displayName: string;
  canManage: boolean;
}

export function ThemeEditor({ profileId, theme, displayName, canManage }: ThemeEditorProps) {
  const update = useUpdateProfile(profileId);
  const inputRef = useRef<HTMLInputElement>(null);
  const createdUrls = useRef<string[]>([]);
  const [template, setTemplate] = useState<ThemeTemplate>(theme.template);
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [backgroundColor, setBackgroundColor] = useState(theme.backgroundColor);
  const [textColor, setTextColor] = useState(theme.textColor);
  const [logo, setLogo] = useState<LogoState>({ status: 'keep' });

  useEffect(
    () => () => {
      for (const url of createdUrls.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* sem suporte */
        }
      }
    },
    [],
  );

  const textRatio = contrastRatio(textColor, backgroundColor);
  const primaryRatio = contrastRatio(primaryColor, backgroundColor);
  const textOk = meetsContrast(textColor, backgroundColor, CONTRAST_AA_TEXT);
  const primaryOk = meetsContrast(primaryColor, backgroundColor, CONTRAST_AA_LARGE);
  const contrastOk = textOk && primaryOk;

  const safeCurrentLogo = toSafeImageUrl(theme.logoUrl);
  const logoPreview =
    logo.status === 'replace' ? logo.previewUrl : logo.status === 'remove' ? null : safeCurrentLogo;
  const hasLogo = logo.status === 'replace' || (logo.status === 'keep' && safeCurrentLogo !== null);

  async function handleLogoFile(file: File) {
    const result = await checkImageFile(file, LOGO_LIMITS);
    if (!result.ok) {
      toast.error(UPLOAD_ERROR_TEXT[result.error]);
      return;
    }
    let previewUrl = '';
    try {
      previewUrl = URL.createObjectURL(file);
      createdUrls.current.push(previewUrl);
    } catch {
      /* sem suporte */
    }
    setLogo({ status: 'replace', blob: file, previewUrl });
  }

  async function save() {
    let logoFileId: string | null | undefined;
    try {
      if (logo.status === 'replace') logoFileId = await uploadImage(logo.blob, 'theme_logo');
      else if (logo.status === 'remove') logoFileId = null;
    } catch {
      toast.error(profileTexts.upload.failed);
      return;
    }
    update.mutate(
      { theme: { template, primaryColor, backgroundColor, textColor, ...(logoFileId === undefined ? {} : { logoFileId }) } },
      {
        onSuccess: () => {
          setLogo({ status: 'keep' });
          toast.success(profileTexts.theme.saved);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profileTexts.editor.sections.theme}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!canManage ? <Alert variant="info">{profileTexts.theme.needsPermission}</Alert> : null}
        {update.isError ? <Alert variant="error">{errorMessage(update.error)}</Alert> : null}

        <fieldset disabled={!canManage || update.isPending} className="flex flex-col gap-4">
          <SelectField
            label={profileTexts.theme.templateLabel}
            hideOptional
            value={template}
            onChange={(event) => setTemplate(event.target.value as ThemeTemplate)}
          >
            {THEME_TEMPLATES.map((value) => (
              <option key={value} value={value}>
                {themeTemplateLabels[value]}
              </option>
            ))}
          </SelectField>

          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label={profileTexts.theme.primaryLabel} value={primaryColor} onChange={setPrimaryColor} />
            <ColorField label={profileTexts.theme.backgroundLabel} value={backgroundColor} onChange={setBackgroundColor} />
            <ColorField label={profileTexts.theme.textLabel} value={textColor} onChange={setTextColor} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{profileTexts.theme.logoLabel}</span>
            <p className="text-xs text-muted-foreground">{profileTexts.theme.logoHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-12 max-w-[8rem] rounded border bg-muted object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">{profileTexts.theme.logoNone}</span>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <ImageUp aria-hidden="true" />
                {profileTexts.theme.logoLabel}
              </Button>
              {hasLogo ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogo({ status: 'remove' })}>
                  <Trash2 aria-hidden="true" />
                  {profileTexts.theme.logoRemove}
                </Button>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={profileTexts.theme.logoLabel}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleLogoFile(file);
              }}
            />
          </div>
        </fieldset>

        <div
          className="rounded-lg border p-4"
          style={{ backgroundColor, color: textColor }}
          aria-label={profileTexts.theme.preview}
        >
          <p className="text-lg font-semibold">{displayName || profileTexts.theme.previewName}</p>
          <p className="text-sm" style={{ color: primaryColor }}>
            {profileTexts.theme.previewTitle}
          </p>
        </div>

        <div className="flex flex-col gap-1 text-sm" aria-live="polite">
          <span className={textOk ? 'text-success' : 'text-destructive'}>
            {profileTexts.theme.contrastText(formatRatio(textRatio))}
          </span>
          <span className={primaryOk ? 'text-success' : 'text-destructive'}>
            {profileTexts.theme.contrastPrimary(formatRatio(primaryRatio))}
          </span>
          <span className="text-muted-foreground">
            {contrastOk ? profileTexts.theme.contrastOk : profileTexts.theme.contrastBlocked}
          </span>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={!canManage || !contrastOk || update.isPending}>
            {update.isPending ? <Spinner className="size-4" /> : null}
            {profileTexts.theme.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
