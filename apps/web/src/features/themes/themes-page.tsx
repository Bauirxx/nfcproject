import { Palette } from 'lucide-react';
import { useState } from 'react';
import { usePermission } from '@/app/session';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { SelectField } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { commonTexts } from '@/shared/i18n/panel/common';
import { themesTexts } from '@/shared/i18n/panel/themes';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { useProfilesQuery } from '@/features/profiles/queries';
import { ThemeEditor } from '@/features/profiles/theme-editor';

/**
 * Ecrã dedicado de temas (RF-FE-17): reúne num só sítio a personalização que cada perfil já tem,
 * reutilizando o mesmo editor (modelo, cores com contraste AA que bloqueia o guardar, logótipo, pré-visualização).
 */
export function ThemesPage() {
  useDocumentTitle(themesTexts.title);
  const canManage = usePermission('themes.manage');
  const profiles = useProfilesQuery({ page: 1, pageSize: 100 });
  const [selectedId, setSelectedId] = useState('');

  const items = profiles.data?.items ?? [];
  const selected = items.find((profile) => profile.id === selectedId) ?? items[0];

  return (
    <section className="max-w-2xl">
      <PageHeader title={themesTexts.title} description={themesTexts.description} />

      {profiles.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={commonTexts.states.loading} />
        </div>
      ) : profiles.isError ? (
        <ErrorState error={profiles.error} onRetry={() => void profiles.refetch()} />
      ) : !selected ? (
        <EmptyState icon={Palette} title={themesTexts.empty.title} description={themesTexts.empty.description} />
      ) : (
        <div className="flex flex-col gap-6">
          <SelectField
            label={themesTexts.profileLabel}
            description={themesTexts.profileHint}
            hideOptional
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {items.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </SelectField>

          {/* `key` reinicia o editor ao mudar de perfil. */}
          <ThemeEditor
            key={selected.id}
            profileId={selected.id}
            theme={selected.theme}
            displayName={selected.displayName}
            canManage={canManage}
          />
        </div>
      )}
    </section>
  );
}
