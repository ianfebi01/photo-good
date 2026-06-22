import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title       : "Sign Up — Photo Good",
  description : "Create your Photo Good account to start capturing memories.",
}

export default async function SignupPage() {
  redirect( '/login' )
}
