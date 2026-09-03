FROM node:18-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 8080

# NOTE: fly.toml's [processes] block overrides this CMD, so the migrate step
# here never ran on Fly. Migrations are now fly.toml's release_command. This
# CMD is kept for plain `docker run` (local, CI), where it IS the entrypoint.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
