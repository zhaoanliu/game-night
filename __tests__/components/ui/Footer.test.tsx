import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from '@/components/ui/Footer'

describe('Footer', () => {
  it('renders the app name at the bottom of the page [AC-20-1]', () => {
    render(<Footer />)

    expect(screen.getByText('Game Night')).toBeInTheDocument()
  })

  it('uses a muted, centered style consistent with the site header [AC-20-2]', () => {
    render(<Footer />)

    const footer = screen.getByText('Game Night').closest('footer')
    expect(footer?.className).toContain('border-slate-200')
    expect(footer?.className).toContain('bg-white')

    const inner = screen.getByText('Game Night')
    expect(inner.className).toContain('text-slate-500')
    expect(inner.className).toContain('text-center')
    expect(inner.className).toContain('max-w-5xl')
    expect(inner.className).toContain('mx-auto')
    expect(inner.className).toContain('px-4')
  })
})
