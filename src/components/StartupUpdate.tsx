import type { UpdateProgress } from '../lib/desktopUpdate'

export function StartupUpdate({ state }: { state: UpdateProgress }) {
  const text = state.phase === 'checking'
    ? 'Vérification des mises à jour…'
    : state.phase === 'installing'
      ? 'Installation de Meriz '+state.version+'…'
      : 'Téléchargement de Meriz '+state.version+'…'
  return (
    <main className="flex min-h-dvh items-center justify-center bg-shell p-6 text-ink">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Meriz</h1>
        <p role="status" className="mt-3 text-sm">{text}</p>
        {state.phase === 'downloading' && (
          <progress aria-label="Téléchargement de la mise à jour" max={100}
            value={state.percent ?? undefined} className="mt-4 w-full" />
        )}
        <p className="mt-3 text-xs text-ink-soft">Vos documents restent sur votre appareil.</p>
      </div>
    </main>
  )
}
