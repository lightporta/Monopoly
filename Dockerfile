FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY monopoly/package.json ./monopoly/package.json
COPY server/package.json ./server/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
COPY monopoly/package.json ./monopoly/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/monopoly/dist ./monopoly/dist
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.js"]
