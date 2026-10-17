/*
 * Le sommaire suit la lecture : la partie en cours est marquée.
 *
 * On ne guette pas l'apparition des titres, qui laisse des trous quand
 * une partie est plus haute que l'écran. On regarde simplement, au
 * défilement, quel est le dernier titre passé au-dessus de la ligne de
 * lecture. Sans ce script, le sommaire reste une liste de liens qui
 * fonctionne.
 */
;(function () {
  var liens = [...document.querySelectorAll('.sommaire a')]
  if (liens.length === 0) return

  /** La ligne de référence : un peu sous le haut de la fenêtre. */
  var LIGNE = 140

  var parties = liens
    .map(function (lien) {
      return { lien: lien, titre: document.getElementById(lien.getAttribute('href').slice(1)) }
    })
    .filter(function (partie) {
      return partie.titre !== null
    })

  var marque = null

  function suivre() {
    var courant = parties[0]
    for (var partie of parties) {
      if (partie.titre.getBoundingClientRect().top <= LIGNE) {
        courant = partie
      }
    }
    if (courant.lien === marque) return
    if (marque) marque.removeAttribute('aria-current')
    courant.lien.setAttribute('aria-current', 'true')
    marque = courant.lien
  }

  var prevu = false
  function auDefilement() {
    if (prevu) return
    prevu = true
    requestAnimationFrame(function () {
      prevu = false
      suivre()
    })
  }

  suivre()
  window.addEventListener('scroll', auDefilement, { passive: true })
  window.addEventListener('resize', auDefilement, { passive: true })
})()
