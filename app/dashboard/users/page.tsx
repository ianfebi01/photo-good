import { updateRoleAction } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth/require'
import { listUsers } from '@/lib/auth/users'
import { roles } from '@/lib/auth/types'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'

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

      <div className="rounded-2xl border border-neutral-100 bg-white p-6 transition-all duration-300 ease-in-out hover:shadow-xl overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs font-bold uppercase tracking-wider text-neutral-400">
              <th className="pb-3">User</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Created</th>
              <th className="pb-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map( ( user ) => (
              <tr key={user.id}>
                <td className="py-4 font-semibold text-neutral-900">{user.name}</td>
                <td className="py-4 text-neutral-400">{user.email}</td>
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
                      className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none focus:border-primary"
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
                      className="rounded-xl font-bold"
                    >
                      Save
                    </Button>
                  </form>
                </td>
                <td className="py-4 text-neutral-400">
                  {new Intl.DateTimeFormat( 'en', {
                    dateStyle : 'medium',
                  } ).format( new Date( user.created_at ) )}
                </td>
                <td className="py-4 text-right text-xs font-bold uppercase tracking-wider text-neutral-400">
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
