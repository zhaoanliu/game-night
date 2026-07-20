import { expect, test } from '@playwright/test'
import { EVENTS, USERS, signInAs } from './helpers'

test.describe('full event', () => {
  test('a full event blocks the RSVP with an inline message [AC-11-4]', async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto(`/events/${EVENTS.commanderPod}`)

    // exact: the persistent "Event is full" status line contains 'Full' too
    await expect(page.getByText('Full', { exact: true })).toBeVisible()
    await expect(page.getByText('4 of 4 seats taken')).toBeVisible()

    // A count that already reads zero disables the button outright. The
    // server's 409 → inline message still backs the one case this can't
    // foresee: a page whose count went stale before the click.
    await expect(page.getByRole('button', { name: 'RSVP' })).toBeDisabled()
    await expect(page.getByRole('status')).toHaveText('Event is full')
    await expect(page.getByText("You're in ✓")).not.toBeVisible()
  })
})
