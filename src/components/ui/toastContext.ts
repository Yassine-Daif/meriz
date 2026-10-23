import { createContext, useContext } from 'react'

export type ToastMessage = string | { kind: 'info' | 'error'; text: string } | null
export const ToastContext = createContext<((message: ToastMessage) => void) | null>(null)

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('ToastProvider absent')
  return show
}
