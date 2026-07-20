import { expect, test } from '@playwright/test'
import { EVENTS, USERS, apiCancel, signInAs } from './helpers'

test.describe('rsvp', () => {
  test('player RSVPs with a pending state and the count settles from the server [AC-11-3]', async ({
    page,
  }) => {
    await signInAs(page, USERS.yuki)
    await page.goto(`/events/${EVENTS.heavyEuro}`)
    await expect(page.getByText('3 of 8 seats taken')).toBeVisible()

    await page.getByRole('button', { name: 'RSVP' }).click()

    await expect(page.getByText("You're in ✓")).toBeVisible()
    await expect(page.getByText('4 of 8 seats taken')).toBeVisible()

    await apiCancel(page, EVENTS.heavyEuro)
  })

  test('cancelling frees the seat and the canceller can re-RSVP [AC-11-5]', async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto(`/events/${EVENTS.gloomhaven}`)

    // Take the last seat: the badge flips to Full for everyone.
    await expect(page.getByText('1 seat left')).toBeVisible()
    await page.getByRole('button', { name: 'RSVP' }).click()
    await expect(page.getByText("You're in ✓")).toBeVisible()
    await expect(page.getByText('Full', { exact: true })).toBeVisible()
    await expect(page.getByText('6 of 6 seats taken')).toBeVisible()

    // Release it: the seat comes back.
    await page.getByRole('button', { name: 'Cancel RSVP' }).click()
    await expect(page.getByRole('status')).toHaveText('Your seat has been released')
    await expect(page.getByText('1 seat left')).toBeVisible()
    await expect(page.getByText('5 of 6 seats taken')).toBeVisible()

    // Re-RSVP after cancel is a fresh insert — it just works.
    await page.getByRole('button', { name: 'RSVP' }).click()
    await expect(page.getByText("You're in ✓")).toBeVisible()

    await apiCancel(page, EVENTS.gloomhaven)
  })
})
