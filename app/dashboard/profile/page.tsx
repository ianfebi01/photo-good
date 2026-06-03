import { updateProfileAction } from '@/app/auth/actions'
import AppCard from '@/components/AppCard'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth/require'

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Account
        </p>
        <h1 className="mt-2 text-4xl font-bold text-foreground">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground font-poppins">
          Keep your dashboard identity current.
        </p>
      </div>

      <AppCard className="max-w-2xl">
        <form
          action={updateProfileAction}
          className="space-y-4"
        >
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>Name</span>
            <input
              name="name"
              defaultValue={user.name}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>Email</span>
            <input
              name="email"
              type="email"
              defaultValue={user.email}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </label>
          <div className="rounded-2xl bg-secondary p-4 text-sm">
            <span className="font-bold text-foreground">Role: </span>
            <span className="font-bold text-primary">
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
      </AppCard>
    </div>
  )
}
