'use client';
import { Users } from 'lucide-react';
import { ActionForm, f } from '@/components/farm/forms';
import { PageHeading, LoadState, Status } from '@/components/farm/common';
import { useUser } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import type { User } from '@/lib/types';
export default function Page() {
  const user = useUser();
  const q = useResource<(User & { isActive: boolean })[]>(user.role === 'OWNER' ? 'users' : null);
  if (user.role !== 'OWNER')
    return (
      <>
        <PageHeading title="Farm team" />
        <p>This page is available to the farm owner.</p>
      </>
    );
  return (
    <>
      <PageHeading
        title="Farm team"
        description="Give your manager and workers their own sign-in accounts."
        action={
          <ActionForm
            title="Add team member"
            path="users"
            fields={[
              f('name', 'Full name', 'text', true),
              f('email', 'Email', 'email', true),
              f('password', 'Initial password', 'password', true, {
                help: 'At least 12 characters and no more than 72 UTF-8 bytes.',
              }),
              f('role', 'Role', 'select', true, { options: ['MANAGER', 'WORKER'] }),
            ]}
            onSuccess={q.refresh}
          />
        }
      />
      <LoadState {...q} retry={q.refresh} />
      {q.data && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {q.data.map((u) => (
            <article key={u.id} className="bg-white border rounded-xl p-5">
              <div className="flex justify-between mb-4">
                <span className="size-11 rounded-lg bg-secondary text-primary grid place-items-center">
                  <Users size={21} />
                </span>
                <Status value={u.role} />
              </div>
              <h2 className="font-semibold">{u.name}</h2>
              <p className="text-sm text-muted-foreground break-all mt-1">{u.email}</p>
              <p className="text-sm mt-4">{u.isActive ? 'Active account' : 'Inactive account'}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
