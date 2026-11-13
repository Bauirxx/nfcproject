import { zodResolver } from '@hookform/resolvers/zod';
import { companyNameSchema, emailSchema, hexColorSchema, type Company } from '@nfc-business/shared/schemas';
import { toSafeImageUrl } from '@nfc-business/shared/links';
import { ArrowLeft, ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ColorField } from '@/shared/components/ui/color-field';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Spinner } from '@/shared/components/ui/spinner';
import { TextField } from '@/shared/components/ui/text-field';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';
import { companyTexts } from '@/shared/i18n/panel/companies';
import { validationMessage } from '@/shared/i18n/validation';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { LOGO_LIMITS, checkImageFile, type ImageValidationError } from '@/shared/lib/image-validation';
import { uploadImage } from '@/shared/lib/upload';
import { useCompanyQuery, useCreateCompany, useUpdateCompany } from './queries';

const DEFAULT_BRAND = { primaryColor: '#1e40af', accentColor: '#0f766e' };

const commonShape = {
  name: companyNameSchema,
  contactEmail: emailSchema,
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
};
const createSchema = z.object({ ...commonShape, adminEmail: emailSchema });
const editSchema = z.object({ ...commonShape, adminEmail: z.string() });
type CompanyFormValues = z.input<typeof createSchema>;

type LogoState = { status: 'keep' } | { status: 'remove' } | { status: 'replace'; blob: Blob; previewUrl: string };

const UPLOAD_ERROR_TEXT: Record<ImageValidationError, string> = {
  file_too_large: companyTexts.uploadFailed,
  unsupported_file_type: companyTexts.uploadFailed,
  image_too_small: companyTexts.uploadFailed,
  image_too_large: companyTexts.uploadFailed,
  invalid_image: companyTexts.uploadFailed,
};

export function CompanyFormPage() {
  const { id } = useParams();
  const company = useCompanyQuery(id ?? '');
  const isEdit = id !== undefined;
  useDocumentTitle(isEdit ? companyTexts.edit.title : companyTexts.create.title);

  const backLink = (
    <Link
      to="/painel/empresas"
      className="mb-4 inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {companyTexts.edit.back}
    </Link>
  );

  if (isEdit && company.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8" label={commonTexts.states.loading} />
      </div>
    );
  }
  if (isEdit && company.isError) {
    return (
      <section>
        {backLink}
        <ErrorState error={company.error} onRetry={() => void company.refetch()} />
      </section>
    );
  }

  return (
    <section className="max-w-2xl">
      {backLink}
      <PageHeader title={isEdit ? companyTexts.edit.title : companyTexts.create.title} />
      <CompanyForm company={isEdit ? company.data : undefined} />
    </section>
  );
}

function CompanyForm({ company }: { company?: Company }) {
  const navigate = useNavigate();
  const isEdit = company !== undefined;
  const create = useCreateCompany();
  const update = useUpdateCompany(company?.id ?? '');
  const mutation = isEdit ? update : create;

  const inputRef = useRef<HTMLInputElement>(null);
  const createdUrls = useRef<string[]>([]);
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

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      name: company?.name ?? '',
      contactEmail: company?.contactEmail ?? '',
      adminEmail: '',
      primaryColor: company?.brand.primaryColor ?? DEFAULT_BRAND.primaryColor,
      accentColor: company?.brand.accentColor ?? DEFAULT_BRAND.accentColor,
    },
  });

  const control = form.control;
  const primaryColor = useWatch({ control, name: 'primaryColor' });
  const accentColor = useWatch({ control, name: 'accentColor' });

  const safeCurrentLogo = toSafeImageUrl(company?.logoUrl ?? null);
  const logoPreview = logo.status === 'replace' ? logo.previewUrl : logo.status === 'remove' ? null : safeCurrentLogo;
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

  function onSubmit(values: CompanyFormValues) {
    const brand = { primaryColor: values.primaryColor, accentColor: values.accentColor };

    async function run() {
      let logoFileId: string | null | undefined;
      try {
        if (logo.status === 'replace') logoFileId = await uploadImage(logo.blob, 'company_logo');
        else if (logo.status === 'remove') logoFileId = null;
      } catch {
        toast.error(companyTexts.uploadFailed);
        return;
      }

      if (isEdit) {
        update.mutate(
          { name: values.name, contactEmail: values.contactEmail, brand, ...(logoFileId === undefined ? {} : { logoFileId }) },
          {
            onSuccess: () => {
              toast.success(companyTexts.edit.saved);
              navigate('/painel/empresas');
            },
          },
        );
      } else {
        create.mutate(
          {
            name: values.name,
            contactEmail: values.contactEmail,
            adminEmail: values.adminEmail,
            brand,
            ...(logoFileId ? { logoFileId } : {}),
          },
          {
            onSuccess: () => {
              toast.success(companyTexts.create.created);
              navigate('/painel/empresas');
            },
          },
        );
      }
    }
    void run();
  }

  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      {mutation.isError ? <Alert variant="error">{errorMessage(mutation.error)}</Alert> : null}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <TextField
            label={companyTexts.fields.name}
            required
            {...form.register('name')}
            error={validationMessage(form.formState.errors.name?.message)}
          />
          <TextField
            label={companyTexts.fields.contactEmail}
            type="email"
            required
            {...form.register('contactEmail')}
            error={validationMessage(form.formState.errors.contactEmail?.message)}
          />
          {!isEdit ? (
            <TextField
              label={companyTexts.fields.adminEmail}
              description={companyTexts.fields.adminEmailHint}
              type="email"
              required
              {...form.register('adminEmail')}
              error={validationMessage(form.formState.errors.adminEmail?.message)}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{companyTexts.fields.brand}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label={companyTexts.fields.primaryColor}
              value={primaryColor}
              onChange={(hex) => form.setValue('primaryColor', hex, { shouldValidate: true })}
              error={validationMessage(form.formState.errors.primaryColor?.message)}
            />
            <ColorField
              label={companyTexts.fields.accentColor}
              value={accentColor}
              onChange={(hex) => form.setValue('accentColor', hex, { shouldValidate: true })}
              error={validationMessage(form.formState.errors.accentColor?.message)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{companyTexts.fields.logo}</span>
            <p className="text-xs text-muted-foreground">{companyTexts.fields.logoHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-12 max-w-[8rem] rounded border bg-muted object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">{companyTexts.fields.logoNone}</span>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <ImageUp aria-hidden="true" />
                {hasLogo ? companyTexts.fields.logoChange : companyTexts.fields.logoChoose}
              </Button>
              {hasLogo ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogo({ status: 'remove' })}>
                  <Trash2 aria-hidden="true" />
                  {companyTexts.fields.logoRemove}
                </Button>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={companyTexts.fields.logoChoose}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleLogoFile(file);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner className="size-4" /> : null}
          {isEdit ? companyTexts.edit.submit : companyTexts.create.submit}
        </Button>
      </div>
    </form>
  );
}
