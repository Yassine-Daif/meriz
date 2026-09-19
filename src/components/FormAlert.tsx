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
        <p className="flex items-start gap-2 rounded-control bg-danger-soft px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="font-bold text-danger">
            ✕
          </span>
          {message}
        </p>
      )}
    </div>
  )
}
