import { updateRoleAction } from '@/app/auth/actions'
import AppCard from '@/components/AppCard'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth/require'
import { listUsers } from '@/lib/auth/users'
import { roles } from '@/lib/auth/types'

export default async function UsersPage() {
  const currentUser = await requireRole( 'super_admin' )
  const users = await listUsers()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Access control
        </p>
        <h1 className="mt-2 text-4xl font-bold text-foreground">Users</h1>
        <p className="mt-2 text-sm text-muted-foreground font-poppins">
          Assign roles for dashboard and frame-management access.
        </p>
      </div>

      <AppCard className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <th className="pb-3">User</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Created</th>
              <th className="pb-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {users.map( ( user ) => (
              <tr key={user.id}>
                <td className="py-4 font-bold text-foreground">{user.name}</td>
                <td className="py-4 text-muted-foreground">{user.email}</td>
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
                      className="h-9 rounded-xl border border-border bg-white px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
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
                <td className="py-4 text-muted-foreground">
                  {new Intl.DateTimeFormat( 'en', {
                    dateStyle : 'medium',
                  } ).format( new Date( user.created_at ) )}
                </td>
                <td className="py-4 text-right text-xs font-bold uppercase tracking-wider text-primary">
                  {user.id === currentUser.id ? 'You' : 'Managed'}
                </td>
              </tr>
            ) )}
          </tbody>
        </table>
      </AppCard>
    </div>
  )
}
