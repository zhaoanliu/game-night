import { expect, test } from '@playwright/test'
import { EVENTS, USERS, signInAs } from './helpers'

test.describe('full event', () => {
  test('a full event blocks the RSVP with an inline message [AC-11-4]', async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto(`/events/${EVENTS.commanderPod}`)

    await expect(page.getByText('Full')).toBeVisible()
    await expect(page.getByText('4 of 4 seats taken')).toBeVisible()

    // The button stays clickable on purpose: the server is the source of
    // truth, and its 409 renders inline rather than as a dead control.
    await page.getByRole('button', { name: 'RSVP' }).click()

    await expect(page.getByRole('status')).toHaveText('Event is full')
    await expect(page.getByText('4 of 4 seats taken')).toBeVisible()
    await expect(page.getByText("You're in ✓")).not.toBeVisible()
  })
})
