FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate && pnpm install --frozen-lockfile

FROM base AS builder
# NEXT_PUBLIC_* is inlined by the Next.js compiler, so it has to be present while
# the build runs. An empty value keeps the API calls on the same origin.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
# Origin of the user-profile microfrontend: its mf-manifest.json and chunks are
# fetched from there by the Module Federation runtime at run time.
ARG NEXT_PUBLIC_PROFILE_BASE_URL=https://user-kit.profile.local
ENV NEXT_PUBLIC_PROFILE_BASE_URL=$NEXT_PUBLIC_PROFILE_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate && pnpm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
