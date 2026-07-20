import type { ReactNode } from 'react'

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-lg font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
