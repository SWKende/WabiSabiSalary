FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

RUN apk add --no-cache wget

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --spider -q http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]