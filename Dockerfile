ARG NODE_VERSION="24.12"
ARG ALPINE_VERSION="3.23"

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base
WORKDIR /usr/src/app

# Expose Next.js port
EXPOSE 3000

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Install node packages
COPY package*.json ./
RUN npm ci

# Generate prisma client
RUN mkdir -p src/prisma
COPY src/prisma/schema src/prisma/schema
COPY prisma.config.ts .
RUN npx prisma generate

COPY src/prisma/owSchema src/prisma/owSchema
RUN npm run dobbelOmega:generate

RUN mkdir -p store/images

# Copy remaining files except src
# (src is binded in dev so there is no need to copy it here)
COPY public public
COPY next-env.d.t[s] next.config.ts tsconfig.json ./

COPY standard_store standard_store

############################################################
FROM base AS test

ENV NODE_ENV=test

COPY jest.config.ts ./
# src and tests are expected to be binded in test

CMD ["npm", "run", "test"]
############################################################
FROM base AS dev

ENV NODE_ENV=development
# src is expected to be binded in dev

CMD ["npm", "run", "dev-seed"]
############################################################
# Builds the app. Nothing from this stage ships as-is: prod copies only the
# traced output out of it, which is what keeps the runtime image small.
FROM base AS builder

ENV NODE_ENV=production

ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}

ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}

COPY src src

RUN npm run build

RUN rm -rf .next/standalone/standard_store standard_store/dev_profile_images

############################################################
# The migration/seed toolchain: DobbelOmega and the seeder pull in the whole
# service layer, so they need the full dependency tree and cannot run against
# prod's traced subset. This is a separate image rather than extra weight in
# prod. Also the image the migrate one-shot runs, with the command overridden - see
# "Applying database schema migrations" and "Running DobbelOmega" in README.md.
FROM base AS tools

ENV NODE_ENV=production

COPY src src

CMD ["npm", "run", "dobbelOmega:run"]

############################################################
# prod is deliberately the last stage: a plain `docker build` with no
# --target/build-stage specified (e.g. some PaaS "Dockerfile" build modes)
# defaults to the last stage in the file - that should be the one that
# actually builds and serves the app, not dev (which expects src/ to be
# bind-mounted, not copied in) or test.
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS prod
WORKDIR /usr/src/app

EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# standalone's server.js binds to $HOSTNAME, which Docker sets to the container id -
# that listens on the container IP only, so the localhost healthcheck below (and
# Dokploy's) would never connect. Bind all interfaces instead.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The Next.js server: standalone/ already carries the subset of node_modules the
# server actually imports, plus its own minimal package.json and server.js.
COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static
COPY --from=builder /usr/src/app/public ./public

# Assets read from disk at runtime by lib/standardStore. dev_profile_images is
# only ever touched by the development seeder, and is 78 MB, so it stays out.
COPY --from=builder /usr/src/app/standard_store ./standard_store

# Bind mount targets in compose; created here so the image works without them too.
RUN mkdir -p store/images logs dobbelOmegaManifest

# 127.0.0.1, not localhost: alpine resolves localhost to ::1 first and the server
# listens on IPv4 only, so the v6 attempt is refused before v4 is ever tried.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
    CMD wget --spider -q http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
