import { expect, test } from '@playwright/test'
import { USERS, signInAs } from './helpers'

test.describe('loading, empty, and error states', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, USERS.yuki)
  })

  test('a failed fetch renders an error state and Retry recovers [AC-11-9]', async ({ page }) => {
    await page.route('**/api/events', (route) => route.abort())

    await page.goto('/')
    // Filtered because Next.js mounts its own (empty) role=alert route announcer.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Could not reach the server' })
    ).toBeVisible()

    await page.unroute('**/api/events')
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByText('Friday Night Magic — Standard')).toBeVisible()
  })

  test('a slow fetch shows skeletons first [AC-11-9]', async ({ page }) => {
    await page.route('**/api/events', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.continue()
    })

    await page.goto('/')

    await expect(page.getByTestId('skeleton').first()).toBeVisible()
    await expect(page.getByText('Friday Night Magic — Standard')).toBeVisible()
  })

  test('a search with no matches shows the empty state [AC-11-9]', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Upcoming events' })).toBeVisible()

    await page.getByRole('searchbox', { name: 'Search events' }).fill('zzz no such event')

    await expect(page.getByText('No events match your search')).toBeVisible()
  })
})
