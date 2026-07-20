import { expect, test } from '@playwright/test'
import { EVENTS, USERS, apiCancel, apiRsvp, signInAs } from './helpers'

test.describe('my events', () => {
  test('shows upcoming RSVPs soonest-first with inline cancel and an empty state [AC-11-6]', async ({
    page,
  }) => {
    await signInAs(page, USERS.yuki)

    // Yuki holds no RSVPs by seed contract — the empty state comes first.
    await page.goto('/my-events')
    await expect(page.getByText("You haven't RSVP'd to any upcoming events")).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse events' })).toBeVisible()

    // Heavy Euro starts in 5 days, Friday Night Magic in 2 — soonest first.
    await apiRsvp(page, EVENTS.heavyEuro)
    await apiRsvp(page, EVENTS.fridayNightMagic)
    await page.reload()

    const titles = page.locator('main ul li a')
    await expect(titles).toHaveText([
      'Friday Night Magic — Standard',
      'Heavy Euro Board Game Meetup',
    ])

    await page
      .locator('main ul li', { hasText: 'Friday Night Magic — Standard' })
      .getByRole('button', { name: 'Cancel' })
      .click()

    await expect(page.getByText('Friday Night Magic — Standard')).not.toBeVisible()
    await expect(page.getByText('Heavy Euro Board Game Meetup')).toBeVisible()

    await apiCancel(page, EVENTS.heavyEuro)
  })
})
