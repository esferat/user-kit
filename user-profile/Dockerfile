FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
# `prepare` starts `rs hooks`, a git hook installer: inside the image there is no
# repository (.git is not copied), so it exits with 1 and fails the build. The
# script is dropped before the install; the install scripts of the dependencies
# still run, @swc/core needs its postinstall.
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate \
    && pnpm pkg delete scripts.prepare \
    && pnpm install --frozen-lockfile

FROM base AS builder
# PROFILE_ASSET_PREFIX is inlined into mf-manifest.json as the publicPath of the
# remote, so it has to be present while the build runs. The default matches the
# domain the edge nginx publishes this service under.
ARG PROFILE_ASSET_PREFIX=https://user-kit.profile.local
ENV PROFILE_ASSET_PREFIX=$PROFILE_ASSET_PREFIX
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate && pnpm run deploy

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 -G nodejs modernjs
# Directory for LOG_FILE. The frontend-logs volume is mounted here, and an empty
# named volume is initialised from the image, so the owner has to be set before
# the container starts as the unprivileged user below.
RUN mkdir -p /var/log/user-kit && chown modernjs:nodejs /var/log/user-kit
# `modern deploy` bundles the runnable server with its dependencies.
COPY --from=builder --chown=modernjs:nodejs /app/.output ./.output
USER modernjs
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0
CMD ["node", ".output/index"]
