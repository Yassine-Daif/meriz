/*
 * Les entrées : un bloc arrive quand on l'atteint.
 *
 * L'état d'arrivée est l'état par défaut de la page. Ce script ne fait
 * qu'ajouter une classe sur la racine, puis marquer les éléments vus :
 * sans lui, et sous mouvement réduit, tout est déjà en place.
 */
;(function () {
  if (!('IntersectionObserver' in window)) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  document.documentElement.classList.add('js')

  var observateur = new IntersectionObserver(
    function (entrees) {
      for (var entree of entrees) {
        if (!entree.isIntersecting) continue
        entree.target.classList.add('vu')
        observateur.unobserve(entree.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  )

  for (var groupe of document.querySelectorAll('[data-anime]')) {
    var enfants = groupe.children
    for (var i = 0; i < enfants.length; i += 1) {
      // Les blocs d'une même suite s'accrochent l'un après l'autre, dans
      // l'ordre de lecture : le modèle se compose sous les yeux.
      enfants[i].style.setProperty('--retard', i * 90 + 'ms')
      enfants[i].classList.add('entre')
      observateur.observe(enfants[i])
    }
  }

  for (var seul of document.querySelectorAll('[data-anime-seul]')) {
    seul.classList.add('entre')
    observateur.observe(seul)
  }
})()
