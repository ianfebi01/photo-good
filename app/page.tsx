import { cn } from '@/lib/utils'
import LogoCard from '@/components/LogoCard'
import PhotoStack from '@/components/PhotoStack'
import PalleteStack from '../components/PalleteStack'
import PhotoboothCard from '@/components/PhotoboothCard'
import QuoteCard from '@/components/QuoteCard'
import AppCard from '@/components/AppCard'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen xl:min-h-[unset] xl:h-screen bg-white">
      <div className="container px-4 py-8 mx-auto lg:py-16 xl:h-full">
        <div
          className={cn(
            'grid gap-12 h-full',
            'grid-cols-1',
            'md:grid-cols-6',
            'xl:grid-cols-12',
            'xl:auto-rows-fr',
          )}
        >
          {/* Top Left */}
          <PhotoStack className="xl:col-span-4 xl:row-span-9" />

          {/* Hero */}
          <AppCard className="relative overflow-hidden bg-secondary p-8 xl:col-span-4 xl:row-span-5 text-secondary-foreground flex flex-col justify-between">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-secondary-foreground/10 blur-3xl" />

            {/* Title */}
            <div className="relative z-10 flex flex-col gap-3">
              <h1 className="text-4xl font-bold leading-tight">
                Let&apos;s Capture<br />Some Memories
              </h1>
              <p className="max-w-47.5 text-sm leading-relaxed text-secondary-foreground/60 font-poppins">
                Your personal photo booth, wrapped in warm memories.
              </p>
            </div>

            {/* Starburst START button */}
            <div className="relative z-10 flex items-center justify-center">
              <Link
                href="/booth"
                className="group relative flex h-56 w-56 items-center justify-center"
              >
                {/* Shadow starburst */}
                <div className="starburst absolute inset-0 translate-x-3 translate-y-3 bg-accent transition-transform duration-300 group-hover:translate-x-4 group-hover:translate-y-4" />
                {/* Spinning starburst */}
                <div className="starburst starburst-spin absolute inset-0 bg-white" />
                {/* START label — stays still */}
                <span className="relative z-10 text-2xl font-bold text-primary transition-transform duration-300 group-hover:scale-110">
                  START
                </span>
              </Link>
            </div>
          </AppCard>

          {/* Right Portrait */}
          <AppCard className="xl:col-span-4 xl:row-span-5 p-0! overflow-hidden">
            <PhotoboothCard />
          </AppCard>

          {/* Quote */}
          <AppCard className="text-white bg-chart-2 xl:col-span-3 xl:row-span-4 flex flex-col">
            <QuoteCard />
          </AppCard>

          {/* Logo */}
          <LogoCard className="xl:col-span-5 xl:row-span-2" />

          {/* Colors */}
          <PalleteStack className="xl:col-span-5 xl:row-span-2" />
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/dashboard/frames"
            className="text-xs text-muted-foreground/60 hover:text-primary transition-colors font-medium"
          >
            Admin Panel
          </Link>
        </div>
      </div>
    </main>
  )
}
