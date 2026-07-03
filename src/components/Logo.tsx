/**
 * Logo Meriz : deux merises (petites cerises sauvages, l'origine du
 * nom Merise) aux queues jointes, une feuille. SVG en ligne, une
 * seule couleur d'accent, aucune dépendance.
 */
export function Logo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 3c-2 2.6-4.5 4.2-5.4 9M12 3c1 3.6 3 6 4.6 9.6"
        stroke="#4338ca"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 3c2.2-1.4 4.6-1.2 6 .2-1.8 1.2-4.2 1.3-6-.2Z"
        fill="#4338ca"
        fillOpacity="0.35"
        stroke="#4338ca"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="6.2" cy="15.6" r="3.6" fill="#4338ca" />
      <circle cx="17.2" cy="16.2" r="3.6" fill="#6366f1" />
      <circle cx="5.2" cy="14.5" r="1" fill="#c7d2fe" />
      <circle cx="16.2" cy="15.1" r="1" fill="#c7d2fe" />
    </svg>
  )
}
