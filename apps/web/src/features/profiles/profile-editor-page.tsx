import { zodResolver } from '@hookform/resolvers/zod';
import { CONTACT_TYPES, LIMITS, SOCIAL_PLATFORM_KEYS, type ContactType } from '@nfc-business/shared/constants';
import { buildCardUrl, formatPhoneDisplay } from '@nfc-business/shared/links';
import { normalizePhone } from '@nfc-business/shared/validators';
import { profileFieldsSchema, type Profile, type ProfileUpdateRequest } from '@nfc-business/shared/schemas';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import type { z } from 'zod';
import { usePermission } from '@/app/session';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ErrorState } from '@/shared/components/ui/error-state';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { Switch } from '@/shared/components/ui/switch';
import { TextField } from '@/shared/components/ui/text-field';
import { TextareaField } from '@/shared/components/ui/textarea';
import { toast } from '@/shared/components/ui/toast-store';
import { errorMessage } from '@/shared/i18n/errors';
import { commonTexts } from '@/shared/i18n/panel/common';
import {
  contactTypeLabels,
  contactTypePlaceholders,
  profileTexts,
  socialPlatformLabels,
} from '@/shared/i18n/panel/profiles';
import { validationMessage } from '@/shared/i18n/validation';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { PhotoField, type PhotoState } from './photo-field';
import { useCompanyMembersQuery, useProfileQuery, useUpdateProfile } from './queries';
import { SortableList } from './sortable-list';
import { ThemeEditor } from './theme-editor';
import { uploadImage } from './upload';

// O tipo do formulário segue exatamente o schema partilhado (título, empresa e bio aceitam `null`).
type ProfileFormValues = z.input<typeof profileFieldsSchema>;

export function ProfileEditorPage() {
  const { id = '' } = useParams();
  const profile = useProfileQuery(id);
  useDocumentTitle(profile.data?.displayName ?? profileTexts.title);

  const backLink = (
    <Link
      to="/painel/perfis"
      className="mb-4 inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {profileTexts.editor.back}
    </Link>
  );

  if (profile.isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8" label={commonTexts.states.loading} />
      </div>
    );
  }
  if (profile.isError) {
    return (
      <section>
        {backLink}
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </section>
    );
  }

  return (
    <section>
      {backLink}
      {/* `key` reinicia o formulário quando se muda de perfil. */}
      <ProfileEditorForm key={profile.data.id} profile={profile.data} />
    </section>
  );
}

function ProfileEditorForm({ profile }: { profile: Profile }) {
  const canAssignOwner = usePermission('profiles.assignOwner');
  const canManageTheme = usePermission('themes.manage');
  const update = useUpdateProfile(profile.id);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFieldsSchema),
    defaultValues: {
      displayName: profile.displayName,
      title: profile.title ?? '',
      company: profile.company ?? '',
      bio: profile.bio ?? '',
      visibility: profile.visibility,
      contacts: profile.contacts,
      socialLinks: profile.socialLinks,
    },
  });

  const contacts = useFieldArray({ control: form.control, name: 'contacts' });
  const socials = useFieldArray({ control: form.control, name: 'socialLinks' });
  // Estado fora do formulário: a fotografia (ficheiro pendente) e o dono (só com `profiles.assignOwner`).
  const [photo, setPhoto] = useState<PhotoState>({ status: 'keep' });
  const [owner, setOwner] = useState(profile.ownerUserId ?? '');
  const members = useCompanyMembersQuery(canAssignOwner);
  const ownerSelectable = members.data?.items ?? [];

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const publicUrl = profile.activeCardToken ? buildCardUrl(origin, profile.activeCardToken) : null;

  function onSubmit(values: ProfileFormValues) {
    const body: ProfileUpdateRequest = {
      displayName: values.displayName,
      title: values.title,
      company: values.company,
      bio: values.bio,
      visibility: values.visibility,
      contacts: values.contacts,
      socialLinks: values.socialLinks,
    };
    if (canAssignOwner) body.ownerUserId = owner === '' ? null : owner;

    async function run() {
      try {
        if (photo.status === 'replace') body.photoFileId = await uploadImage(photo.blob, 'profile_photo');
        else if (photo.status === 'remove') body.photoFileId = null;
      } catch {
        toast.error(profileTexts.upload.failed);
        return;
      }
      update.mutate(body, {
        onSuccess: () => {
          setPhoto({ status: 'keep' });
          toast.success(profileTexts.editor.saved);
        },
      });
    }
    void run();
  }

  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {profileTexts.editor.openPublic}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">{profileTexts.editor.noActiveCard}</span>
        )}
      </div>

      {update.isError ? <Alert variant="error">{errorMessage(update.error)}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{profileTexts.editor.sections.details}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TextField
            label={profileTexts.editor.fields.displayName}
            required
            {...form.register('displayName')}
            error={validationMessage(form.formState.errors.displayName?.message)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={profileTexts.editor.fields.title}
              {...form.register('title')}
              error={validationMessage(form.formState.errors.title?.message)}
            />
            <TextField
              label={profileTexts.editor.fields.company}
              {...form.register('company')}
              error={validationMessage(form.formState.errors.company?.message)}
            />
          </div>
          <TextareaField
            label={profileTexts.editor.fields.bio}
            description={profileTexts.editor.fields.bioHint}
            {...form.register('bio')}
            error={validationMessage(form.formState.errors.bio?.message)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profileTexts.editor.sections.photo}</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoField currentUrl={profile.photoUrl} displayName={profile.displayName} state={photo} onChange={setPhoto} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profileTexts.editor.visibility.legend}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <VisibilitySwitch form={form} name="visibility.title" label={profileTexts.editor.visibility.title} />
          <VisibilitySwitch form={form} name="visibility.company" label={profileTexts.editor.visibility.company} />
          <VisibilitySwitch form={form} name="visibility.bio" label={profileTexts.editor.visibility.bio} />
          <VisibilitySwitch form={form} name="visibility.photo" label={profileTexts.editor.visibility.photo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profileTexts.editor.sections.contacts}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {contacts.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{profileTexts.contacts.empty}</p>
          ) : (
            <SortableList
              ids={contacts.fields.map((field) => field.id)}
              onMove={(from, to) => contacts.move(from, to)}
              labels={{
                dragHandle: profileTexts.contacts.dragHandle,
                moveUp: profileTexts.contacts.moveUp,
                moveDown: profileTexts.contacts.moveDown,
              }}
              renderItem={(_id, index) => (
                <ContactRow form={form} index={index} onRemove={() => contacts.remove(index)} />
              )}
            />
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={contacts.fields.length >= LIMITS.contactsMax}
              onClick={() => contacts.append({ id: crypto.randomUUID(), type: 'phone', value: '', isPublic: true })}
            >
              <Plus aria-hidden="true" />
              {profileTexts.contacts.add}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profileTexts.editor.sections.social}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {socials.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{profileTexts.social.empty}</p>
          ) : (
            <SortableList
              ids={socials.fields.map((field) => field.id)}
              onMove={(from, to) => socials.move(from, to)}
              labels={{
                dragHandle: profileTexts.social.dragHandle,
                moveUp: profileTexts.social.moveUp,
                moveDown: profileTexts.social.moveDown,
              }}
              renderItem={(_id, index) => (
                <SocialRow form={form} index={index} onRemove={() => socials.remove(index)} />
              )}
            />
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={socials.fields.length >= LIMITS.socialLinksMax}
              onClick={() => socials.append({ id: crypto.randomUUID(), platform: 'linkedin', url: '', isPublic: true })}
            >
              <Plus aria-hidden="true" />
              {profileTexts.social.add}
            </Button>
          </div>
        </CardContent>
      </Card>

      {canAssignOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>{profileTexts.editor.sections.owner}</CardTitle>
          </CardHeader>
          <CardContent>
            <SelectField
              label={profileTexts.editor.owner.label}
              description={profileTexts.editor.owner.hint}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              <option value="">{profileTexts.editor.owner.none}</option>
              {ownerSelectable.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name ?? member.email}
                </option>
              ))}
            </SelectField>
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? <Spinner className="size-4" /> : null}
          {profileTexts.editor.save}
        </Button>
      </div>

      <ThemeEditor profileId={profile.id} theme={profile.theme} displayName={profile.displayName} canManage={canManageTheme} />
    </form>
  );
}

interface RowProps {
  form: UseFormReturn<ProfileFormValues>;
  index: number;
  onRemove: () => void;
}

function ContactRow({ form, index, onRemove }: RowProps) {
  const type = form.watch(`contacts.${index}.type`) as ContactType;
  const value = form.watch(`contacts.${index}.value`);
  const error = form.formState.errors.contacts?.[index]?.value?.message;
  const isPhone = type === 'phone' || type === 'whatsapp';
  const normalized = isPhone && value ? normalizePhone(value) : null;
  const valueField = form.register(`contacts.${index}.value`);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="sm:w-44">
        <SelectField label={profileTexts.contacts.typeLabel} hideOptional {...form.register(`contacts.${index}.type`)}>
          {CONTACT_TYPES.map((option) => (
            <option key={option} value={option}>
              {contactTypeLabels[option]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex-1">
        <TextField
          label={profileTexts.contacts.valueLabel}
          hideOptional
          placeholder={contactTypePlaceholders[type]}
          {...valueField}
          onBlur={(event) => {
            void valueField.onBlur(event);
            if (isPhone) {
              const result = normalizePhone(event.target.value);
              if (result) form.setValue(`contacts.${index}.value`, result, { shouldValidate: true });
            }
          }}
          error={validationMessage(error)}
          description={
            normalized && normalized !== value ? profileTexts.contacts.phonePreview(formatPhoneDisplay(normalized)) : undefined
          }
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 self-start sm:mt-7"
        aria-label={profileTexts.contacts.remove}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

function SocialRow({ form, index, onRemove }: RowProps) {
  const error = form.formState.errors.socialLinks?.[index]?.url?.message;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="sm:w-44">
        <SelectField label={profileTexts.social.platformLabel} hideOptional {...form.register(`socialLinks.${index}.platform`)}>
          {SOCIAL_PLATFORM_KEYS.map((option) => (
            <option key={option} value={option}>
              {socialPlatformLabels[option]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex-1">
        <TextField
          label={profileTexts.social.urlLabel}
          hideOptional
          type="url"
          placeholder="https://"
          {...form.register(`socialLinks.${index}.url`)}
          error={validationMessage(error)}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 self-start sm:mt-7"
        aria-label={profileTexts.social.remove}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

function VisibilitySwitch({
  form,
  name,
  label,
}: {
  form: UseFormReturn<ProfileFormValues>;
  name: 'visibility.title' | 'visibility.company' | 'visibility.bio' | 'visibility.photo';
  label: string;
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Switch
          label={label}
          checked={field.value}
          onCheckedChange={field.onChange}
          description={field.value ? profileTexts.editor.visibility.publicOn : profileTexts.editor.visibility.publicOff}
        />
      )}
    />
  );
}
