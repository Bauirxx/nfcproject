import { MEMBER_ROLES, type MemberRole } from '@nfc-business/shared/constants';
import type { Member } from '@nfc-business/shared/schemas';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/app/session';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Select } from '@/shared/components/ui/select';
import { Spinner } from '@/shared/components/ui/spinner';
import { TBody, THead, Table, Td, Th, Tr } from '@/shared/components/ui/table';
import { toast } from '@/shared/components/ui/toast-store';
import { memberRoleLabels, memberStatusLabels, memberTexts } from '@/shared/i18n/panel/members';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';
import { InviteMemberDialog } from './invite-member-dialog';
import { useMembersQuery, useRemoveMember, useUpdateMemberRole } from './queries';

export function MembersPage() {
  useDocumentTitle(memberTexts.title);
  const currentUser = useCurrentUser();
  const members = useMembersQuery();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  function changeRole(member: Member, role: MemberRole) {
    updateRole.mutate(
      { id: member.id, role },
      { onSuccess: () => toast.success(memberTexts.roleChanged) },
    );
  }

  function confirmRemove() {
    if (!removing) return;
    const target = removing;
    remove.mutate(target.id, {
      onSuccess: () => {
        toast.success(memberTexts.remove.removed);
        setRemoving(null);
      },
      onError: () => setRemoving(null),
    });
  }

  return (
    <section>
      <PageHeader
        title={memberTexts.title}
        description={memberTexts.description}
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus aria-hidden="true" />
            {memberTexts.invite.button}
          </Button>
        }
      />

      {members.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8" label={memberTexts.title} />
        </div>
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => void members.refetch()} />
      ) : members.data.items.length === 0 ? (
        <EmptyState icon={Users} title={memberTexts.empty.title} description={memberTexts.empty.description} />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>{memberTexts.columns.member}</Th>
              <Th>{memberTexts.columns.role}</Th>
              <Th>{memberTexts.columns.status}</Th>
              <Th className="text-right">{memberTexts.columns.actions}</Th>
            </Tr>
          </THead>
          <TBody>
            {members.data.items.map((member) => {
              const isSelf = member.id === currentUser?.id;
              return (
                <Tr key={member.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {member.name ?? memberTexts.pending} {isSelf ? <span className="text-muted-foreground">{memberTexts.self}</span> : null}
                      </span>
                      <span className="text-sm text-muted-foreground">{member.email}</span>
                    </div>
                  </Td>
                  <Td>
                    <Select
                      aria-label={`${memberTexts.roleLabel} — ${member.email}`}
                      className="h-9 w-44"
                      value={member.role}
                      disabled={isSelf || updateRole.isPending}
                      onChange={(event) => changeRole(member, event.target.value as MemberRole)}
                    >
                      {MEMBER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {memberRoleLabels[role]}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Badge variant={member.status === 'active' ? 'success' : 'neutral'}>
                      {member.status === 'invited' ? memberStatusLabels.invited : memberStatusLabels.active}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => setRemoving(member)}
                    >
                      {memberTexts.remove.action}
                    </Button>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={memberTexts.remove.title}
        description={removing ? memberTexts.remove.body(removing.name ?? removing.email) : undefined}
        confirmLabel={memberTexts.remove.confirm}
        destructive
        loading={remove.isPending}
      />
    </section>
  );
}
