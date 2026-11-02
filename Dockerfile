# VS Burger e Gelato – sistema de gestão (PDV, delivery e cardápio digital)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    LOJA=vs-burger \
    PORT=3000 \
    DB_PATH=/data/vs-burger.db \
    UPLOAD_DIR=/data/uploads
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY lojas ./lojas
COPY --from=build /app/dist ./dist
# banco de dados e fotos enviadas ficam no volume /data (não perca este volume!)
VOLUME /data
EXPOSE 3000
CMD ["node", "--no-warnings=ExperimentalWarning", "server/index.js"]
