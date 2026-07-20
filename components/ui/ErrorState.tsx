export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-medium text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Retry
      </button>
    </div>
  )
}
