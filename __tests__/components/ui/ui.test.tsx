import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SeatsBadge } from '@/components/ui/SeatsBadge'
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'

describe('SeatsBadge', () => {
  it('shows red Full at zero seats', () => {
    render(<SeatsBadge seatsLeft={0} />)
    const badge = screen.getByText('Full')
    expect(badge.className).toContain('bg-red-100')
  })

  it('shows amber 1 seat left at one seat', () => {
    render(<SeatsBadge seatsLeft={1} />)
    const badge = screen.getByText('1 seat left')
    expect(badge.className).toContain('bg-amber-100')
  })

  it('shows a neutral count above one seat', () => {
    render(<SeatsBadge seatsLeft={5} />)
    const badge = screen.getByText('5 seats left')
    expect(badge.className).toContain('bg-slate-100')
  })
})

describe('EmptyState', () => {
  it('renders title, hint, and children', () => {
    render(
      <EmptyState title="Nothing here" hint="Try again later">
        <a href="/">Browse</a>
      </EmptyState>
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Try again later')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse' })).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('announces the message and retries on click', async () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Could not load events" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load events')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('Skeleton and Spinner', () => {
  it('render placeholder elements', () => {
    render(
      <>
        <Skeleton className="h-4" />
        <CardSkeleton />
        <Spinner />
      </>
    )
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(1)
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })
})
