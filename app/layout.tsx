import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { getCurrentUser } from '@/lib/auth'
import { Header } from '@/components/identity/Header'
import { UserPicker } from '@/components/identity/UserPicker'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Game Night',
  description: 'Community event board for tabletop gamers',
}

// Identity is resolved once here: no session cookie means the picker replaces
// the entire app, so no page needs its own "who are you?" handling.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-slate-50 text-slate-900 antialiased`}>
        {user ? (
          <>
            <Header user={user} />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </>
        ) : (
          <UserPicker />
        )}
      </body>
    </html>
  )
}
