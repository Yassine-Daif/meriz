/**
 * Logo de Meriz, repris de design/logo : une tuile indigo, la queue en V
 * et deux merises. Les couleurs suivent le thème par les tokens (tuile
 * « logo », mot à l'encre). Décoratif par défaut, nommé si `label`.
 */

interface LogoProps {
  /** Hauteur en pixels. */
  size?: number
  /** Nom accessible. Sans lui, le logo est ignoré des lecteurs d'écran. */
  label?: string
  className?: string
}

function a11y(label: string | undefined) {
  return label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
}

function Mark() {
  return (
    <>
      <rect width="64" height="64" rx="15" className="fill-logo" />
      <path
        d="M24.3 32 32 15.2 39.7 32"
        fill="none"
        className="stroke-white"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.3" cy="40.4" r="10.5" className="fill-white" />
      <circle cx="39.7" cy="40.4" r="10.5" strokeWidth="3.36" className="fill-white stroke-logo" />
    </>
  )
}

/** L'icône seule. */
export function LogoMark({ size = 28, label, className }: LogoProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className ?? ''}`} {...a11y(label)}>
      <Mark />
    </svg>
  )
}

const WORD =
  'M86.19 48L80 48L80 16L84.37 16L96.07 34.75L107.77 16L112.14 16L112.14 48L105.99 48L105.99 28.88L98.16 41.45L93.97 41.45L86.19 28.93L86.19 48M128.57 48.46Q125.11 48.46 122.42 46.98Q119.74 45.50 118.17 42.90Q116.60 40.31 116.60 36.98Q116.60 33.71 118.12 31.14Q119.65 28.56 122.29 27.04Q124.93 25.51 128.16 25.51Q131.35 25.51 133.78 26.95Q136.22 28.38 137.60 30.86Q138.99 33.34 138.99 36.48Q138.99 37.08 138.92 37.69Q138.86 38.30 138.67 39.08L122.61 39.12Q122.79 39.81 123.11 40.35Q123.83 41.85 125.25 42.65Q126.66 43.45 128.52 43.45Q130.21 43.45 131.57 42.88Q132.94 42.31 133.94 41.17L137.45 44.68Q135.85 46.54 133.55 47.50Q131.25 48.46 128.57 48.46M122.61 34.66L133.26 34.62Q133.08 33.84 132.80 33.21Q132.17 31.89 131 31.18Q129.84 30.48 128.16 30.48Q126.38 30.48 125.06 31.27Q123.74 32.07 123.06 33.48Q122.79 34.03 122.61 34.66M148.64 48L142.68 48L142.68 26.01L148.64 26.01L148.64 27.97Q148.64 27.93 148.69 27.88Q150.65 25.56 154.33 25.56Q155.93 25.56 157.20 26.08Q158.48 26.61 159.52 27.79L155.79 32.07Q155.29 31.52 154.58 31.25Q153.88 30.98 152.97 30.98Q151.06 30.98 149.85 32.18Q148.64 33.39 148.64 35.85L148.64 48M167.62 48L161.62 48L161.62 26.01L167.62 26.01L167.62 48M164.62 22.46Q163.16 22.46 162.21 21.49Q161.25 20.51 161.25 19.05Q161.25 17.64 162.21 16.64Q163.16 15.64 164.62 15.64Q166.12 15.64 167.06 16.64Q167.99 17.64 167.99 19.05Q167.99 20.51 167.06 21.49Q166.12 22.46 164.62 22.46M189.93 48L171.36 48L171.36 44.59L181.64 31.20L172.18 31.20L172.18 26.01L190.20 26.01L190.20 29.43L179.91 42.81L189.93 42.81'

/** L'icône et le mot « Meriz ». */
export function Lockup({ size = 32, label, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 191 64"
      height={size}
      width={(size * 191) / 64}
      className={`shrink-0 ${className ?? ''}`}
      {...a11y(label)}
    >
      <Mark />
      <path d={WORD} className="fill-ink" />
    </svg>
  )
}
