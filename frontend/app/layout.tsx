import type { Metadata } from 'next'
import { DM_Serif_Display, Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import Navbar from '@/components/Navbar'
import WalletErrorSuppressor from '@/components/WalletErrorSuppressor'

const serif = DM_Serif_Display({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
})
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const mono  = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NeuralHook — The LP Shield',
  description: 'AI predicts impermanent loss before it happens. Fees surge to compensate. Cryptography proves the AI is not lying. Uniswap v4 hook on Unichain.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${inter.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Providers>
          <WalletErrorSuppressor />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  )
}
