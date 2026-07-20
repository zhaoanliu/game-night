import { expect, test } from '@playwright/test'
import { pickUser } from './helpers'

test.describe('player journey', () => {
  test('pick identity, search, RSVP, track it, cancel — the full loop [AC-11-10]', async ({
    page,
  }) => {
    // Arrive anonymous: the login gate comes first.
    await page.goto('/')
    await pickUser(page, 'Yuki Tanaka')
    await expect(page.getByRole('heading', { name: 'Upcoming events' })).toBeVisible()

    // Find the event and open it.
    await page.getByRole('searchbox', { name: 'Search events' }).fill('euro')
    await page.getByRole('link', { name: /Heavy Euro Board Game Meetup/ }).click()
    await expect(page.getByRole('heading', { name: 'Heavy Euro Board Game Meetup' })).toBeVisible()

    // Take a seat.
    await page.getByRole('button', { name: 'RSVP' }).click()
    await expect(page.getByText("You're in ✓")).toBeVisible()

    // It shows up under My events.
    await page.getByRole('link', { name: 'My events' }).click()
    await expect(page.getByText('Heavy Euro Board Game Meetup')).toBeVisible()

    // Change of plans: cancel inline, back to the empty state.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText("You haven't RSVP'd to any upcoming events")).toBeVisible()
  })
})
