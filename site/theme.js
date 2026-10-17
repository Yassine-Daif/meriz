/*
 * Le choix du thème, clair ou sombre.
 *
 * Le site est clair par défaut : c'est l'attente sur un site de
 * logiciel, et c'est ce qui s'affiche quand ce script ne tourne pas. Le
 * choix est retenu d'une visite à l'autre, et c'est un bloc en ligne
 * dans le <head> qui le repose avant le premier rendu, pour qu'un
 * visiteur en sombre n'essuie pas un éclair blanc à chaque page.
 */
;(function () {
  var CLE = 'meriz-theme'
  var racine = document.documentElement

  function lire() {
    try {
      return localStorage.getItem(CLE) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }

  function poser(theme) {
    if (theme === 'dark') {
      racine.setAttribute('data-theme', 'dark')
    } else {
      racine.removeAttribute('data-theme')
    }

    for (var bouton of document.querySelectorAll('[data-theme-choix]')) {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.themeChoix === theme))
    }

    // La capture de l'outil suit le thème : une capture claire sur un
    // site sombre, ou l'inverse, se remarque tout de suite.
    var apercu = document.querySelector('[data-apercu]')
    if (apercu) {
      apercu.src = theme === 'dark' ? 'apercu-sombre.png' : 'apercu-clair.png'
    }
  }

  poser(lire())

  for (var bouton of document.querySelectorAll('[data-theme-choix]')) {
    bouton.addEventListener('click', function (evenement) {
      var choix = evenement.currentTarget.dataset.themeChoix
      try {
        localStorage.setItem(CLE, choix)
      } catch {
        // Stockage refusé : le choix vaut pour cette page, c'est tout.
      }
      poser(choix)
    })
  }
})()
