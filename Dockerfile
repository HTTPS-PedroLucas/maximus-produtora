# Imagem única: a API serve também a interface já compilada.
# Node 24 — o módulo nativo node:sqlite funciona sem flags.

FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci
COPY frontend/ frontend/
RUN npm --prefix frontend run build

FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    SERVE_FRONTEND=1 \
    PORT=4100 \
    DATA_DIR=/data/db \
    UPLOADS_DIR=/data/uploads

COPY backend/package.json backend/package-lock.json backend/
RUN npm --prefix backend ci --omit=dev

COPY backend/src backend/src
COPY --from=build /app/frontend/dist frontend/dist

# O banco e as imagens ficam fora da imagem, em disco persistente.
RUN mkdir -p /data/db /data/uploads
VOLUME ["/data"]

EXPOSE 4100
CMD ["node", "backend/src/server.js"]
