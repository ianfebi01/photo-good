import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title       : "Admin — Photo Good",
  description : "Photo Good admin panel for managing frames, booths, users, and results.",
}

export default function AdminRedirectPage() {
  redirect( '/dashboard/frames' )
}
