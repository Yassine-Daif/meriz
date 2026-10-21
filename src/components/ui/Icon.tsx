import { useLanguage } from "../../lib/useLanguage"
import type { ReactNode } from 'react'
const paths = {
  panel: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 3v18"/></>,
  fit: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M16 21h5v-5"/>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
  save: <><path d="M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  entity: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M8 15h8"/></>,
  association: <><path d="m12 3 9 9-9 9-9-9z"/></>,
  pencil: <><path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/></>,
  pointer: <path d="m5 3 14 10-7 1-3 7z"/>,
  comment: <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2Z"/>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="m3 3 18 18M10 5a13 13 0 0 1 12 7 19 19 0 0 1-4 5M6 6a19 19 0 0 0-4 6s4 7 10 7a12 12 0 0 0 4-1"/></>,
  eraser: <><path d="m15 3 6 6-11 12H6l-4-4zM7 12l6 6M10 21h12"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  logout: <><path d="M9 4H4v16h5M14 7l5 5-5 5M8 12h11"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>,
  folder: <path d="M3 6h6l2 3h10v12H3z"/>,
} satisfies Record<string, ReactNode>
export type IconName = keyof typeof paths
export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  useLanguage()
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={'shrink-0 ' + className}>{paths[name]}</svg>
}
