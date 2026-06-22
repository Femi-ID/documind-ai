# Stage 1: Builder
# Installs all dependencies (including dev deps) and builds the app
FROM node:20-alpine AS builder
 
RUN corepack enable && corepack prepare pnpm@9 --activate
 
WORKDIR /app
 
# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./
 
# Prisma 7 needs prisma.config.ts and schema during install/generate
COPY prisma ./prisma
COPY prisma.config.ts ./
 
RUN pnpm install --frozen-lockfile
 
# Copy the rest of the source code
COPY . .
 
# Generate Prisma client
RUN pnpm exec prisma generate
 
# Build the NestJS app
RUN pnpm build
 
# Prune dev dependencies
RUN pnpm prune --prod
 
 
# Stage 2: Runner
FROM node:20-alpine AS runner
 
RUN corepack enable && corepack prepare pnpm@9 --activate
 
# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
 
WORKDIR /app
 
# Copy from builder — note: prisma.config.ts is NOW included
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts
 
USER nestjs
 
ENV PORT=10000
EXPOSE 10000
 
# Use the LOCAL prisma binary (already in node_modules from install).
# No more npx — avoids the runtime download you saw in the logs.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
 