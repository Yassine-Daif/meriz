# Versions du web et du logiciel

Une modification de l'application poussée sur main déclenche le workflow Release.
Il teste le code, aligne les versions npm et Rust, puis construit Windows,
macOS Intel, macOS Apple Silicon et Linux. La release reste en brouillon
tant que les quatre plateformes et leurs signatures ne sont pas prêtes.
Le même commit est ensuite déployé sur app.meriz.fr.

Si le numéro choisi dans package.json existe déjà comme tag, le workflow
incrémente automatiquement le correctif. Pour une nouvelle fonction,
choisir explicitement une version mineure avant de pousser.
Le script scripts/release-version.mjs modifie les cinq fichiers ensemble.

## Logiciels déjà installés

Les versions 1.0.x doivent télécharger et installer 1.1.0 une première fois.
À partir de 1.1.0, Meriz vérifie les mises à jour au démarrage, puis installe
les paquets signés avant d'ouvrir l'application. Il ne redémarre donc pas
pendant une édition. Hors ligne, la version installée reste utilisable.

La signature des mises à jour Tauri ne remplace pas la signature de
l'éditeur Windows ou la notarisation macOS.

## Secrets de publication

Les clés privées restent hors du dépôt. La clé publique de vérification
est dans src-tauri/tauri.conf.json.

GitHub Actions utilise :
- TAURI_SIGNING_PRIVATE_KEY et TAURI_SIGNING_PRIVATE_KEY_PASSWORD ;
- VPS_HOST, VPS_USER, VPS_SSH_KEY et VPS_KNOWN_HOSTS.

Sur le poste de préparation, la clé de signature est sauvegardée sous
~/.tauri/meriz-updater.key, avec son mot de passe dans le même dossier.
Il faut en conserver une sauvegarde privée : perdre cette clé empêcherait
les logiciels installés d'accepter les mises à jour suivantes.

La clé SSH de GitHub est dédiée à Meriz. Dans authorized_keys, elle est
restreinte au réceptionnaire /usr/local/sbin/meriz-deploy-release.
Elle ne permet pas d'ouvrir un shell. Le réceptionnaire n'accepte que
les deux sites statiques, garde les anciens chunks utiles aux fenêtres
ouvertes et réalise les échanges de dossiers avec sauvegarde.

Une modification de site/ uniquement déploie la vitrine sans reconstruire
les logiciels. Le lancement manuel de Deploy web doit rester réservé
à une reprise de déploiement, avec le tag déjà publié comme référence.
