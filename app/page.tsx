import Link from "next/link";

import { Button } from "@/components/ui/button";

const swatches = [
  { name : "Primary", hex : "#EB4C4C", className : "bg-primary text-primary-foreground" },
  { name : "Coral", hex : "#FF7070", className : "bg-chart-2 text-white" },
  { name : "Accent", hex : "#FFA6A6", className : "bg-accent text-accent-foreground" },
  { name : "Secondary", hex : "#FFEDC7", className : "bg-secondary text-secondary-foreground" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 bg-background px-6 py-24 font-sans">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          shadcn + your palette
        </h1>
        <p className="max-w-md text-muted-foreground">
          Tailwind v4 theme tokens wired to the Color Hunt palette on a white
          background.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
        {swatches.map( ( s ) => (
          <div
            key={s.name}
            className={`flex h-28 flex-col justify-end rounded-xl border p-3 ${s.className}`}
          >
            <span className="text-sm font-medium">{s.name}</span>
            <span className="text-xs opacity-80">{s.hex}</span>
          </div>
        ) )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>

      <Link href="/booth">
        <Button size="lg">Open the photobooth →</Button>
      </Link>
    </main>
  );
}
