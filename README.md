# Omegaweb Next
Omegaweb Next is the website for Sanctus Omega Broderskab.

## Getting started

For getting started please refer to our [Getting Started Guide](https://github.com/vevcom/omegaweb-next/wiki/Getting_Started).

## Development

Copy `sites.example.json` to `sites.json`, which maps the development hosts to the sites and is mounted into the stack; the app does not start without it. Omega's site answers at http://omegaweb.localhost:3000, a name every browser resolves to your machine, and http://localhost:3000 sends you there. Signing in happens on http://auth.localhost:3000, the auth domain, which every site sends you to and back from, see [Signing in](#signing-in). Have the docker deamon running, then run:

```bash
npm run docker:dev
```

or run

```bash
docker compose --env-file .env --env-file deploy/base/postgres.env -f docker-compose.dev.yml up --build
```

The second env file names the Postgres version, shared with the production manifests in `deploy/`. The npm scripts pass it for you.

#### Mail

By default the app sends mail through Ethereal and logs a preview url for every mail instead. To run the real mail server, the one production runs, start the stack with it:

```bash
npm run docker:dev -- --mail
```

It comes from the [mail-infrastructure](https://github.com/vevcom/mail-infrastructure) repo, which is the `mail-infrastructure/` submodule that `--mail` checks out, so the mail server in development is the one production runs. Without `--mail` nothing depends on the submodule. Then set `EMAIL_SERVER=stalwart` and `EMAIL_ADMIN_URL=http://stalwart:8080` in `.env`; the other mail values in `.env.default` already match. The app sends through the server's listener for it, with no login. Stalwart opens that listener when it starts, so after the first start with `--mail` on a fresh volume, restart the `stalwart` container once, or sending is refused. The app also keeps a mailing list per alias on the server, so a mail to an alias reaches the members behind it: in [Mailpit](http://localhost:8025) for an external address, in a mailbox for a local one, and in the alias's own mailbox, which the [webmail](http://mail.omegaweb.localhost:8081) shows to everyone who receives the alias's mail once they sign in there with their account here, see [Mailboxes](#mailboxes). `EMAIL_WEBMAIL_URL` in `.env.default` already names that webmail. The addresses and credentials are in `mail-infrastructure/dev/README.md`. Production refuses to start on the development values of `EMAIL_PASSWORD` and `EMAIL_ADMIN_PASSWORD`, as it does on the other development secrets. The version of the mail server is the submodule's commit, which is bumped like any dependency.

#### Chat

The chat is a Matrix homeserver that signs its users in through this app. To run it, start the stack with it:

```bash
npm run docker:dev -- --chat
```

It comes from the [chat-infrastructure](https://github.com/vevcom/chat-infrastructure) repo, which is the `chat-infrastructure/` submodule that `--chat` checks out. Without `--chat` nothing depends on the submodule. Open the client at http://chat.localhost:8090 and sign in: it sends you to this app's login on the auth domain, and back as `@<username>:chat.localhost`. The first time, the chat's sign in shows the Matrix id and the name you get there, and asks you to confirm. `CHAT_AUTH_URL` in `.env.default` already names that sign in. The addresses are in `chat-infrastructure/dev/README.md`. The version of the chat is the submodule's commit, which is bumped like any dependency.

#### DevContainer

To setup the development container see [this guide](https://github.com/vevcom/omegaweb-next/wiki/Getting_Started#development-container).

If you want to have access to the container outside vscode, use the command bellow.
```bash
docker exec -it -w /workspaces/omegaweb-next pn-dev /bin/bash
```

#### Working with the DB

The database runs the Postgres version in `deploy/base/postgres.env`. A development database made on an older major version does not open on a newer one, so after a bump, reset it once with `docker compose --env-file .env --env-file deploy/base/postgres.env -f docker-compose.dev.yml down -v` and start as usual.

To remigrate the db, just rerun the prisma container
To regenerate the client-libary from the schema file run:

```bash
npx prisma generate
```

in the omegaweb-next container

#### Seeding

Every time the dev container starts, it applies any pending migrations and upserts the seed data, so your data survives restarts. To wipe the database and seed it from scratch, run the following command. It works whether or not the dev environment is running.

```bash
npm run docker:reseed
```

Run that same command once if your dev database predates migrations. A database left over from the old `db push --force-reset` workflow has no `_prisma_migrations` table, so the startup `migrate deploy` stops with P3005 ("the database schema is not empty") and the dev server never comes up. The reseed rebuilds it from the committed migrations, at the cost of the local data in it.

#### Reinstalling node_modules

Since we are using volumes in dev, the dev container should keep itself up to date with your working directory. But you will need to reinstall packages manually in omegaweb-next upon changing package.json. Run:

```bash
npm ci
```

inside the omegaweb-next container

## Production

Production runs on the k3s cluster, deployed by Argo CD from [vivat](https://github.com/vevcom/vivat). This repo holds the generic shape of an installation in `deploy/`, see [deploy/README.md](deploy/README.md): the app, the worker, the migrate job and the database, with nothing about where it runs. Our domains, certificate, buckets, backups and the release that runs are vivat's business. Publishing a GitHub release builds the images and opens the pull request there that deploys it.

There is no nginx. Next serves `/store/` itself (`src/app/(omegaweb)/store/[...path]/route.ts`), in dev and prod alike.

### Signing in

One domain signs users in: the one `sites.json` marks `"auth": true`, such as `login.omega.ntnu.no`, or Omega's main domain when the file marks none. The app is an OpenID Connect provider on that domain (`src/services/auth/oidc/`, discovery at `/.well-known/openid-configuration`), and every domain of every site is a client of it (`src/auth/sso/`, `src/app/api/sso/`). A site's "Logg inn" goes to its own start route, which sends the browser to the auth domain; the login form renders there in the layout of the site the visitor came from, and once signed in the browser comes back with a code the site exchanges for a session of its own. So each domain keeps its own session cookie, as before, but a visitor signs in once and is signed in on every site, and logging out ends both the site's session and the auth domain's. A domain set apart with `"auth": true` serves the sign in, sign up and password pages of every site, which say so themselves with `servedOn: 'auth-domain'`; any other page built with `serverPage` reaching it is sent to the domain it belongs on.

For the deployment this means the auth host is in the ingress and the certificate like the sites' hosts, and that Feide is told of one callback alone, `https://<auth host>/api/auth/callback/feide`, since credentials and Feide are only offered there. The provider signs its tokens with the Omega ID key pair, `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`, published at `/api/oidc/jwks`, so no new secret is needed. The webmail of the mail server is a client of the provider too, the one given the mail scope, see [Mailboxes](#mailboxes). So is the sign in of the chat, `CHAT_AUTH_URL`, the one given the chat scope: a user who signs in to the chat is given their account there, a `ChatUser`, and the token says which Matrix id is theirs.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is a **build argument**, not only a runtime environment variable. Next bakes it into the build during `next build` to encrypt Server Action IDs, and a runtime env var is not passed to the build - so a build without it generates a fresh random key every time, which invalidates any Server Action referenced by a page a client still has open across the deploy ("Failed to find Server Action"). The release workflow passes the repository secret of that name, so it keeps the same value across releases, and the images are private because it is inside them.

### Applying database schema migrations

Schema changes go through [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate), in development as well as production. The dev database is built from the committed migrations (the dev reseed uses `prisma migrate reset`), so a schema change only reaches it through a migration.

Whenever you change a schema file under `src/prisma/schema/`, generate a migration for it locally and commit the result:

```bash
npm run docker:migrate:dev -- --name <name>
```

This runs in a one-off container, so it works whether or not the dev environment is running. It applies the migration to your dev database (checking it against a Prisma shadow database) and writes a new folder under `src/prisma/migrations/` containing the SQL. Commit that folder. If the change requires backfilling existing rows - a new required column with no single sensible default, or a restructuring that has to carry data across - edit the generated `migration.sql` by hand before committing: `migrate diff` only ever emits plain DDL and will happily generate something that fails against a populated table.

Committed migrations are applied **automatically on every deploy**. The migrate job in `deploy/base` runs `migrate:deploy` before the app and the worker roll, and a failed migration stops the sync, so the old pods keep serving instead of the new code booting against a half-applied schema. `migrate:deploy` only runs migrations that have not been applied yet, never touches existing data outside of what a migration's SQL explicitly does, and is a no-op once everything is applied, so an ordinary deploy costs nothing.

The same job then runs the standard seed (`seed:data`, via `migrate:deploy-and-seed`). This is not the dev reseed - it never resets anything. Every standard resource is upserted: content users can edit through the site (special CMS, news, notification channels, study programmes, ...) is only created if missing, while content they cannot edit (standard images, special image collections) is brought in line with the source code, so e.g. a changed file in `standard_store/` reaches production on the next deploy. It writes the standard images' files, so the job has the same store as the app.

Migrations therefore run *before* the new code is serving, while the previous release may still be up. Keep each migration backward-compatible with the release before it: add columns nullable, backfill, and drop the old shape in a later release rather than in the same one.

The migrate job runs the `tools` image with the command overridden. A dedicated leaner stage was measured and abandoned: at 2.80 GB against `tools`' 2.81 GB it saved nothing, because the weight is all in the shared `base` layer (`npm ci` with devDependencies, the generated Prisma client) rather than in the source tree on top. Reusing `tools` means the job is the same image `worker` already runs, so it adds no build time at all. The `tools` image has no default command: the migrate job and `worker` each set their own.

Tracked history starts at `20260922000000_init`, which creates the whole schema from empty. It carries no history from the `db push` era: anything merged before migrations existed is simply part of that initial snapshot rather than a migration of its own. It therefore expects an **empty database**, as a new installation's is before its first deploy. Run it against a database that already has these tables but no migration history and `migrate deploy` stops before applying anything, with P3005 ("the database schema is not empty").

### Trying the production images locally

```bash
./deploy/k3d/up.sh
```

builds the `prod` and `tools` images and runs the manifests in `deploy/` on a k3d cluster on your machine, see [deploy/README.md](deploy/README.md). The build workflow builds the same two images on every pull request.

### Mail

Mail is **not** part of this repo's manifests. It is received by the Stalwart server in [mail-infrastructure](https://github.com/vevcom/mail-infrastructure), which forwards every alias to the members behind it. Stalwart does not read this app's database: the mail server sync worker pushes every alias into it as a mailing list with the resolved members as recipients, and every site domain as a domain, through Stalwart's management API (`src/lib/mailServerSync/`). It runs when `EMAIL_ADMIN_URL`, `EMAIL_ADMIN_USER` and `EMAIL_ADMIN_PASSWORD` are set. The app only allows aliases on the domains in `sites.json`, so a site's domain receives mail once it has an alias and an MX record.

#### Mailboxes

An alias is for correspondence: every alias also keeps its mail in a mailbox on the mail server, and the people who receive the alias's mail read it in the webmail and answer from there as the alias: those on the alias's mailing lists, directly or as active members of a group on one. There is no alias without a mailbox; what only goes out to many is a notification. Owning an alias is administering it and gives no mailbox access of its own; a user sees the aliases they receive mail on, and the way into the webmail, under "E-post" on their own pages.

The webmail and the mailboxes are one setting, `EMAIL_WEBMAIL_URL`: the webmail's origin, whose host is also the domain of the accounts of those who sign in there. A mailbox is a group account at the alias's own address, on the alias's own domain, so its members see the alias in the webmail and answer as it: `styret@omega.ntnu.no` and `styret@contactor.no` are two mailboxes. The sync creates it, moves it with the alias and destroys it when the alias is deleted (`src/lib/mailServerSync/mailboxes.ts`). The server lets an address be a mailbox or a mailing list, not both, so with mailboxes the alias is no longer a list. The mailbox runs a script instead, which keeps the mail and sends a copy to a list of the addresses the alias reaches, on `forward.<webmail host>`, a domain for those lists alone, which needs no DNS (`src/lib/mailServerSync/forwarding.ts`). The sync makes neither that domain nor the webmail host's: both are in the mail server's plan, which [mail-infrastructure](https://github.com/vevcom/mail-infrastructure) documents and vivat fills in, and without them the sync leaves every alias as it was. The copy says at its top that the mail came to the alias and links to the webmail, where it is answered as the alias. Writing that into the mail breaks the sender's signature, so the copy goes out from the alias, signed by the server, with the sender as the address answers go to. Who may open a mailbox is who receives the alias's mail, and the sync is what tells the server (`src/lib/mailServerSync/memberships.ts`). The webmail signs its users in through the provider on the auth domain, as a client named by its host, and the token it hands the mail server only says who the user is: it carries the mail scope, without which Stalwart refuses it, and no list of mailboxes. Stalwart makes an account for the user at their first sign in, and every minute the sync makes each such account a member of exactly the mailboxes of the aliases its user receives. So someone put on an alias has its mailbox within the minute, and someone taken off loses it, also when they read it with an app password in a mail client and never sign in again. The sync takes the members out of a mailbox before it destroys it, which the server otherwise refuses. Being Stalwart's admin is the only other way in. Stalwart needs an OpenID Connect directory for this, with the issuer, `claimUsername` preferred_username, `usernameDomain` the webmail host, `acceptedAudiences` the webmail host and no `claimGroups`, since the memberships are the sync's, which [mail-infrastructure](https://github.com/vevcom/mail-infrastructure) documents and vivat fills in.

Outbound mail is sent by the app itself, with nodemailer, against `EMAIL_SERVER` using `EMAIL_PORT` and `EMAIL_SECURE`, see `src/services/mail/send/constants.ts`. In production that is the same Stalwart, on the listener mail-infrastructure sets up for the app: port 2525, which asks for no login and takes every sender, and which only the app can reach. So the app has no account on the server and no password, which matters once Stalwart signs people in through the app's own provider and refuses every password. `EMAIL_TLS_SERVERNAME` goes with it, set to the server's public name: the app reaches the server by its in-cluster name, and the certificate is for the public one, so that is the name it is verified by. `EMAIL_TLS_ALLOW_SELF_SIGNED=true` is for the dev mail server alone, whose certificate is self-signed. `EMAIL_USER` and `EMAIL_PASSWORD` are only for a server that asks for a login. Senders may be on any domain in `sites.json`, so every domain mail is sent from needs SPF and DKIM records that cover the server, or it lands in spam. vivat's README has the values and the DNS.

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
