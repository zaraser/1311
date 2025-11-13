# =============================
# 1) BUILDER
# =============================
FROM node:20-bullseye AS builder
WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN npm install --prefix frontend
RUN npm install --prefix backend

COPY frontend ./frontend
COPY backend ./backend

RUN npm run --prefix frontend build
RUN npm run --prefix backend build

# =============================
# 2) RUNTIME
# =============================
FROM node:20-bullseye AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8443

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/frontend/dist ./public

# ⛔ SSL НЕ копируем! Будет volume!
# COPY --from=builder /app/backend/ssl ./ssl   <-- удалить

EXPOSE 8443

CMD ["node", "dist/server.js"]
