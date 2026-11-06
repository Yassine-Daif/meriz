# Image Docker de Meriz, version web.
# Étape 1 : Node construit l'application statique.
# Étape 2 : nginx la sert, sans droits root.
# Les adresses du serveur Meriz API et du direct Reverb ne sont pas figées
# au build. Le build porte des marqueurs, remplacés au démarrage du
# conteneur par les variables MERIZ_* (voir docker/40-meriz-config.sh).

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN VITE_API_URL=__MERIZ_API_URL__ \
    VITE_REVERB_APP_KEY=__MERIZ_REVERB_APP_KEY__ \
    VITE_REVERB_HOST=__MERIZ_REVERB_HOST__ \
    VITE_REVERB_PORT=__MERIZ_REVERB_PORT__ \
    VITE_REVERB_SCHEME=__MERIZ_REVERB_SCHEME__ \
    npm run build \
 && grep -q '__MERIZ_API_URL__' dist/assets/index-*.js

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="Meriz" \
      org.opencontainers.image.description="Modélisation de bases de données par la méthode Merise, dans le navigateur." \
      org.opencontainers.image.licenses="AGPL-3.0-only"

# Le build d'origine reste intact dans /opt/meriz. Chaque démarrage le
# recopie dans le dossier servi puis y écrit la configuration : un
# redémarrage avec d'autres variables prend donc effet.
COPY --from=build /app/dist /opt/meriz/dist
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-meriz-config.sh /docker-entrypoint.d/40-meriz-config.sh

USER root
RUN rm -rf /usr/share/nginx/html/* \
 && chown -R nginx:nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
