import { cn } from '@/lib/utils'
import LogoCard from '@/components/LogoCard'

function Card( {
  className,
  children,
}: React.PropsWithChildren<{ className?: string }> ) {
  return (
    <div className={cn( 'rounded-3xl bg-white p-6 shadow-sm transition-all duration-300 ease-in-out', className )}>
      {children}
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen xl:min-h-[unset] xl:h-screen bg-secondary">
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
          <Card className="xl:col-span-4 xl:row-span-4">Photo Card</Card>

          {/* Hero */}
          <Card className="text-white bg-primary xl:col-span-4 xl:row-span-5">
            Hero Content
          </Card>

          {/* Right Portrait */}
          <Card className="xl:col-span-4 xl:row-span-5">Portrait Card</Card>

          {/* Typography */}
          <Card className="text-white bg-accent xl:col-span-4 xl:row-span-5">
            Typography
          </Card>

          {/* Quote */}
          <Card className="text-white bg-chart-2 xl:col-span-3 xl:row-span-4">
            Quote
          </Card>

          {/* Logo */}
          <LogoCard className="xl:col-span-5 xl:row-span-2" />

          {/* Colors */}
          <Card className="xl:col-span-5 xl:row-span-2">Color Palette</Card>
        </div>
      </div>
    </main>
  )
}
