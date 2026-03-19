# Multi-stage build for remarkable-templates

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend and server
RUN pnpm build

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server source (tsx runs TypeScript directly at runtime)
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/types ./src/types

# Create data directory
RUN mkdir -p /data/public/templates/custom /data/public/templates/methods \
    /data/public/templates/debug /data/public/templates/samples \
    /data/rm-methods-dist /data/rm-methods-backups /data/data/ssh

# Copy debug templates into the data directory (where the server expects them)
COPY --from=builder /app/public/templates/debug /data/public/templates/debug

# Copy sample templates into the data directory
COPY --from=builder /app/public/templates/samples /data/public/templates/samples

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000

# Install tsx for runtime TypeScript execution
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm add -g tsx

CMD ["tsx", "server/index.ts"]
