import { expect, test } from '@playwright/test'
import { EVENTS, MIDWEEK_ROSTER, USERS, deleteEventByTitle, signInAs } from './helpers'

const CREATED_TITLE = 'Sealed League Night (e2e)'

function futureLocalDatetime(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 3_600_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T19:00`
}

test.describe('organizer', () => {
  test.afterEach(async () => {
    await deleteEventByTitle(CREATED_TITLE)
  })

  test('create form validates client-side and a valid event lands on the board [AC-11-7]', async ({
    page,
  }) => {
    await signInAs(page, USERS.alice)
    await page.goto('/organizer')

    // Invalid input never leaves the browser.
    await page.getByLabel('Capacity').fill('0')
    await page.getByLabel('Starts').fill('2020-01-01T19:00')
    await page.getByRole('button', { name: 'Create event' }).click()

    await expect(page.getByTestId('error-title')).toContainText('Title is required')
    await expect(page.getByTestId('error-starts_at')).toHaveText('Start time must be in the future')
    await expect(page.getByTestId('error-capacity')).toContainText('between 1 and 1000')

    // Fix everything and create for real.
    await page.getByLabel('Title').fill(CREATED_TITLE)
    await page.getByLabel('Game type').selectOption('tcg')
    await page.getByLabel('Capacity').fill('8')
    await page.getByLabel('Starts').fill(futureLocalDatetime(9))
    await page.getByLabel('Location').fill('Card Kingdom, Ballard')
    await page.getByRole('button', { name: 'Create event' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Created' })).toBeVisible()
    await expect(page.locator('main ul li', { hasText: CREATED_TITLE })).toBeVisible()

    // The event is real: it shows up on the public board too.
    await page.goto('/')
    await expect(page.getByText(CREATED_TITLE)).toBeVisible()
  })

  test('owner sees the roster on the in-progress event; another organizer does not [AC-11-8]', async ({
    page,
  }) => {
    await signInAs(page, USERS.alice)
    await page.goto(`/events/${EVENTS.midweek}`)

    await expect(page.getByRole('heading', { name: `Attendees (${MIDWEEK_ROSTER.length})` })).toBeVisible()
    const roster = page.locator('main ul')
    for (const name of MIDWEEK_ROSTER) {
      await expect(roster.getByText(name)).toBeVisible()
    }

    // Ben owns other events, not this one — no roster section at all, and the
    // server would 403 the fetch even if the UI tried.
    await signInAs(page, USERS.ben)
    await page.goto(`/events/${EVENTS.midweek}`)

    await expect(page.getByRole('heading', { name: 'Midweek Board Game Night' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Attendees/ })).not.toBeVisible()
    await expect(page.locator('main').getByText(MIDWEEK_ROSTER[0])).not.toBeVisible()
  })
})
