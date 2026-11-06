# Héberger Meriz avec Docker

La version web de Meriz est une application statique. Une image Docker la sert avec nginx, sans droits root. Aucune base de données n'est nécessaire : sans serveur de comptes, les documents restent dans le navigateur de chaque utilisateur.

## Démarrage rapide

```sh
cp .env.docker.example .env
docker compose up -d --build
```

Ouvrez ensuite http://localhost:8080.

Pour vérifier l'état du conteneur :

```sh
docker compose ps
docker compose logs meriz
```

## Réglages

Les réglages vivent dans `.env`, à côté de `compose.yaml`. Ils sont lus au démarrage du conteneur, pas au build. Changez une valeur puis relancez :

```sh
docker compose up -d
```

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `MERIZ_PORT` | Port publié sur l'hôte | `8080` |
| `MERIZ_BIND` | Adresse d'écoute sur l'hôte | `0.0.0.0` |
| `MERIZ_IMAGE` | Nom de l'image construite | `meriz:latest` |
| `MERIZ_API_URL` | Origine du serveur Meriz API, sans `/api` | vide |
| `MERIZ_REVERB_APP_KEY` | Clé publique Reverb | vide |
| `MERIZ_REVERB_HOST` | Hôte du direct | vide |
| `MERIZ_REVERB_PORT` | Port du direct | vide |
| `MERIZ_REVERB_SCHEME` | `http` ou `https` | vide |

`MERIZ_API_URL` vide : les comptes sont désactivés. Réglages Reverb vides : l'observation garde son rafraîchissement régulier.

Ces valeurs arrivent dans le navigateur. N'y mettez jamais de secret, comme `REVERB_APP_SECRET`.

Le conteneur refuse de démarrer si une valeur contient `` ` ``, `$`, `\`, `|`, `&`, un guillemet ou un saut de ligne. Une adresse ou une clé normale n'en contient pas.

## Fonctionnement

1. Le build Node construit l'application avec des marqueurs à la place des adresses, par exemple `__MERIZ_API_URL__`.
2. Au démarrage, `docker/40-meriz-config.sh` recopie ce build dans le dossier servi et remplace les marqueurs par les variables `MERIZ_*`.
3. nginx sert le résultat sur le port 8080 du conteneur, avec le repli SPA et le cache de `deploy/nginx-meriz.conf`.

Une même image sert donc plusieurs installations. Seules les variables changent.

L'adresse `/healthz` répond `ok`. Docker s'en sert pour son contrôle de santé.

## HTTPS

Le conteneur parle en HTTP. Placez un proxy inverse devant lui pour le HTTPS : Caddy, Traefik ou nginx sur l'hôte.

Avec un proxy sur la même machine, publiez le port en local seulement :

```sh
MERIZ_BIND=127.0.0.1
```

Exemple avec Caddy, qui obtient le certificat tout seul :

```
meriz.exemple.fr {
    reverse_proxy 127.0.0.1:8080
}
```

## Serveur de comptes

Les comptes, les classes et le direct passent par [Meriz API](https://github.com/Yassine-Daif/meriz-api), un serveur Laravel dans un dépôt séparé. Il n'est pas inclus dans cette image. Hébergez-le à part, puis renseignez `MERIZ_API_URL` et les variables Reverb.

Côté serveur, ajoutez l'adresse publique de Meriz à `FRONTEND_URL` et à `CORS_ALLOWED_ORIGINS`. Sinon le navigateur bloque les appels.

## Sans compose

```sh
docker build -t meriz .
docker run -d --name meriz -p 8080:8080 \
  -e MERIZ_API_URL=https://api.meriz.exemple.fr \
  meriz
```
