import { updateProfileAction } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth/require'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        label="Account"
        title="Profile"
        description="Keep your dashboard identity current."
      />

      <div className="max-w-2xl rounded-2xl border border-neutral-100 bg-white p-6 transition-all duration-300 ease-in-out hover:shadow-xl">
        <form
          action={updateProfileAction}
          className="space-y-4"
        >
          <label className="block space-y-1.5 text-sm font-semibold text-neutral-900">
            <span>Name</span>
            <input
              name="name"
              defaultValue={user.name}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-neutral-900">
            <span>Email</span>
            <input
              name="email"
              type="email"
              defaultValue={user.email}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <div className="rounded-xl bg-neutral-50 p-4 text-sm">
            <span className="font-semibold text-neutral-500">Role: </span>
            <span className="font-semibold capitalize text-neutral-900">
              {user.role.replace( '_', ' ' )}
            </span>
          </div>
          <Button
            type="submit"
            className="rounded-xl font-bold uppercase tracking-wide"
          >
            Save profile
          </Button>
        </form>
      </div>
    </div>
  )
}
