'use client'

import { useState, type FormEvent } from 'react'
import { apiFetch } from '@/lib/client/api'
import { GAME_TYPE_LABELS } from '@/lib/format'
import { GAME_TYPES, type EventWithCount } from '@/lib/types'
import { CAPACITY_MAX, LOCATION_MAX, MAX_DURATION_HOURS, TITLE_MAX } from '@/lib/validation'
import { Spinner } from '@/components/ui/Spinner'

interface FormValues {
  title: string
  game_type: string
  starts_at: string
  ends_at: string
  location: string
  capacity: string
}

const EMPTY: FormValues = {
  title: '',
  game_type: 'boardgame',
  starts_at: '',
  ends_at: '',
  location: '',
  capacity: '',
}

// Client-side mirror of validateEventInput — same bounds, same messages — so
// the common mistakes never leave the browser. The server remains the
// authority: a 400 envelope's fields map renders through the same slots.
function validate(values: FormValues): Record<string, string> {
  const fields: Record<string, string> = {}

  const title = values.title.trim()
  if (title.length < 1 || title.length > TITLE_MAX) {
    fields.title = `Title is required (max ${TITLE_MAX} characters)`
  }

  const startsAt = Date.parse(values.starts_at)
  if (Number.isNaN(startsAt)) {
    fields.starts_at = 'Start time is required'
  } else if (startsAt <= Date.now()) {
    fields.starts_at = 'Start time must be in the future'
  }

  if (values.ends_at !== '') {
    const endsAt = Date.parse(values.ends_at)
    if (Number.isNaN(endsAt)) {
      fields.ends_at = 'End time must be a valid date'
    } else if (!Number.isNaN(startsAt) && endsAt <= startsAt) {
      fields.ends_at = 'End time must be after the start time'
    } else if (!Number.isNaN(startsAt) && endsAt - startsAt > MAX_DURATION_HOURS * 3_600_000) {
      fields.ends_at = `An event cannot run longer than ${MAX_DURATION_HOURS} hours`
    }
  }

  const location = values.location.trim()
  if (location.length < 1 || location.length > LOCATION_MAX) {
    fields.location = `Location is required (max ${LOCATION_MAX} characters)`
  }

  const capacity = Number(values.capacity)
  if (values.capacity === '' || !Number.isInteger(capacity) || capacity < 1 || capacity > CAPACITY_MAX) {
    fields.capacity = `Capacity must be an integer between 1 and ${CAPACITY_MAX}`
  }

  return fields
}

export function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const set = (field: keyof FormValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setCreated(null)
    setFormError(null)

    const clientErrors = validate(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSubmitting(true)
    const result = await apiFetch<{ event: EventWithCount }>('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        title: values.title.trim(),
        game_type: values.game_type,
        starts_at: new Date(values.starts_at).toISOString(),
        ...(values.ends_at !== '' && { ends_at: new Date(values.ends_at).toISOString() }),
        location: values.location.trim(),
        capacity: Number(values.capacity),
      }),
    })
    setSubmitting(false)

    if (result.ok) {
      setValues(EMPTY)
      setCreated(`Created "${result.data.event.title}"`)
      onCreated()
    } else if (result.fields) {
      setErrors(result.fields)
    } else {
      setFormError(result.message)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold">Create an event</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title" error={errors.title} className="sm:col-span-2">
          {(id) => (
            <input
              id={id}
              type="text"
              value={values.title}
              onChange={(event) => set('title')(event.target.value)}
              className={inputClass(errors.title)}
            />
          )}
        </Field>

        <Field label="Game type" name="game_type" error={errors.game_type}>
          {(id) => (
            <select
              id={id}
              value={values.game_type}
              onChange={(event) => set('game_type')(event.target.value)}
              className={inputClass(errors.game_type)}
            >
              {GAME_TYPES.map((type) => (
                <option key={type} value={type}>
                  {GAME_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Capacity" name="capacity" error={errors.capacity}>
          {(id) => (
            <input
              id={id}
              type="number"
              min={1}
              max={CAPACITY_MAX}
              value={values.capacity}
              onChange={(event) => set('capacity')(event.target.value)}
              className={inputClass(errors.capacity)}
            />
          )}
        </Field>

        <Field label="Starts" name="starts_at" error={errors.starts_at}>
          {(id) => (
            <input
              id={id}
              type="datetime-local"
              value={values.starts_at}
              onChange={(event) => set('starts_at')(event.target.value)}
              className={inputClass(errors.starts_at)}
            />
          )}
        </Field>

        <Field label="Ends (optional, defaults to 3 hours)" name="ends_at" error={errors.ends_at}>
          {(id) => (
            <input
              id={id}
              type="datetime-local"
              value={values.ends_at}
              onChange={(event) => set('ends_at')(event.target.value)}
              className={inputClass(errors.ends_at)}
            />
          )}
        </Field>

        <Field label="Location" name="location" error={errors.location} className="sm:col-span-2">
          {(id) => (
            <input
              id={id}
              type="text"
              value={values.location}
              onChange={(event) => set('location')(event.target.value)}
              className={inputClass(errors.location)}
            />
          )}
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting && <Spinner />}
          Create event
        </button>
        <p role="status" className="text-sm font-medium text-green-700">
          {created}
        </p>
        {formError && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {formError}
          </p>
        )}
      </div>
    </form>
  )
}

function inputClass(error?: string): string {
  return `w-full rounded-md border px-3 py-2 text-sm ${
    error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
  }`
}

function Field({
  label,
  name,
  error,
  className = '',
  children,
}: {
  label: string
  name: string
  error?: string
  className?: string
  children: (id: string) => React.ReactNode
}) {
  const id = `event-${name}`
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1">{children(id)}</div>
      {error && (
        <p data-testid={`error-${name}`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
