# Project Next
Project Next is the new website for Sanctus Omega Broderskab.

## Getting started

For getting started please refer to our [Getting Started Guide](https://github.com/vevcom/projectNext/wiki/Getting_Started).

## Development

Have the docker deamon running, then run:

```bash
npm run docker:dev
```

or run

```bash
docker compose -f docker-compose.dev.yml up --build
```

#### DevContainer

To setup the development container see [this guide](https://github.com/vevcom/projectNext/wiki/Getting_Started#development-container).

If you want to have access to the container outside vscode, use the command bellow.
```bash
docker exec -it -w /workspaces/projectNext pn-dev /bin/bash
```

#### Working with the DB

To remigrate the db, just rerun the prisma container
To regenerate the client-libary from the schema file run:

```bash
npx prisma generate
```

in the projectnext container

#### Seeding

Every time the dev container starts, it applies any pending migrations and upserts the seed data, so your data survives restarts. To wipe the database and seed it from scratch, run the following command. It works whether or not the dev environment is running.

```bash
npm run docker:reseed
```

Run that same command once if your dev database predates migrations. A database left over from the old `db push --force-reset` workflow has no `_prisma_migrations` table, so the startup `migrate deploy` stops with P3005 ("the database schema is not empty") and the dev server never comes up. The reseed rebuilds it from the committed migrations, at the cost of the local data in it.

#### Reinstalling node_modules

Since we are using volumes in dev, the dev container should keep itself up to date with your working directory. But you will need to reinstall packages manually in projectnext upon changing package.json. Run:

```bash
npm ci
```

inside projectnext-container

## Production

Production runs on [Dokploy](https://dokploy.com/) as a **Docker Compose application** built from `docker-compose.prod.yml`, plus a **separate Dokploy Postgres resource** for the database.

The stack itself holds `projectnext` (the Next.js server) and `imageworker` (the background resize pipeline). The database stays outside it on purpose: as a Dokploy resource it keeps its scheduled backups and restore UI, and its data is not attached to the lifecycle of a stack you redeploy on every push. Mail stays outside it too - see [Mail](#mail).

There is no nginx. Next serves `/store/` itself (`src/app/store/[...path]/route.ts`), in dev and prod alike.

### Deploying with Dokploy

1. **Database**: create a Dokploy Postgres resource. Note its internal hostname from the resource's connection tab, and configure its backup schedule there.
2. **Stack**: create a Dokploy Docker Compose service pointed at this repository (`main`, or whichever branch tracks prod), with the compose path set to `docker-compose.prod.yml`.
3. Configure the environment variables for the stack (see `.env.default` for the full list and dev-appropriate example values - set real secrets for production). Set `POSTGRES_HOST` to the database resource's internal hostname; `DB_URI` is built from it.
4. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` as a **build argument**, not only a runtime environment variable. Next bakes it into the build during `next build` to encrypt Server Action IDs, and a runtime env var is not automatically passed to the build - so a build without it generates a fresh random key every time. Because Dokploy rebuilds the image on every deploy, that invalidates any Server Action referenced by a page a client still has open across the deploy ("Failed to find Server Action"). `docker-compose.base.yml` already passes it through under `build.args`, so setting it as a stack environment variable is enough - but it must keep the same value across deploys.
5. The `store` and `logs` volumes are declared in the compose file, so uploads and logs survive a redeploy without any extra setup. `store` is shared by `projectnext` and `imageworker` - the worker writes the resized variants and the app serves them back out.
6. In Dokploy's UI, set the domain on the `projectnext` service. Dokploy injects the Traefik labels itself. A liveness endpoint is available at `/api/health` (also used by the compose healthcheck) if Dokploy asks for one.
7. Ingress goes through a Cloudflare Tunnel app in Dokploy, which forwards to Dokploy's built-in Traefik; Traefik then routes to `projectnext`. Nothing needs host ports 80/443 opened directly.

Dokploy brings the stack up itself. To deploy by hand on a host that already has `dokploy-network` and the database resource, `npm run docker:prod-deploy` runs the same file detached and without the `localdb` profile.

**Every service joins `dokploy-network` explicitly**, and the compose file declares it `external: true`. Dokploy attaches that network automatically only to the service a domain is configured on, so without the explicit `networks:` entries `imageworker` cannot resolve the database's hostname at all - which presents as the worker failing to connect while the web app looks perfectly healthy.

Set `BUILDX_NO_DEFAULT_ATTESTATIONS=1` in the build environment. BuildKit otherwise attaches a provenance attestation and packs the result as a multi-platform manifest list, which nothing here consumes and which shows up as extra `exporting attestation manifest` work on every deploy.

### Applying database schema migrations

Schema changes go through [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate), in development as well as production. The dev database is built from the committed migrations (the dev reseed and DobbelOmega both use `prisma migrate reset`), so a schema change only reaches it through a migration.

Whenever you change a schema file under `src/prisma/schema/`, generate a migration for it locally and commit the result:

```bash
npm run docker:migrate:dev -- --name <name>
```

This runs in a one-off container, so it works whether or not the dev environment is running. It applies the migration to your dev database (checking it against a Prisma shadow database) and writes a new folder under `src/prisma/migrations/` containing the SQL. Commit that folder. If the change requires backfilling existing rows - a new required column with no single sensible default, or a restructuring that has to carry data across - edit the generated `migration.sql` by hand before committing: `migrate diff` only ever emits plain DDL and will happily generate something that fails against a populated table.

Committed migrations are applied **automatically on every deploy**. `docker-compose.prod.yml` has a one-shot `migrate` service that runs `migrate:deploy`, and `projectnext` declares `depends_on: migrate: condition: service_completed_successfully` - so the web app does not start until migrations have exited 0, and a failed migration fails the deploy instead of booting the app against a half-applied schema. `migrate:deploy` only runs migrations that have not been applied yet, never touches existing data outside of what a migration's SQL explicitly does, and is a no-op once everything is applied, so an ordinary deploy costs nothing.

The same one-shot then runs the standard seed (`seed:data`, via `migrate:deploy-and-seed`). This is not the dev reseed - it never resets anything. Every standard resource is upserted: content users can edit through the site (special CMS, news, notification channels, study programmes, ...) is only created if missing, while content they cannot edit (standard images, special image collections) is brought in line with the source code, so e.g. a changed file in `standard_store/` reaches production on the next deploy. It writes the standard images' files, so the service mounts the `store` volume, and it pins `MIGRATE_FROM_OW=false` so a value left in the stack env from an import can never rerun DobbelOmega on a deploy.

Migrations therefore run *before* the new code is serving, while the previous release may still be up. Keep each migration backward-compatible with the release before it: add columns nullable, backfill, and drop the old shape in a later release rather than in the same one.

The `migrate` service runs the `tools` image with the command overridden. A dedicated leaner stage was measured and abandoned: at 2.80 GB against `tools`' 2.81 GB it saved nothing, because the weight is all in the shared `base` layer (`npm ci` with devDependencies, both generated Prisma clients) rather than in the source tree on top. Reusing `tools` means the one-shot is the same image `imageworker` already builds, so it adds no build time at all. Note that `tools` defaults to DobbelOmega, which force-resets the database - overriding the command is what makes this safe to run on every deploy.

To run it by hand against a database - the first deploy into an empty Dokploy Postgres resource, say:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

Tracked history starts at `20260922000000_init`, which creates the whole schema from empty. It carries no history from the `db push` era: anything merged before migrations existed is simply part of that initial snapshot rather than a migration of its own. It therefore expects an **empty database** - the Dokploy Postgres resource before its first deploy, or a database about to be filled by DobbelOmega. Run it against a database that already has these tables but no migration history and `migrate deploy` stops before applying anything, with P3005 ("the database schema is not empty").

### Rehearsing the production stack locally

```bash
npm run docker:prod-local
```

This creates the `dokploy-network` network if it is missing (compose refuses to start otherwise, since the file declares it external) and enables the `localdb` profile, which adds a `db` service standing in for the Dokploy resource. Production never enables that profile.

The file also sets its own compose project name, `projectnext-prod`. Dev and prod otherwise derive the same project name from the directory, and a local rehearsal would recreate the running dev containers as prod ones - same names, different configuration. Dev and test keep the default name so no existing dev volume is orphaned.

### Mail

Mail is **not** part of this compose stack. It runs as its own Dokploy application, built from `containers/postfix/` in this repository.

It is separate because the two directions of mail need different things from the network. Outbound is handled by the app itself - it authenticates directly against `EMAIL_SERVER` (e.g. SMTP2GO) over TLS using `EMAIL_PORT`, `EMAIL_USER` and `EMAIL_PASSWORD`, see `src/lib/email/constants.ts`. Postfix plays no part in outbound mail. Inbound is what the `MailAlias` feature actually depends on: Postfix resolves every alias against the database (`virtual_alias_maps`, see `containers/postfix/pgsql-aliases.cf.tmpl`) and forwards it to the members behind it, which only works if the domain's MX can reach port 25. The stack's ingress is a Cloudflare Tunnel in front of Traefik and carries HTTP only, so a Postfix service inside it could never receive that mail - it would have quietly relayed outbound while every alias silently black-holed.

Deploying it:

1. Create a Dokploy application built from `containers/postfix/`, attached to `dokploy-network` so it can reach the database resource.
2. Give it `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (the alias lookups read the same database as the app), plus `EMAIL_HOSTNAME`, `WEBSITE_DOMAIN` and `EMAIL_RELAY_HOST`.
3. Expose port 25 on the host and point the mail domain's MX record at it.
4. Provision a certificate for the mail domain and turn `smtpd_use_tls` back on in `containers/postfix/main.cf.tmpl`. It is `no` there because the old certbot flow lived in the nginx container that this setup removed, and pointing Postfix at cert files that don't exist stops it from starting. Inbound SMTP on a published port should not stay plaintext.

`EMAIL_SERVER` on the stack is unrelated to this Postfix deployment - it points the app at its own outbound provider (e.g. SMTP2GO), configured with `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` and `EMAIL_SECURE`.

### Running DobbelOmega

To load data from Omegaweb-basic, run the `tools` service. **This is a one-time bulk import, not a routine deploy step: it force-resets the database, deleting everything currently in it.** For ordinary schema changes once the site has real data, the `migrate` service above already handles it.

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm tools
```

`tools` sits behind a profile so it never starts with the stack - it is a one-shot job, not a service. It is a separate image because the deployed web application no longer contains the toolchain: the `prod` stage ships only the modules the Next.js server actually imports (via `output: 'standalone'`), which takes it from 2.8 GB to under 500 MB - the difference between a ~6 minute rollout and about one. The seeder and DobbelOmega import the whole service layer, so they need the full dependency tree; keeping that in the deployed image would have put the 2.3 GB straight back.

`tools` builds on the same cached layers as a normal deploy, so it is quick to produce on a host that has built the app before. It reads the same environment variables as the rest of the stack - point `POSTGRES_HOST` at the database you actually mean to overwrite.

The reset goes through `prisma migrate reset`, not `prisma db push --force-reset`. `db push` leaves behind a populated schema with no `_prisma_migrations` table, and the `migrate` service then fails on the next deploy (P3005, "the database schema is not empty") - which takes the whole stack with it, since every service waits for that one-shot to exit 0. `migrate reset` reapplies the committed migrations and records them, so an import leaves the database in a state ordinary deploys can carry forward.

## Lint

To lint the project (TS/JS) run

```bash
npm run lint
```

To auto-fix linting errors run

```bash
npm run lint:fix
```

To lint style files (CSS/SCSS) run

```bash
npm run lint:style
```

To auto-fix style linting errors run

```bash
npm run lint:style -- --fix
```

## Migration from omegaweb basic

To migrate the data from omegaweb-basic, run the following command inside the projectnext container.

```bash
npm run dobbelOmega:run
```

If you are connected to our test database on openStack, make sure to be on the ntnu network to be able to connect.

## Testing

To run the tests run
```bash
npm run docker:test
```

The tests can also be run outside of docker using
```bash
npm run test
```
but this requires starting a database manually.
