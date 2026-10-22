var merizEnglish = document.documentElement.lang === 'en'
/*
 * Le script du site vitrine.
 *
 * Cinq morceaux, dans cet ordre : le thème, les onglets, le menu des
 * petits écrans, le parcours de la page Merise, et la dernière version
 * publiée. Chacun ne fait rien si la page ne contient pas ce qu'il
 * cherche, ce qui permet de servir le même fichier partout.
 *
 * Tout est écrit pour que la page reste lisible sans lui : les sections
 * sont toutes dans le HTML, les onglets sont des liens, et le menu est
 * une liste de liens visible.
 */

/*
 * Le choix du thème, clair ou sombre.
 *
 * Le site est clair par défaut : c'est l'attente sur un site de
 * logiciel, et c'est ce qui s'affiche quand ce script ne tourne pas. Le
 * choix est retenu d'une visite à l'autre, et c'est un bloc en ligne
 * dans le <head> qui le repose avant le premier rendu, pour qu'un
 * visiteur en sombre n'essuie pas un éclair blanc à chaque page.
 *
 * Les deux boutons existent en double, dans la barre et dans le menu
 * des petits écrans : les deux jeux suivent le même choix.
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
      var choisi = bouton.dataset.themeChoix === theme
      bouton.setAttribute('aria-pressed', String(choisi))
      // La pastille pleine marque le thème en cours : la couleur seule
      // ne suffirait pas à le dire.
      bouton.classList.toggle('is-on', choisi)
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

/*
 * Les onglets des quatre pages.
 *
 * Dans le HTML servi, un onglet est un simple lien vers sa section, et
 * toutes les sections sont là, les unes sous les autres. Sans ce
 * script, la page se lit donc de haut en bas et chaque lien mène au
 * bon endroit. Avec lui, les sections se replient et les liens
 * deviennent de vrais onglets, au clavier comme à la souris.
 *
 * Un groupe est formé des liens [data-onglet] qui partagent le même
 * parent. Chaque lien pointe vers le panneau qu'il ouvre.
 */
;(function () {
  var groupes = new Map()

  for (var lien of document.querySelectorAll('[data-onglet]')) {
    var parent = lien.parentElement
    if (!parent) continue
    if (!groupes.has(parent)) groupes.set(parent, [])
    groupes.get(parent).push(lien)
  }

  if (groupes.size === 0) return

  groupes.forEach(function (liens, parent) {
    var onglets = []

    for (var lien of liens) {
      var cible = document.getElementById(lien.getAttribute('href').slice(1))
      if (cible) onglets.push({ lien: lien, panneau: cible })
    }
    if (onglets.length < 2) return

    // L'orientation décide des flèches qui déplacent la sélection.
    var vertical = parent.getAttribute('aria-orientation') === 'vertical'
    parent.setAttribute('role', 'tablist')
    if (vertical) parent.setAttribute('aria-orientation', 'vertical')

    for (var onglet of onglets) {
      onglet.lien.setAttribute('role', 'tab')
      onglet.lien.setAttribute('aria-controls', onglet.panneau.id)
      onglet.panneau.setAttribute('role', 'tabpanel')
      onglet.panneau.setAttribute('tabindex', '0')
    }

    function montrer(choisi, donnerLeFocus) {
      for (var i = 0; i < onglets.length; i += 1) {
        var actif = onglets[i] === choisi
        onglets[i].lien.classList.toggle('is-on', actif)
        onglets[i].lien.setAttribute('aria-selected', String(actif))
        // Un seul onglet reçoit la tabulation : à l'intérieur du
        // groupe, ce sont les flèches qui déplacent la sélection.
        onglets[i].lien.setAttribute('tabindex', actif ? '0' : '-1')
        onglets[i].panneau.hidden = !actif
      }
      if (donnerLeFocus) choisi.lien.focus()
      parent.dispatchEvent(
        new CustomEvent('onglet', {
          bubbles: true,
          detail: { cle: choisi.lien.dataset.onglet, index: onglets.indexOf(choisi) },
        }),
      )
    }

    for (var k = 0; k < onglets.length; k += 1) {
      ;(function (onglet) {
        onglet.lien.addEventListener('click', function (evenement) {
          evenement.preventDefault()
          montrer(onglet, false)
        })
      })(onglets[k])
    }

    parent.addEventListener('keydown', function (evenement) {
      var index = onglets.findIndex(function (o) {
        return o.lien === document.activeElement
      })
      if (index < 0) return

      var suivant = null
      var avance = vertical ? 'ArrowDown' : 'ArrowRight'
      var recule = vertical ? 'ArrowUp' : 'ArrowLeft'

      if (evenement.key === avance) suivant = (index + 1) % onglets.length
      else if (evenement.key === recule) suivant = (index - 1 + onglets.length) % onglets.length
      else if (evenement.key === 'Home') suivant = 0
      else if (evenement.key === 'End') suivant = onglets.length - 1
      else return

      evenement.preventDefault()
      montrer(onglets[suivant], true)
    })

    // Une adresse qui vise un panneau l'ouvre : un lien partagé tombe
    // ainsi sur la bonne section, et pas sur une section repliée.
    var vise = onglets.find(function (o) {
      return '#' + o.panneau.id === window.location.hash
    })
    var depart =
      vise ||
      onglets.find(function (o) {
        return o.lien.classList.contains('is-on')
      }) ||
      onglets[0]
    montrer(depart, false)

    parent.ongletsMeriz = { onglets: onglets, montrer: montrer }
  })
})()

/*
 * Mesurer les vrais libellés évite les hypothèses sur la langue, la police
 * ou le numéro de version. La copie ne participe ni au rendu ni au focus.
 */
;(function () {
  var header = document.querySelector('.mz-nav')
  var row = header && header.querySelector('.mz-nav-row')
  if (!row) return
  var scheduled = false
  function measure() {
    scheduled = false
    var copy = row.cloneNode(true)
    copy.classList.add('mz-nav-measure')
    copy.setAttribute('aria-hidden', 'true')
    copy.inert = true
    for (var element of copy.querySelectorAll('[id]')) element.removeAttribute('id')
    header.appendChild(copy)
    var required = copy.getBoundingClientRect().width
    copy.remove()
    var style = getComputedStyle(row)
    var available = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    header.classList.toggle('mz-nav-compact', required > available - 2)
    header.dispatchEvent(new Event('meriz:navigation-layout'))
  }
  function schedule() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(measure)
  }
  measure()
  window.addEventListener('resize', schedule)
  if (window.ResizeObserver) {
    var observer = new ResizeObserver(schedule)
    observer.observe(row)
    for (var child of row.children) observer.observe(child)
  }
  new MutationObserver(schedule).observe(row, { childList: true, characterData: true, subtree: true })
  if (document.fonts) document.fonts.ready.then(schedule)
})()

/*
 * Le menu de navigation sur petit écran.
 *
 * Quand les libellés ne tiennent plus, la barre passe en mode compact.
 * Le panneau les reprend, avec le choix de thème et le bouton d'essai.
 * Sans ce script, le panneau reste ouvert : la navigation est alors
 * une liste de liens visible, jamais un menu qu'on ne peut pas ouvrir.
 */
;(function () {
  var bouton = document.querySelector('[data-menu-bouton]')
  var panneau = document.querySelector('[data-menu]')
  if (!bouton || !panneau) return

  function fermer() {
    panneau.hidden = true
    bouton.setAttribute('aria-expanded', 'false')
    bouton.setAttribute('aria-label', (merizEnglish ? 'Open menu' : 'Ouvrir le menu'))
  }

  function ouvrir() {
    panneau.hidden = false
    bouton.setAttribute('aria-expanded', 'true')
    bouton.setAttribute('aria-label', (merizEnglish ? 'Close menu' : 'Fermer le menu'))
    var premier = panneau.querySelector('a, button')
    if (premier) premier.focus()
  }

  fermer()

  bouton.addEventListener('click', function () {
    if (panneau.hidden) ouvrir()
    else fermer()
  })

  document.addEventListener('keydown', function (evenement) {
    if (evenement.key !== 'Escape' || panneau.hidden) return
    fermer()
    bouton.focus()
  })

  // Un clic à côté ferme le menu, comme on s'y attend.
  document.addEventListener('click', function (evenement) {
    if (panneau.hidden) return
    if (panneau.contains(evenement.target) || bouton.contains(evenement.target)) return
    fermer()
  })

  // Le focus ne sort pas du menu tant qu'il est ouvert.
  panneau.addEventListener('keydown', function (evenement) {
    if (evenement.key !== 'Tab') return
    var cibles = [...panneau.querySelectorAll('a, button')].filter(function (element) {
      return element.offsetParent !== null
    })
    if (cibles.length === 0) return
    var premier = cibles[0]
    var dernier = cibles[cibles.length - 1]
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault()
      dernier.focus()
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault()
      premier.focus()
    }
  })

  // Repassé en grand écran, le menu n'a plus lieu d'être ouvert.
  function suivreDisposition() {
    if (getComputedStyle(bouton).display !== 'none' || panneau.hidden) return
    var rendreFocus = panneau.contains(document.activeElement)
    fermer()
    if (rendreFocus) document.querySelector('.mz-navlinks a[aria-current], .mz-logo')?.focus()
  }
  document.querySelector('.mz-nav')?.addEventListener('meriz:navigation-layout', suivreDisposition)
  window.addEventListener('resize', suivreDisposition)
})()

/*
 * Le parcours de la page Merise, étape par étape.
 *
 * Les huit étapes sont toutes dans la page. onglets.js les replie et
 * laisse la première ouverte. Ce script ajoute ce qui va avec un
 * parcours : le repère « Étape 03 sur 08 », la barre d'avancement, et
 * les deux boutons qui mènent à l'étape précédente et à la suivante.
 *
 * Ces trois éléments ne veulent rien dire sans script : ils sont donc
 * masqués dans le HTML servi, et ce script les révèle.
 */
;(function () {
  var liste = document.querySelector('[data-onglet]')?.parentElement
  var groupe = liste && liste.ongletsMeriz
  if (!groupe) return

  var progres = document.querySelector('[data-progres]')
  var blocPrec = document.querySelector('[data-parcours-prec]')
  var blocSuiv = document.querySelector('[data-parcours-suiv]')
  if (!progres || !blocPrec || !blocSuiv) return

  var etiquette = progres.querySelector('.mz-mono')
  var barre = progres.querySelector('span[style*="width"]')
  var boutonPrec = blocPrec.querySelector('[data-vers-prec]')
  var boutonSuiv = blocSuiv.querySelector('[data-vers-suiv]')

  var total = groupe.onglets.length
  var deuxChiffres = function (n) {
    return n < 10 ? '0' + n : String(n)
  }

  /** Le titre d'une étape, sans son numéro. */
  function titre(index) {
    var spans = groupe.onglets[index].lien.querySelectorAll('span')
    return spans.length > 1 ? spans[1].textContent : ''
  }

  function suivre(index) {
    if (etiquette) {
      etiquette.textContent = (merizEnglish ? 'Step ' : 'Étape ') + deuxChiffres(index + 1) + (merizEnglish ? ' of ' : ' sur ') + deuxChiffres(total)
    }
    if (barre) barre.style.width = ((index + 1) / total) * 100 + '%'

    blocPrec.hidden = index === 0
    blocSuiv.hidden = index === total - 1

    if (boutonPrec && index > 0) {
      boutonPrec.querySelector('span:last-child').textContent = titre(index - 1)
    }
    if (boutonSuiv && index < total - 1) {
      boutonSuiv.querySelector('span:last-child').textContent = titre(index + 1)
    }
  }

  function aller(index) {
    groupe.montrer(groupe.onglets[index], false)
    // On remonte au début de l'étape : sans cela, on resterait au bas
    // de la page, devant un texte qui a changé sans prévenir.
    liste.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  progres.hidden = false

  if (boutonPrec) {
    boutonPrec.addEventListener('click', function () {
      var index = groupe.onglets.findIndex(function (o) {
        return !o.panneau.hidden
      })
      if (index > 0) aller(index - 1)
    })
  }

  if (boutonSuiv) {
    boutonSuiv.addEventListener('click', function () {
      var index = groupe.onglets.findIndex(function (o) {
        return !o.panneau.hidden
      })
      if (index >= 0 && index < total - 1) aller(index + 1)
    })
  }

  liste.addEventListener('onglet', function (evenement) {
    suivre(evenement.detail.index)
  })

  suivre(
    groupe.onglets.findIndex(function (o) {
      return !o.panneau.hidden
    }),
  )
})()

/*
 * La dernière version publiée, affichée dans la barre et dans le pied.
 *
 * Écrire le numéro dans les pages le rendrait faux à la publication
 * suivante. On le lit donc au chargement. Si l'appel échoue, le pied
 * reste masqué et le badge garde la valeur écrite dans la page : rien
 * ne clignote, rien ne ment.
 *
 * La page de téléchargement n'utilise pas ce script : telechargement.js
 * lit déjà la même publication, et un seul appel suffit.
 */
;(function () {
  var SOURCE = 'https://api.github.com/repos/Yassine-Daif/meriz/releases/latest'
  var DELAI_MAX = 6000

  // La page de téléchargement lit la même publication pour ses sept
  // fichiers : elle remplit elle-même le badge et le pied, et un seul
  // appel suffit.
  if (document.querySelector('[data-fichier]')) return

  var badge = document.querySelector('[data-version-courte]')
  var ligne = document.querySelector('[data-version]')
  if (!badge && !ligne) return

  async function derniere() {
    var abandon = new AbortController()
    var minuteur = setTimeout(function () {
      abandon.abort()
    }, DELAI_MAX)
    try {
      var reponse = await fetch(SOURCE, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: abandon.signal,
      })
      if (!reponse.ok) return null
      return await reponse.json()
    } catch {
      return null
    } finally {
      clearTimeout(minuteur)
    }
  }

  void (async function () {
    var publication = await derniere()
    if (!publication || typeof publication.tag_name !== 'string') return

    if (badge) badge.textContent = publication.tag_name

    if (ligne) {
      var date = publication.published_at
        ? (merizEnglish ? ', published on ' : ', publiée le ') +
          new Date(publication.published_at).toLocaleDateString((merizEnglish ? 'en-GB' : 'fr-FR'), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : ''
      ligne.textContent = (merizEnglish ? 'Latest release: ' : 'Dernière version : ') + publication.tag_name + date + '.'
      ligne.hidden = false
    }
  })()
})()

// Les URL de langue sont de vraies pages, lisibles aussi sans JavaScript.
for (var languageLink of document.querySelectorAll('[data-language]')) {
  languageLink.addEventListener('click', function(event) { try { localStorage.setItem('meriz-language', event.currentTarget.dataset.language) } catch {} })
}
