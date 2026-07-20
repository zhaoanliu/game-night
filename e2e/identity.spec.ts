import { expect, test } from '@playwright/test'
import { USERS, signInAs } from './helpers'

test.describe('identity', () => {
  test('picker gates every path until an identity is picked [AC-11-1]', async ({ page }) => {
    await page.goto('/my-events')

    await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My events' })).not.toBeVisible()

    await page.getByRole('button', { name: 'Yuki Tanaka' }).click()

    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My events' })).toBeVisible()
  })

  test('header switcher swaps user and role [AC-11-1]', async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'My events' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Organizer' })).not.toBeVisible()

    await page
      .getByRole('combobox', { name: 'Switch user' })
      .selectOption({ label: 'Alice Chen (Mox Boarding House)' })

    await expect(page.getByRole('link', { name: 'Organizer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My events' })).not.toBeVisible()
  })

  test('sign out returns to the picker', async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Upcoming events' })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()

    await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
  })
})
