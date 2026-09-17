import { useEffect, useRef } from 'react'

interface FormAlertProps {
  message: string | null
  /** Change à chaque échec d'envoi : le message reprend alors le focus. */
  attempt: number
}

/**
 * Erreur générale d'un formulaire : annoncée (role="alert") et
 * focalisée après chaque échec, pour qu'on ne la manque pas au clavier.
 */
export function FormAlert({ message, attempt }: FormAlertProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message && attempt > 0) {
      ref.current?.focus()
    }
  }, [message, attempt])

  return (
    <div ref={ref} role="alert" tabIndex={-1} className="empty:hidden">
      {message && (
        <p className="flex items-start gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-zinc-800">
          <span aria-hidden="true" className="text-rose-700">
            ✕
          </span>
          {message}
        </p>
      )}
    </div>
  )
}
