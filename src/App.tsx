export function App() {
  return (
    <div className="flex h-dvh flex-col bg-white text-slate-900">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-blue-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>

      <header className="flex items-baseline gap-3 border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-semibold">Meriz</h1>
        <p className="text-sm text-slate-600">Modélisation Merise dans le navigateur</p>
      </header>

      {/* Cette zone accueillera le canvas de dessin du MCD */}
      <main id="contenu" className="flex flex-1 items-center justify-center bg-slate-50 p-4">
        <p className="max-w-md text-center text-slate-700">
          Bienvenue dans Meriz. Le canvas de modélisation arrivera ici.
        </p>
      </main>
    </div>
  )
}
