# Déploiement automatique de la version web

Ce guide met en place le déploiement automatique. Une fois terminé, chaque push sur `main` met à jour le site tout seul. Plus de `git pull` sur le serveur.

## Principe

1. Vous poussez sur `main`.
2. GitHub Actions lance le workflow [deploy-web.yml](../.github/workflows/deploy-web.yml). Il installe les dépendances, lance les tests et construit l'application.
3. Le workflow se connecte au VPS en SSH avec une clé dédiée, puis envoie les fichiers avec rsync :
   - `dist/` va dans `<dossier servi>/app/`. Les anciens fichiers de l'application sont supprimés.
   - `site/` va dans `<dossier servi>/`. Rien n'est supprimé à la racine.

Le clone du dépôt sur le serveur ne sert plus au déploiement. Vous pouvez le garder ou le supprimer.

Trois parties sont à faire à la main, une seule fois : créer la clé, l'autoriser sur le VPS, créer les secrets GitHub.

Faites-les **avant** de pousser le nouveau workflow, ou relancez-le ensuite. Sans les secrets, le workflow s'arrête dès sa première étape et nomme les secrets manquants.

## 1. Créer une clé SSH de déploiement

Cette clé sert uniquement à GitHub. N'utilisez pas votre clé personnelle : une clé dédiée se révoque sans rien casser d'autre.

Sur votre ordinateur, dans PowerShell :

```powershell
ssh-keygen -t ed25519 -C "github-deploy-meriz" -f "$env:USERPROFILE\.ssh\meriz_deploy"
```

Sous macOS ou Linux :

```bash
ssh-keygen -t ed25519 -C "github-deploy-meriz" -f ~/.ssh/meriz_deploy
```

Quand la commande demande une phrase de passe, appuyez deux fois sur Entrée sans rien taper. GitHub ne peut pas saisir de phrase de passe.

Vous obtenez deux fichiers :

- `meriz_deploy` : la **clé privée**. Elle ira dans un secret GitHub, et nulle part ailleurs. Ne la commitez jamais.
- `meriz_deploy.pub` : la **clé publique**. Elle ira sur le VPS.

## 2. Préparer le VPS

Connectez-vous au VPS comme d'habitude, puis relevez trois informations.

**Le compte SSH.** Il deviendra `VPS_USER`.

```bash
whoami
```

**Le dossier servi par Apache.** Il deviendra `VPS_PATH`. Notez-le sans barre finale, par exemple `/var/www/meriz`.

```bash
grep -i DocumentRoot /etc/apache2/sites-enabled/*meriz*
```

**Le port SSH.** Si la commande n'affiche rien, le port est 22.

```bash
grep -i '^Port' /etc/ssh/sshd_config
```

Vérifiez ensuite que rsync est installé :

```bash
rsync --version || sudo apt install -y rsync
```

### Autoriser la clé

Depuis votre ordinateur, dans PowerShell. Remplacez `<VPS_USER>` et `<VPS_HOST>` par vos valeurs. `<VPS_HOST>` est l'adresse que vous utilisez déjà pour vous connecter en SSH.

```powershell
Get-Content "$env:USERPROFILE\.ssh\meriz_deploy.pub" | ssh <VPS_USER>@<VPS_HOST> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Vous pouvez aussi le faire à la main sur le VPS : ouvrez `~/.ssh/authorized_keys` et collez le contenu de `meriz_deploy.pub` sur une nouvelle ligne.

### Donner le dossier servi au compte de déploiement

rsync écrit avec le compte SSH. Ce compte doit donc posséder le dossier servi. Sur le VPS, remplacez `<VPS_PATH>` par le chemin relevé plus haut :

```bash
sudo chown -R "$(whoami)":www-data <VPS_PATH>
sudo chmod -R u+rwX,g+rX,o+rX <VPS_PATH>
test -w <VPS_PATH> && echo "OK, dossier accessible en écriture"
```

## 3. Tester la clé avant de toucher à GitHub

Depuis votre ordinateur, dans PowerShell. Ajoutez `-p <port>` si le port n'est pas 22.

```powershell
ssh -i "$env:USERPROFILE\.ssh\meriz_deploy" <VPS_USER>@<VPS_HOST> "test -w <VPS_PATH> && echo OK"
```

La commande doit afficher `OK` sans demander de mot de passe. Si elle échoue ici, elle échouera aussi sur GitHub : corrigez d'abord (voir Dépannage).

## 4. Relever l'empreinte du serveur

Le workflow refuse de se connecter à un serveur qu'il ne reconnaît pas. Il lui faut l'empreinte du VPS.

Sur votre ordinateur. Ajoutez `-p <port>` si le port n'est pas 22.

```powershell
ssh-keyscan <VPS_HOST>
```

Gardez toutes les lignes affichées : elles forment la valeur de `VPS_KNOWN_HOSTS`.

Pour vérifier que ces lignes viennent bien de votre serveur, lancez cette commande sur le VPS :

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Puis, sur votre ordinateur, lancez `ssh-keyscan <VPS_HOST> | ssh-keygen -lf -`. L'empreinte `SHA256:...` de la ligne `ED25519` doit être identique des deux côtés.

## 5. Créer les secrets GitHub

Sur GitHub, ouvrez le dépôt, puis **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Créez un secret par ligne. Le nom doit être exactement celui du tableau.

| Nom exact | Contenu | D'où vient la valeur |
|---|---|---|
| `VPS_HOST` | Adresse du serveur, sans `https://` ni utilisateur | Celle de votre connexion SSH habituelle |
| `VPS_USER` | Nom du compte SSH | `whoami` sur le VPS |
| `VPS_PATH` | Dossier servi, sans barre finale | `DocumentRoot` du VirtualHost |
| `VPS_SSH_KEY` | Contenu **entier** du fichier `meriz_deploy`, lignes `BEGIN` et `END` comprises | Clé privée de l'étape 1 |
| `VPS_KNOWN_HOSTS` | Toutes les lignes de `ssh-keyscan` | Étape 4 |
| `VPS_PORT` | Port SSH. Facultatif, ne le créez que s'il n'est pas 22 | `sshd_config` |

Avec l'outil `gh`, dans PowerShell :

```powershell
Get-Content "$env:USERPROFILE\.ssh\meriz_deploy" -Raw | gh secret set VPS_SSH_KEY
ssh-keyscan <VPS_HOST> | gh secret set VPS_KNOWN_HOSTS
gh secret set VPS_HOST --body "<VPS_HOST>"
gh secret set VPS_USER --body "<VPS_USER>"
gh secret set VPS_PATH --body "<VPS_PATH>"
gh secret list
```

## 6. Vérifier que le déploiement marche

### Lancer un déploiement

Choisissez l'une des deux méthodes.

- **Relance manuelle.** Sur GitHub, onglet **Actions**, workflow **Deploy web**, bouton **Run workflow** sur `main`.
- **Petit push de test.** Une modification sans effet sur le site suffit :

```powershell
git commit --allow-empty -m "Test du déploiement automatique"
git push
```

### Suivre le déploiement

Dans l'onglet **Actions**, ou avec `gh run watch`. Les étapes doivent passer au vert dans cet ordre : Vérifier les secrets, Installer les dépendances, Tester, Construire, Préparer la connexion SSH, Envoyer l'application, Envoyer la vitrine.

### Contrôler le site en ligne

Remplacez `<domaine>` par le domaine du site :

```powershell
curl.exe -sI https://<domaine>/app/
curl.exe -s https://<domaine>/app/ | Select-String -Pattern 'assets/index-[^"]*\.js' | ForEach-Object { $_.Matches.Value }
```

La première commande doit répondre `HTTP/1.1 200`. La seconde affiche le nom du fichier JavaScript en ligne. Il doit être identique à celui qu'affiche l'étape **Construire** du run, par exemple `dist/assets/index-tia1Pmc2.js`. S'ils correspondent, le site est à jour. Pensez à recharger la page du navigateur sans cache (Ctrl+F5).

## Dépannage

| Message dans le run | Cause probable | Correction |
|---|---|---|
| `Secret manquant : VPS_...` | Secret absent ou mal nommé | Vérifier le nom exact dans Settings, Secrets |
| `Permission denied (publickey)` | Clé publique absente de `authorized_keys`, ou clé privée incomplète dans le secret | Refaire l'étape « Autoriser la clé ». Recoller la clé privée entière |
| `Load key ... invalid format` ou `error in libcrypto` | Clé privée tronquée dans le secret | Recoller le fichier entier, `BEGIN` et `END` compris |
| `Host key verification failed` | `VPS_KNOWN_HOSTS` vide, faux, ou relevé sur un autre port | Refaire l'étape 4, avec `-p` si le port n'est pas 22 |
| `Connexion SSH refusée ou dossier ... non accessible en écriture` | Mauvais `VPS_PATH`, ou dossier appartenant à un autre compte | Vérifier le chemin, refaire le `chown` |
| `rsync: command not found` | rsync absent du VPS | `sudo apt install -y rsync` |
| `Tester` ou `Construire` en échec | Le code poussé casse les tests ou le build | Rien n'est envoyé : corriger, puis pousser à nouveau |

## Sécurité

- La clé de déploiement ne sert qu'à GitHub. Pour la révoquer, supprimez sa ligne `github-deploy-meriz` dans `~/.ssh/authorized_keys` sur le VPS.
- GitHub masque les secrets dans les journaux. Le workflow ne les affiche jamais.
- En cas de doute (fuite, départ d'un collaborateur), générez une nouvelle clé, remplacez la ligne sur le VPS et le secret `VPS_SSH_KEY`.
