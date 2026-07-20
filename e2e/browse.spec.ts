import { expect, test } from '@playwright/test'
import { USERS, signInAs } from './helpers'

test.describe('browse', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Upcoming events' })).toBeVisible()
  })

  test('lists upcoming events only, with seat badges [AC-11-2]', async ({ page }) => {
    await expect(page.getByText('Friday Night Magic — Standard')).toBeVisible()

    // The past event and the in-progress event both fail starts_at > now.
    await expect(page.getByText('Retro Game Night')).not.toBeVisible()
    await expect(page.getByText('Midweek Board Game Night')).not.toBeVisible()

    const fullCard = page.getByRole('link', { name: /Commander Pod/ })
    await expect(fullCard.getByText('Full')).toBeVisible()
    const lastSeatCard = page.getByRole('link', { name: /Friday Night Magic/ })
    await expect(lastSeatCard.getByText('1 seat left')).toBeVisible()
  })

  test('search narrows by title and location [AC-11-2]', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search events' }).fill('magic')

    await expect(page.getByText('Friday Night Magic — Standard')).toBeVisible()
    await expect(page.getByText('Heavy Euro Board Game Meetup')).not.toBeVisible()
  })

  test('game type chips filter the list [AC-11-2]', async ({ page }) => {
    await page.getByRole('button', { name: 'RPG' }).click()

    await expect(page.getByText('D&D 5e One-Shot: Tomb of Horrors')).toBeVisible()
    await expect(page.getByText('Friday Night Magic — Standard')).not.toBeVisible()

    await page.getByRole('button', { name: 'All' }).click()
    await expect(page.getByText('Friday Night Magic — Standard')).toBeVisible()
  })
})
