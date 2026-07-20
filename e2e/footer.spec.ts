import { expect, test } from '@playwright/test'
import { USERS, signInAs } from './helpers'

test.describe('footer', () => {
  test('shows the app name on the signed-out picker screen [AC-20-3]', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
    await expect(page.getByRole('contentinfo').getByText('Game Night')).toBeVisible()
  })

  test('shows the same app name on a signed-in page [AC-20-3]', async ({ page }) => {
    await signInAs(page, USERS.yuki)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Upcoming events' })).toBeVisible()
    await expect(page.getByRole('contentinfo').getByText('Game Night')).toBeVisible()
  })
})
