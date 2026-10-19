/*
 * Les boutons de téléchargement, pointés sur la dernière version.
 *
 * Les fichiers publiés portent leur numéro de version dans leur nom, par
 * exemple Meriz_0.1.0_x64-setup.exe. Les écrire dans la page les rendrait
 * faux à la publication suivante. On lit donc la dernière version au
 * chargement, et on reconnaît chaque fichier à un motif.
 *
 * Sans ce script, et s'il échoue, les boutons mènent à la page des
 * versions : personne ne reste sans solution.
 */
;(function () {
  var SOURCE = 'https://api.github.com/repos/Yassine-Daif/meriz/releases/latest'
  var DELAI_MAX = 6000

  /* Le motif qui reconnaît le fichier de chaque bouton. Les archives
     .app.tar.gz sont des artefacts de mise à jour de Tauri : jamais
     proposées à quelqu'un qui vient installer le logiciel. */
  var MOTIFS = {
    'windows-exe': /-setup\.exe$/i,
    'windows-msi': /\.msi$/i,
    'macos-arm': /aarch64\.dmg$/i,
    'macos-intel': /x64\.dmg$/i,
    'linux-appimage': /\.AppImage$/i,
    'linux-deb': /\.deb$/i,
    'linux-rpm': /\.rpm$/i,
  }

  /** Le poids d'un fichier, en mégaoctets, à la française. */
  function poids(octets) {
    return (octets / 1048576).toFixed(1).replace('.', ',') + ' Mo'
  }

  /**
   * Le système du visiteur, ou null si on ne sait pas.
   *
   * On ne distingue pas un Mac Apple Silicon d'un Mac Intel : aucun
   * navigateur ne le dit de façon fiable, et se tromper enverrait vers
   * un fichier qui ne s'ouvre pas. Les deux restent donc proposés.
   */
  function systeme() {
    // userAgentData n'existe pas partout, et certains navigateurs le
    // renvoient vide : on retombe alors sur la chaîne d'agent.
    var marque = navigator.userAgentData?.platform || navigator.userAgent || ''
    if (/win/i.test(marque)) return 'windows'
    if (/mac|darwin/i.test(marque)) return 'macos'
    if (/linux|x11|ubuntu|fedora|debian/i.test(marque) && !/android/i.test(marque)) return 'linux'
    return null
  }

  function metEnAvant() {
    var vu = systeme()
    if (vu === null) return
    var bloc = document.querySelector('[data-systeme="' + vu + '"]')
    if (!bloc) return
    bloc.classList.add('recommande')
    var etiquette = bloc.querySelector('[data-detecte]')
    if (etiquette) {
      etiquette.hidden = false
    }
    // Les trois systèmes sont en onglets : plutôt que de changer leur
    // ordre, on ouvre celui du visiteur. Sans le script des onglets,
    // les trois restent visibles et il n'y a rien à ouvrir.
    var panneau = bloc.closest('[data-panneau]')
    if (!panneau) return
    var onglet = document.querySelector('[data-onglet="' + panneau.dataset.panneau + '"]')
    if (onglet && onglet.getAttribute('role') === 'tab') onglet.click()
  }

  async function dernierePublication() {
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
      // Réseau coupé, quota de l'API atteint, délai dépassé : le repli
      // de la page reste en place, et il mène quelque part.
      return null
    } finally {
      clearTimeout(minuteur)
    }
  }

  async function brancher() {
    metEnAvant()

    var publication = await dernierePublication()
    if (!publication || !Array.isArray(publication.assets)) return

    var place = 0
    for (var bouton of document.querySelectorAll('[data-fichier]')) {
      var motif = MOTIFS[bouton.dataset.fichier]
      if (!motif) continue
      var fichier = publication.assets.find(function (asset) {
        return motif.test(asset.name)
      })
      if (!fichier) continue

      bouton.href = fichier.browser_download_url
      bouton.setAttribute('download', '')
      bouton.removeAttribute('rel')
      var detail = bouton.parentElement?.querySelector('[data-poids]')
      if (detail) {
        detail.textContent = poids(fichier.size)
      }
      place += 1
    }

    if (place === 0 || typeof publication.tag_name !== 'string') return

    var date = publication.published_at
      ? ', publiée le ' +
        new Date(publication.published_at).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : ''

    // Le numéro paraît à trois endroits : le badge de la barre, la
    // carte de téléchargement et le pied de page.
    var badge = document.querySelector('[data-version-courte]')
    if (badge) badge.textContent = publication.tag_name

    var carte = document.querySelector('[data-version-carte]')
    if (carte) {
      carte.textContent = publication.tag_name + date
      carte.hidden = false
    }

    var version = document.querySelector('[data-version]')
    if (version) {
      version.textContent = 'Dernière version : ' + publication.tag_name + date + '.'
      version.hidden = false
    }
  }

  void brancher()
})()
