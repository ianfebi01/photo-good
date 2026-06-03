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

      <div className="max-w-2xl rounded-2xl border border-neutral-100 bg-white p-5 transition-all duration-300 ease-in-out hover:shadow-xl">
        <h2 className="font-sans text-xl font-bold text-neutral-900">Personal info</h2>
        <p className="mt-0.5 text-xs text-neutral-400">Update your name and email address.</p>

        <form
          action={updateProfileAction}
          className="mt-5 space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-neutral-900">Name</span>
            <input
              name="name"
              defaultValue={user.name}
              className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-900 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-neutral-900">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={user.email}
              className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-900 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <div className="rounded-xl bg-neutral-50 p-3">
            <span className="text-xs font-semibold text-neutral-400">Role: </span>
            <span className="text-xs font-semibold capitalize text-neutral-900">
              {user.role.replace( '_', ' ' )}
            </span>
          </div>
          <Button
            type="submit"
            className="h-9 rounded-xl font-sans tracking-wide"
          >
            Save profile
          </Button>
        </form>
      </div>
    </div>
  )
}
