import { expect, test } from '@playwright/test'
import { EVENTS, USERS, signInAs } from './helpers'

test.describe('identity', () => {
  test('picker gates every path until an identity is picked [AC-11-1]', async ({ page }) => {
    await page.goto('/my-events')

    await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My events' })).not.toBeVisible()

    await page.getByRole('button', { name: 'Yuki Tanaka' }).click()

    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My events' })).toBeVisible()
  })

  test('identity sticks until sign-out; signing back in swaps user and role [AC-11-1]', async ({
    page,
  }) => {
    await signInAs(page, USERS.yuki)
    await page.goto('/')

    await expect(page.getByText('Yuki Tanaka')).toBeVisible()
    await expect(page.getByRole('link', { name: 'My events' })).toBeVisible()
    // No in-place switcher: the picker is the only way to change identity.
    await expect(page.getByRole('combobox')).not.toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()

    await page.getByRole('button', { name: 'Alice Chen (Mox Boarding House)' }).click()

    await expect(page.getByRole('link', { name: 'Organizer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My events' })).not.toBeVisible()
  })

  test('signing in as someone else re-resolves the open page [AC-11-1]', async ({ page }) => {
    // Amara holds a Tomb of Horrors seat; Yuki does not. After a sign-out and
    // a fresh pick on the same URL, the page must show the new user's truth.
    await signInAs(page, USERS.amara)
    await page.goto(`/events/${EVENTS.tombOfHorrors}`)
    await expect(page.getByText("You're in ✓")).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByRole('button', { name: 'Yuki Tanaka' }).click()

    await expect(page.getByRole('button', { name: 'RSVP' })).toBeVisible()
    await expect(page.getByText("You're in ✓")).not.toBeVisible()
  })
})
