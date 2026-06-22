import type { Metadata } from 'next'
import { updateRoleAction } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth/require'
import { listUsers } from '@/lib/auth/users'
import { roles } from '@/lib/auth/types'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'

export const metadata: Metadata = {
  title       : "Users — Photo Good",
  description : "Manage team member roles and access control for the Photo Good dashboard.",
}

export default async function UsersPage() {
  const currentUser = await requireRole( 'super_admin' )
  const users = await listUsers()

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        label="Access control"
        title="Users"
        description="Assign roles for dashboard and frame-management access."
      />

      <div className="overflow-x-auto rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
        <h2 className="font-sans text-xl font-bold text-neutral-900">Team members</h2>
        <p className="mt-0.5 text-xs text-neutral-400">Manage role assignments for all users.</p>

        <table className="mt-5 w-full min-w-180 text-left">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="pb-3 text-[0.625rem] font-bold uppercase tracking-wider text-neutral-400">User</th>
              <th className="pb-3 text-[0.625rem] font-bold uppercase tracking-wider text-neutral-400">Email</th>
              <th className="pb-3 text-[0.625rem] font-bold uppercase tracking-wider text-neutral-400">Role</th>
              <th className="pb-3 text-[0.625rem] font-bold uppercase tracking-wider text-neutral-400">Created</th>
              <th className="pb-3 text-right text-[0.625rem] font-bold uppercase tracking-wider text-neutral-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map( ( user ) => (
              <tr key={user.id}>
                <td className="py-4 font-sans text-xs font-semibold text-neutral-900">{user.name}</td>
                <td className="py-4 text-xs text-neutral-400">{user.email}</td>
                <td className="py-4">
                  <form
                    action={updateRoleAction}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="hidden"
                      name="userId"
                      value={user.id}
                    />
                    <select
                      name="role"
                      defaultValue={user.role}
                      disabled={user.id === currentUser.id}
                      className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-900 outline-none focus:border-primary"
                    >
                      {roles.map( ( role ) => (
                        <option
                          key={role}
                          value={role}
                        >
                          {role.replace( '_', ' ' )}
                        </option>
                      ) )}
                    </select>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={user.id === currentUser.id}
                      className="h-9 rounded-xl font-sans font-semibold"
                    >
                      Save
                    </Button>
                  </form>
                </td>
                <td className="py-4 text-xs text-neutral-400">
                  {new Intl.DateTimeFormat( 'en', {
                    dateStyle : 'medium',
                  } ).format( new Date( user.created_at ) )}
                </td>
                <td className="py-4 text-right text-[0.625rem] font-bold uppercase tracking-wider text-neutral-400">
                  {user.id === currentUser.id ? 'You' : 'Managed'}
                </td>
              </tr>
            ) )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
