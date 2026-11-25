# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Omegaweb Next is the website for Sanctus Omega Broderskab, built with Next.js 16, TypeScript, Prisma, and PostgreSQL. The application runs in Docker containers for both development and production.

## Development Commands

### Running the Application

```bash
npm run docker:dev
```
or
```bash
docker compose --env-file .env --env-file deploy/base/postgres.env -f docker-compose.dev.yml up --build
```

### Testing

Run all tests:
```bash
npm test
```

Tests use Jest with a custom Prisma test environment. The environment variable `IGNORE_SERVER_ONLY=true` is required for tests.

### Linting

```bash
npm run lint
```

Auto-fix linting errors:
```bash
npm run lint -- --fix
```

### Database Operations

Reseed the database. This deletes all data and re-seeds it:
```bash
npm run docker:reseed
```

Create a migration after schema changes. It writes `src/prisma/migrations/<timestamp>_<name>/`, which must be committed. The dev database is built from migrations, so a schema change only reaches it through one. This works whether or not the dev environment is running:
```bash
npm run docker:migrate:dev -- --name <name>
```

A PR must contain at most one migration per feature or fix it introduces, as long as that work has never reached prod. The one exception is what Postgres refuses to do in a single transaction, such as using an enum value in the migration that adds it; the second migration then says so in a comment at its top. Iterating on a schema locally before a PR is normal and produces several migrations; squash them into one before opening or updating the PR, by deleting the extra migration folders, resetting the dev database, and regenerating a single migration from the final schema. Once a migration has shipped to prod, it is final and must never be edited, deleted, or squashed; a later change goes in a new migration.

Regenerate Prisma client after schema changes:
```bash
npx prisma generate
```

Access Prisma Studio for database exploration:
```bash
npm run docker:prisma-studio
```

Access the container shell:
```bash
docker exec -it -w /workspaces/omegaweb-next pn-dev /bin/bash
```

## Architecture

### Service Layer Pattern

The codebase uses a ServiceOperation pattern for all business logic. Services live in `src/services/` and are organized by domain, such as `users`, `groups`, `cms`, and `events`.

**Key concepts:**
- **ServiceOperation**: core abstraction defined in `src/services/serviceOperation.ts`. All business logic is wrapped in ServiceOperations.
- **Server Actions**: client-callable functions created by wrapping ServiceOperations with `makeAction()` from `src/services/serverAction.ts`.
- **Authorization**: every ServiceOperation has an authorizer built with the `Require` chain from `src/auth/authorizer/Require.ts`. See [Authorizers](#authorizers).
- **Transaction Management**: the `transaction` flag says how a ServiceOperation relates to database transactions. `'OPENS'` means it opens its own: transactions cannot be nested, so the type system and runtime validation prevent calling such an operation from within an existing transaction. `'RUNS_IN'` runs it in the caller's transaction when there is one, and in one of its own otherwise, for an operation of several writes that belong together. `'NONE'`, the default, runs on whatever client it is given.

**Pattern example:**
```typescript
// auth.ts
export const fooAuth = {
  update: Require.permission('FOO_ADMIN').or().userId(),
} as const

// schemas.ts
const dataFieldSchemas = z.object({ name: z.string().trim().min(2).max(40) })
const paramsFieldSchemas = z.object({ id: z.number() })

export const fooSchemas = {
  data: {
    update: dataFieldSchemas.pick({ name: true }),
  },
  params: {
    update: paramsFieldSchemas.pick({ id: true }),
  },
}

// operations.ts
const update = defineOperation({
  paramsSchema: fooSchemas.params.update,
  dataSchema: fooSchemas.data.update,
  authorizer: async ({ params, prisma }) => {
    const foo = await prisma.foo.findUniqueOrThrow({ where: { id: params.id }, select: { ownerId: true } })
    return fooAuth.update.data({ userId: foo.ownerId })
  },
  operation: async ({ params, data, session, prisma }) => {
    // Business logic here
  }
})

// actions.ts
export const updateFooAction = makeAction(fooOperations.update)
```

### Authorizers

Rules are written once in a service's `auth.ts` as `Require` chains. The same rule runs on the server, inside the operation, and on the frontend, with `useAuthorizer`. `operations.ts` only supplies data to a rule with `.data({...})`. It never builds a `Require` chain itself.

- **Conditions:** `.permission('X')`, `.user()`, and `.userField()` take no extra data. `.userId()` needs `{ userId }`. `.groupAdmin()` needs `{ groupId }`. `.companyUser()` takes none, `.companyUserId()` needs `{ companyUserId }`, and `.companyMember()` and `.companyAdmin()` need `{ companyId }`; see [Company users](#company-users). `.levelOfDoubleVisibility({ level })` needs `{ visibility }`. `.ownership<Data>(check)` and `.custom<Data>(check)` let the caller define the check. `.visibilityFilter()` attaches a Prisma `where` filter to a list query instead of denying it. `.nothing()` means the operation has no access rule.
- **Combining:** conditions in a chain are ANDed; `.or()` starts a new OR'd group. `.anyOf(...)` and `.allOf(...)` combine already-built chains. `chain.allOf(extra)` only extends the last group of `chain`; use `Require.allOf(chain, extra)` to require `extra` on every branch.
- **Data:** a chain that needs data, such as `userId` or `groupId`, is a type error until `.data({...})` has supplied all of it. Rules that need data from the database fetch it in the operation's `authorizer`. The authorizer may be async and receives `prisma`; it then calls `.data()`.

### Sub-operations, ownership checks and internal calls

- **`defineSubOperation`** defines an operation for a sub-service, such as CMS paragraphs, images, or links, that other services embed. It has no authorizer of its own. Its schemas and `operation` are functions, so an implementer can pass implementation fields.
- **`.implement({ authorizer, ownershipCheck, beforeRun? })`** turns a sub-operation into a callable operation for one owning service. For example, `companyOperations` implements `cmsImageOperations.update` for a company's logo.
  - `authorizer`: may this user act on the owning resource?
  - `ownershipCheck`: does the sub-resource actually belong to the owning resource? For example, is the paragraph the career page's special paragraph? Returning false rejects the call. This is resource-to-resource integrity, not user permission.
  - `beforeRun`: optional extra checks that run after both and may throw.
- **`.internalCall({ params, data, ... })`** runs a sub-operation from server code with no authorizer and no ownership check. Use it only for calls from other operations or server code that has already authorized the user.
- A service's own writes that only its server code calls are sub-operations too, grouped under `internal` in its operations object, next to the authorized operations at the top level. For example `eventQuotaOperations.internal.create` and `eventNotificationOperations.internal.createChannels`. A plain function that writes to the database is not used for this.
- A change that spans several services is one authorized operation that opens the transaction and calls each service's own operations in it, as `eventOperations.saveSetup` does for an event with its variants, quotas, administrators and ledger account. It does not write the other services' rows itself.
- A sub-operation parses the data it is given, also on an internal call. So one that takes what an authorized operation has already parsed has a data schema that changes nothing when run twice: no conversion such as kroner to øre, and no form value such as `'NULL'` or `''` standing for null. See `parsedFieldSchemas` in `events/variants/schemas.ts`.
- A service that owns a CMS image, paragraph or link creates it through that sub-service's `create.internalCall`, inside its own transaction when it creates the owning row, for example `companyOperations.create`, and never by nesting the CMS row in the owner's Prisma write.
- **`implement…` factories** turn a whole sub-service into what one owner needs, where implementing its sub-operations one by one would repeat the same authorizer and ownership check. They all return the same shape: the authorized operations at the top level, ready for `makeAction` or a page, and under `internal` the sub-operations the owner's own server code calls with `.internalCall`. An owner creates, reads and destroys its sub-resources through `internal`, for example `visibility.internal.create`, `article.internal.create` and `flairImageCollection.internal.uploadImage`, and not through the sub-service's operations directly. The factories are `implementVisibilityRead`, `implementVisibilityOperations` and `implementDoubleLevelVisibilityOperations`, `implementNotificationChannelsForPurpose`, `implementMailAddressOperations`, `implementChatSpaces`, `implementArticleOperations` for the articles a service owns and `implementArticleSectionOperations` for the article sections it owns outside any article, and the special ones below. The owner hangs the result on a key named for the sub-resource, such as `visibility`, `article` or `articleSection`, and keeps its implementation params under the same key in its schemas. `implementAccountFlows` and the group type factories in `groups/implementGroupType.ts` return authorized operations only, and `implementStore` returns plain functions and a worker, since nothing of a store is called by a user. In the manual member management of `implementSimpleAddRemoveMembersOperation`, removing a member deactivates the membership and keeps it as the group's history, and `destroyMembership` deletes one for good, for a membership that should never have been there.
- **Group types.** A group is a `Group` and one row of its `groupType`, whose service in `src/services/groups/` builds its operations from the group type factories. The compiler does not find every place that lists the types: a new type is also added to `checkGroupValidity` and `inferGroupName` in `src/lib/groups`, the generics of `groups/types.ts`, `groupsWithRelationsIncluder` and `readGroupsOfUserIncluder`, `readPensionableGroup`, the lockers' reservation includer and the mail traversal's `groupTypeRelations`. A revue sub group (`groups/revueSubGroups/`) has no name of its own: it is named by its revue group, which the revue service (`revue/groups/`) makes and destroys it with through `internal`. A revue group is a committee or a revue sub group, and `RevueGroupInRevue` says which revues it is in and which order of its group's memberships is each revue's. Those memberships are the revue's members: only the active ones while the group stands in that order, and every one once it has moved past it or been pensioned. Removing a member deactivates the membership, so one removed during the year is listed again once the group is migrated, and an admin takes a membership out of a revue for good with the group's `destroyMembership`. A revue may be made with groups, each at an order chosen for it, which it puts in through `addToRevue` in its own transaction and changes nothing else about. Migrating and pensioning a sub group is done on its own admin page.
- **Special things** are rows addressed by a fixed enum value and owned by one service: a special article, special paragraphs, cms images and links, a special image collection, a special notification channel. The owner gets them from `implementSpecialArticle`, `implementSpecialCmsParagraphs`, `implementSpecialCmsImages`, `implementSpecialCmsLinks`, `implementSpecialCollection` and `implementSpecialNotificationChannel`. The `special` passed in is the ownership check, so the owner never writes one. Each returns `internal.read`, which reads the row without an authorizer and creates it when it is missing, beside the authorized `read` and updates. Where the row has a config, `internal.generateFromConfig` brings it in line with it, for the seeder.
- **A visibility** is a list of requirements, all of which must pass, and a requirement a list of conditions, one of which must. A condition is a group with what of its memberships count: `order`, the memberships of that order or of any order when null, `onlyActive`, only the active ones, and `onlyAdmins`, only the group's admins. `checkVisibility` says whether memberships pass one, and `passesVisibilityWhere` and `visibilityFilter` in `src/auth/visibility/` say the same as filters on users and on visibilities, so the three must change together.
- **A visibility on the frontend** has a factory of its own, in `src/app/_components/Visibility/VisibilityComponents.tsx`. An owner calls `implementVisibilityComponents` or `implementDoubleLevelVisibilityComponents` once, in a file beside its pages such as `news/newsVisibility.ts`, with its wording (`verb`, and `everyone` for what no requirements means), its update actions and `defaultMembershipRequirements`, what a group picked in the editor starts as by its group type: `{ order, onlyActive }`, where `order` is a number, null for any order or `'CURRENT_GROUP_ORDER'`, the picked group's own current order, which need not be Omega's. A picked group never starts as only the admins. It has no default, so every owner states it, for each level of a double level, with one of the two records in `defaultMembershipRequirements.ts` beside the factory. A visibility of who sees or signs up takes `regularDefaultMembershipRequirements`, which starts a group at `{ order: 'CURRENT_GROUP_ORDER', onlyActive: false }`, except an Omega membership group and a study programme, whose members stay active in the order they joined in, at `{ order: null, onlyActive: true }`. One of who administers or changes something, and the recipients of a notification sent by hand, since it is sent at once, take `adminDefaultMembershipRequirements`, which starts every group at `{ order: null, onlyActive: true }`. It gets `Field`, the editor as a field of a form, `Form`, which saves the visibility on its own, and `Description`, `describe` and `heading`, and for a double level `Forms` and `Description` for both. The form that creates the owner, the one that changes it and the text describing it import that one object, so they cannot say different things. Nothing else renders `VisibilityMatrixEditor` or `VisibilityAdmin`. Who a visibility lets in is put into words by `describeVisibility` beside them, and by nothing else. It says of each group which of its memberships are meant, as the editor's chip does. `visibilityWarnings` beside it is what the editor warns of a visibility that lets no one in but may still be saved. A server component cannot reach into the object, so it renders a client component that does.
- **Account flows on the frontend** have a factory too, `implementAccountFlowComponents` in `src/app/_components/AccountFlows/AccountFlowComponents.tsx`, the counterpart of `implementAccountFlows`. A kind of account binds it once with the actions of its flows and what differs between the kinds: the site of the mail, the title and button of the password form, what follows a chosen password and what a verified email shows. It gets `SendResetPasswordEmailForm`, `ResetPasswordForm` and `VerifyEmail`. The user's binding is `userAccountFlowComponents.ts` in the auth page kit's components, and the company user's is `companyUserAccountFlowComponents.ts` in `(careers)/career/(company-auth)/`. Each holds the bound object in a const named after the file and exports every component as a plain const of its own, so a server page renders them straight. `Mount` is what each component is given besides its own props such as the token: the page kit's config for a user, and nothing for a company user.
- **`bypassAuth: true`** skips the authorizer of a top-level operation when calling it from trusted server code, such as NextAuth callbacks or seeders. Clients cannot set it; `makeAction` never passes it.
- An operation called inside another operation inherits its context through async local storage: the prisma client or transaction, the session, and `bypassAuth`. Pass `prisma: tx` explicitly to run one inside a transaction.

### Service Folder Structure

Each service domain follows a standard file layout. See `src/services/omegaquotes/` as the canonical example:

```
src/services/[domain]/
├── actions.ts      # 'use server': makeAction() wrappers, one per operation
├── auth.ts         # Authorizer definitions: `Require` chains, shared with the frontend
├── constants.ts    # Domain constants and config values: env vars, field selections
├── operations.ts   # defineOperation() calls, exported as `{ ... } as const`
├── schemas.ts      # Plain Zod schemas: `fooSchemas.data` and `fooSchemas.params`, keyed by operation
└── types.ts        # TypeScript types specific to this domain, if needed
```

Rules:
- **`constants.ts`**: not `ConfigVars.ts` or any other name
- **`operations.ts`**: the exported object must end with `as const`
- **`schemas.ts`**: holds every `dataSchema` and `paramsSchema` the service's operations use. See [Operation Naming Conventions](#operation-naming-conventions). None are defined inline in `operations.ts`.
- **`actions.ts`**: must have `'use server'` at the top; only calls `makeAction()`
- Sub-domains, such as `mail/alias/`, follow the same layout within their subfolder

### Background Workers

Work that runs outside requests lives in `src/workers/`:

- **`definitions.ts`** defines every worker (`images`, `notifications`, `paymentCompletion`, `unpaidRegistrations`, `ombulStore`, `originalImageStore`, `cacheImageStore`, `untrackedStoreFiles`, `ledger`, `mail`, `chat`) as `{ name, intervalMs, tick }`: what it does, in what order and how often.
- **`types.ts`** holds the `Worker` type that shape follows and `WorkerName`, the names `main.ts` accepts.
- **`main.ts`** is the entrypoint of the `worker` compose service (`npm run worker`). It runs the workers side by side in one process: the loops, the wait between ticks and shutting down on SIGTERM/SIGINT. Naming workers as arguments (`tsx src/workers/main.ts images`) runs only those, so one can be moved into a container of its own from compose alone.

Nothing outside `src/workers/` is called a worker, except the workers of the store, which `definitions.ts` mounts as they are: the `worker` every `implementStore` returns and `untrackedStoreFilesWorker`. See [The store](#the-store).

- **Services** export the units of work, named for what they do, next to the domain logic they use: `processNextImage` (`images/subservice/processingQueue.ts`), `dispatchNextEmailNotification`, `dispatchNextPushNotification` and `sendDueWeeklyDigests` (`notifications/methods/dispatchQueue.ts`), `runNextPaymentCompletionHook` (`ledger/transactions/paymentCompletionHooks.ts`), `requeueNextUnpaidRegistration` (`events/registration/requeueUnpaid.ts`), the ledger sweeper's checks (`ledger/sweeper.ts`), `syncMailServer` (`src/lib/mailServerSync/sync.ts`), and `syncChat` (`src/lib/chatSync/sync.ts`).
- A unit of work that handles one item at a time returns `true` when there may be more waiting, so the worker comes straight back instead of waiting out its interval.
- The mail server sync is how the addresses of the aliases and the users, see [Mail addresses](#mail-addresses), reach the mail server, Stalwart, which cannot read them from the database the way Postfix did. Every minute it makes the server's domains match the sites' mail domains, and the server's view of every alias and every user's address match the database. The sites' domains are the only ones it creates, since `sites.json` is the one list of them. The webmail's host and `forward.<webmail host>` are the mail installation's, so the infrastructure's plan for the server holds them (vivat's `site.ndjson`, and `dev/plan.ndjson` in mail-infrastructure for development) and the sync only looks them up. Without a webmail an alias is a mailing list at its address, with the addresses it reaches as recipients. With one, an alias is a mailbox, since an alias is for correspondence: a group account at the alias's own address (`src/lib/mailServerSync/mailboxes.ts`, matched by address first and by the id the alias remembers second), so members see and answer as the alias. The server lets an address be a mailbox or a list, not both, so the mailbox runs a Sieve script that keeps the mail and sends one copy to a list of the alias's addresses on `forward.<webmail host>`, with a notice at its top that it is answered in the mailbox (`src/lib/mailServerSync/forwarding.ts`). The webmail's host is the domain of the accounts that sign in. The app has no account there: it sends through a listener that asks for no login, see `mail/send/constants.ts`. The sync runs when `EMAIL_ADMIN_URL`, `EMAIL_ADMIN_USER` and `EMAIL_ADMIN_PASSWORD` are set, and keeps mailboxes when `EMAIL_WEBMAIL_URL` is set too (`src/lib/mailServerSync/constants.ts`); the client for the server's JMAP management API is `src/lib/mailServerSync/client.ts`. Code changing aliases, mailing lists or memberships leaves the server to it. A change the server refuses does not stop a run: every step does what it can, and the run throws at its end naming what was refused, so one alias the server will not take does not keep the others from it. The one exception is the domains the mailboxes take: when the server lacks the webmail's domain or the forwarding domain, the run ends there and leaves every alias as it was. It only takes those who no longer receive an alias out of its mailbox first (`revokeMemberships`), so a missing domain never lets someone keep a mailbox they were taken off. Who may open a mailbox is who receives the alias's mail, and the sync is what tells the server: every run it makes the account of each user who has signed in to the webmail a member of exactly the mailboxes of the aliases they receive (`src/lib/mailServerSync/memberships.ts`). The token the webmail signs in with says who the user is and nothing about mailboxes. A user's own address is a mailbox too: the account they sign in to (`src/lib/mailServerSync/userMailboxes.ts`). The server signs a user in by `<username>@<webmail host>`, so the sync keeps that name as an alias of the account and moves the account itself to the user's address, which is why a changed address keeps its mail. A user is given their account ahead of their first sign in, an archived user's is left where it is, and a deleted user's is destroyed. While an address has `forwardsToPrivateEmail` on, its mailbox also sends a copy on: an alias's to the list of the addresses it reaches, a user's straight to their private email. With it off, an alias's mailbox only keeps the mail, and a user's runs no script of ours, so one of their own may run. Without a webmail there is no mailbox to keep mail in, so every address is a list that forwards whatever the setting says. Before each sync the worker gives every user without an address the one they have by default (`giveMissingVevenMailAddresses`).
- The ledger sweeper is the ledger's common failure path. It cancels stale PENDING transactions, reimburses succeeded payments no transaction claimed, and flags what it can't fix for admins at `/admin/ledger-review`. Code using the ledger leaves these cases to it instead of handling them itself.

### Mail addresses

An address on one of our mail domains is a `MailAddress` row, kept by the sub-service in `src/services/mail/address/`. An alias has one, and a user has one, their veven mail address, which is not `User.email`, their private email.

- The owner keeps the address in a column of its own that is a relation to `MailAddress.address`: `MailAlias.address` and `User.vevenMailAddress`. So an address is one owner's, and the owner's column follows when the address changes.
- A service gets the operations of its addresses from `implementMailAddressOperations({ implementationParamsSchema, authorizers, readMailAddress })` in `mail/address/implement.ts`: `vevenMailAddressOperations` in `users/vevenMailAddress.ts` and `aliasMailAddressOperations` in `mail/alias/operations.ts`. It gets `read`, `update` and `updateForwarding`, guarded by its own authorizers and refusing an address that is another owner's, and under `internal` the sub-operations `create` and `destroy`, which its own operations call with `internalCall` in the transaction that writes or deletes its row.
- A user is given `<username>@<main domain of Omega's site>` when they are created, with a number after it when that is taken (`vevenMailAddressOperations.internal.createDefault`, a sub-operation nobody asks for). A user admin moves it. An alias's is moved by an owner who may create aliases.
- `forwardsToPrivateEmail` says whether mail to the address is also sent on to the private email of those behind it. The user decides for their own address, and the owners for an alias.
- What an address is on the mail server is the mail server sync's, see [Background Workers](#background-workers). Code changing an address leaves the server to it.

### The store

Files users upload are kept by the store, a sub-service in `src/services/store/`. A file is a `StoreFile` row and its content. The row has a `name`, a `purpose` (`OMBUL`, `ORIGINAL_IMAGE` or `CACHE_IMAGE`) and the `location` of the content: the S3 bucket or the store volume, the `store/` directory.

- A service implements a purpose once with `implementStore({ purpose, allowedExtensions, preferredLocation, owners, repairLost? })`, for example `ombulStore` in `ombul/store.ts` and `originalImageStore` and `cacheImageStore` in `images/subservice/imageFiles.ts`. It gets `createFile`, `readFile`, `storableExtension` and a `worker`, which is mounted in `workers/definitions.ts`.
- The row that owns a file keeps its name in a column that is a relation to `StoreFile.name`, such as `Image.fsLocationOriginal`, and the file is shown at `storeFilePath(purpose, name)` from `store/paths.ts`. Code outside the store never asks where the content is. The route `/store/<directory>/<name>` looks the name up and streams it from wherever it is.
- `createFile` writes to `preferredLocation`, and to the other location when that one fails or no bucket is set. It writes the row on its own, outside any transaction of the caller.
- A service never destroys a file. It deletes or changes the row that refers to it, and the file is then an orphan: a file no row refers to and older than an hour. The worker of the purpose destroys the orphans, moves the files that are not in the preferred location, and reports as an error the files a relation outside `owners` refers to. So a failed write, a rolled back transaction and a deleted row need no cleanup of files.
- A file a row refers to whose content is in no location is lost. The worker finds the lost files among those it moves and among those kept on the volume; the bucket is not gone through. A purpose whose files can be made again says how with `repairLost(names)`: `cacheImageStore` drops the `ProcessedImageFiles` rows of the images concerned, so the image worker processes them again. Without `repairLost` the lost files are reported as an error on every run, with the rows that refer to them, since they are gone until someone uploads them again.
- A new kind of owner is a relation on `StoreFile` in `store.prisma`, listed in `storeFileOwners` in `store/constants.ts`, and a new purpose is an enum value with a directory in `store/paths.ts`.
- `untrackedStoreFilesWorker` destroys content that has had no row for a day, which the other workers cannot see.

### Prisma Schema Organization

Prisma schemas are split into multiple domain-specific files in `src/prisma/schema/`:
- `schema.prisma`: main configuration, generator and datasource
- `user.prisma`, `group.prisma`, `cms.prisma`, and so on: domain models

The Prisma client is generated to `generated/pn-prisma/` outside the src folder.

### Authentication

- Uses NextAuth.js v4 with custom JWT tokens
- Auth configuration in `src/auth/nextAuth/`
- Session management via `ServerSession` and `Session` classes
- Custom visibility and authorization system
- One domain signs users in, the auth domain of `sites.json` (`"auth": true`, or Omega's main domain without one). The app is an OpenID Connect provider there (`src/services/auth/oidc/`), and every site domain is a client of it (`src/auth/sso/`, `src/app/api/sso/`): a site's login link is its start route, the login form itself lives on the auth domain, and the callback starts the site's own session with the same token NextAuth builds (`src/auth/nextAuth/sessionToken.ts`). The pages of the auth kit (`src/app/_pageKits/auth/pages/`) say themselves that they are served there, with `servedOn: 'auth-domain'` on `serverPage`, set in the kit and never in a site's mount; the logout page does not, since it clears the cookie of the domain the visitor is on. `serverPage` sends a request for a page on a domain that does not serve it on to the one that does, with its path and query: such a page to the auth domain, and any other page away from a domain set apart to sign in. Neither the proxy nor `DomainContext.resolveHref` knows an auth page from its path, so a link to one resolves as a page of its site and reaches the auth domain by that redirect. A link that knows its page is served there says so, with `servedOn="auth-domain"` on `SiteLink` or `{ servedOn: 'auth-domain' }` to `siteRedirect` and the site router's `push`, and then goes straight there: the links between the kit's pages do, so a visitor on a domain set apart to sign in stays on it. What must go straight there, the redirects to the login form and the links in the sign up and password emails, uses `DomainContext.authDomainUrl`. `authPagePaths` in `src/app/_pageKits/auth/paths.ts` lists the kit's pages for `authLinks`, checked against the route folders by a test. The clients are in `src/services/auth/oidc/clients.ts`: the site domains, the webmail of `EMAIL_WEBMAIL_URL`, and the chat's sign in of `CHAT_AUTH_URL`, see [Chat](#chat). The provider's endpoints are service operations behind `apiHandler` (`src/app/api/oidc/`). `oidcScopes` in `scopes.ts` is the one table of scopes: which clients may have each, its claims and how each claim is read, so the mail scope `urn:ietf:params:oauth:scope:mail`, which the mail server refuses a token without and which brings no claim, is one entry given to the webmail alone. `oidcProtocol` in `constants.ts` names the protocol's fixed values once and `oidcWireNames` in `wire.ts` the parameters' spelling.
- A session has an id, `sid` in its token, which `sessionTokenOf` makes when the session starts and which the session keeps for as long as it lives, as it keeps its epoch. An ID token names the session on the auth domain it was issued in by that id, as the claim `sid`: the authorize endpoint puts it on the code and the token endpoint in the token. A session started before sessions had an id has none, and its ID tokens carry no `sid`. No page reads it: NextAuth's session callback hands on the user, the permissions and the memberships alone.
- A client may have an address where it is told that the session it signed users in from has ended, `backchannelLogoutUri` on the client in `clients.ts`, by OpenID Connect Back-Channel Logout. Only the chat's sign in has one, see [Chat](#chat). The session on the auth domain ends on purpose in two places, and both hand its `sid` to `oidcOperations.endSession` and nothing else: the end session endpoint, which reads it from the cookie before it clears it, and NextAuth's own sign out on the auth domain, by the `events.signOut` that `authOptionsOn` (`src/auth/nextAuth/authOptionsOn.ts`) gives the route handler there. The second is the one that fires where the auth domain is also a site's, since `LogOut` has then cleared the cookie before the browser reaches the endpoint. A sign in on the auth domain in a browser that holds a session there replaces that session's cookie with no sign out. NextAuth hands its jwt callback nothing of the session held, so `authOptionsOn` reads it from the request at a sign in. When it is the same user's, the session goes on: the new token keeps its `sid` (`sessionGoingOn` in `sessionToken.ts`), whichever login the user came by. Any other session with an id has ended, and its `sid` is handed to the operation as at a sign out, before the new session is given its cookie. The operation signs a logout token for each client with an address (`signLogoutToken`: the `sid` and no user, good for two minutes, with an id of its own, signed with the key the JWKS serves) and `postLogoutToken` in `backchannelLogout.ts` posts it, once, in the request, for at most `OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS`. Nothing is retried: a client that is not told is logged as an error with the client, the address and the reason, never the token, and the logout or the sign in goes on. A session without an id tells no one, and neither does what ends every session of a user at once, such as a new password, or a session that runs out.

### Chat

The chat is a Matrix homeserver outside this repo, in chat-infrastructure. The code uses Matrix's words: a space is a group of rooms with a member list, a room is where messages are written, and the homeserver is the whole installation.

- **Signing in.** The chat signs its users in through the provider on the auth domain. Its sign in service, MAS, is a client there, named by the host of `CHAT_AUTH_URL` (`src/services/chat/constants.ts`). Left unset, there is no chat.
- **Signing out of the chat's sign in.** The chat's sign in keeps a session of its own in the browser, and would offer the account to the next person at that machine. So it is told when the session on the auth domain ends, at a logout or when another user signs in over it in that browser, see [Authentication](#authentication): its address is `/upstream/backchannel-logout/<CHAT_AUTH_PROVIDER_ID>` on MAS as the app reaches it, `CHAT_MAS_URL`, where `CHAT_AUTH_PROVIDER_ID` (`src/services/chat/constants.ts`) is what MAS's config calls the provider. Without `CHAT_MAS_URL` it has no address and is told nothing. MAS then ends its own session in that browser and every chat session started in it, their devices included (`on_backchannel_logout: logout_all` in chat-infrastructure). That is the chat client in that browser, and a chat app that signed in through it: logging out in a phone's browser also ends a chat app on that phone that signed in through that browser, which is reasoned from how such an app signs in and was not tried with a phone. What was started in the user's other browsers is left alone. A sign out MAS never hears of, because it was down that second, leaves that browser as it was, and the chat pages still refuse tokens that are another user's.
- **Chat users.** A user's account on the chat is a `ChatUser` row (`src/services/chat/users/`), and a user without one is not on the chat. Signing in to the chat is what gives a user theirs: the chat client of the provider has `beforeCode`, which calls `chatUserOperations.optIn` before the code is issued. No other code creates one.
- **The localpart.** `ChatUser.localpart` is what stands before the colon in the user's Matrix id. It is made from the username once (`localpart.ts`) and never changes, since Matrix does not let it. The token tells MAS which it is, as the claim `chat_localpart` of the `chat` scope, which only the chat's sign in is given. So this app decides what a user is called on the homeserver, and the homeserver never names one itself. A deleted user's `ChatUser` stays, without a user: that is what tells the sync to deactivate the account, and it keeps the localpart from ever being another user's.
- **The chat picture.** An account may have a picture of its own, `ChatUser.imageId`: an upload in the special collection `CHATPROFILEIMAGES` (`chatProfileImageCollection.ts`), which the account alone owns. `chatPictureOf` in `picture.ts` is the one place that says which picture an account has: its own, without one its user's profile image, and none without either. An image the image worker has given up on counts as no image there. Only the user gives their account a picture and takes it away, with `updatePicture` and `destroyPicture`, and not a user admin for them. A picture that is replaced or removed is deleted, as a profile image that is replaced is. On `/chat/settings` a line that is read out says that an upload or a removal went through (`ChatPictureForms`), which is how a screen reader is told. The sentence that says which picture the account has would not do, since a new picture in place of another leaves it as it was. The chat sync gives the account its picture on the homeserver, where everyone on the chat sees it, the profile image included, which `/chat/settings` says.
- **Chat spaces.** A space is a `ChatSpace` row and its members `ChatSpaceMember` rows, kept by the sub-service in `src/services/chat/spaces/`. A service that owns spaces gets its operations from `implementChatSpaces({ purpose, implementationParamsSchema, authorizers, ownershipCheck })`: `read`, `readMembers`, `update`, `destroy`, `addMembers` and `removeMembers`, and for the rooms of a space `readRooms`, `createRoom`, `updateRoom`, `destroyRoom`, and `addRoomMembers` and `removeRoomMembers` for a private room, guarded by its own authorizers and refusing a space that is another owner's, and under `internal` the sub-operation `create`, which it calls in the transaction that writes its own row, and `read`, `readRooms`, `readMembers`, `update` and `destroy` for its own server code. Only users with a `ChatUser` can be members, and `readAddableUsers` reads them a page at a time for whoever sets a space's members: the picker in `AddUsersPopUp` reads from it, through `UserDetails.readPage`, and not from the user list's own partitions, which show a former student to a user admin alone. `SpaceAdmin` (`src/app/_components/Chat/SpaceAdmin/`) is where a space's name, rooms and members are managed. It knows no owner: the owner's page hands it its own actions as `actions`, typed `ChatSpaceAdminActions` in `types.ts`, with its implementation params bound, and an action left out is not offered. Who administers a space is never stored: the owner adds how its admins are read to `chatSpaceAdmins` in `admins.ts`, by its purpose, and the sync asks on every run. The owner may also name those a space has as members without anyone adding them, in `chatSpaceStandingMembers` beside it: the sync gives each a member row and takes none away, so one who is named no longer stays until they are removed.
- **A space's notification channels.** A space has two channels, `ChatSpace.mentionsNotificationChannelId` and `allNotificationChannelId`, with the purposes `CHAT_SPACE_MENTIONS` and `CHAT_SPACE_ALL`: one for the messages that mention a user and one for every other message in its rooms. Neither offers the weekly mail: mentions offer mail and push, and every other message push alone. They sit under the special channel `CHAT` (`src/services/chat/chatNotificationChannel.ts`) and are kept by `chatSpaceNotificationOperations` in `src/services/chat/spaces/notifications/`, which says once what a channel of each purpose is, as `channels` to `implementNotificationChannelsForPurpose`: the special channel it sits under, its description and the methods it offers. Making one is then `internal.createAsConfigured` with its name, as an event's channels are made too. The sub-service calls its `internal` operations: the channels are made with the space, renamed with it, and removed by the chat sync when it deletes the space's row. A test makes a space with `createChatSpace` from `tests/chatSpaces.ts`, since a row made by hand has no channels. Nothing is sent in them yet.
- **Hearing from the homeserver.** The app is the homeserver's application service, so Synapse sends it every event in every room, at `/api/chat/appservice` (`CHAT_APPSERVICE_PATH`), signed with `CHAT_HS_TOKEN`. The route under `src/app/api/chat/appservice/` answers the transactions of Matrix's application service api and nothing else, and the proxy lets it through for a host that is no site's, since the homeserver asks by the app's name inside the cluster. `chatAppserviceOperations.receiveTransaction` (`src/services/chat/appservice/`) keeps the messages as `ChatRoomMessage` rows, with who wrote, where and who is mentioned, and never what is said: those written in the rooms of the spaces by their room, and those written outside every space, in direct messages and the group rooms users make themselves, by the Matrix room they were written in (`standaloneMatrixRoomId`), since the app keeps no row for such a room. Everything else is let go: edits, and what is written in the room a space itself is or in a room being destroyed. A message that is removed before it is notified of is forgotten. Without the token set, nothing is taken, and production refuses to start on the development token. The chat sync then makes a notification of each kept message (`notifyOfMessages` in `src/lib/chatSync/messages.ts`): one that mentions someone goes in the space's channel for mentions, to those mentioned, and any other in its channel for every message, to the others in the room. It asks the homeserver who is in the room, so nobody outside it is notified, and the one who wrote never is. A mention of the whole room counts only from one the room's levels let mention it, which is a moderator, and is any other message otherwise. A message is notified of within the hour or not at all: one that keeps failing, and what piled up while the homeserver or the worker was away, is let go. A notification says who wrote and where, and leads to the chat pages: one from a room of a space to the spaces, and any other to the messages. Outside the spaces there is one channel for everything, the special channel `CHAT_DIRECT_AND_GROUP` under `CHAT` (`src/services/chat/directAndGroupNotificationChannel.ts`), which offers mail and push. What one user wrote in one room since the last run is one notification there, to the others in the room and to those invited to it, since one who is written to for the first time is not in the room yet. The bot is in no such room, so the sync reads it as an admin of the homeserver (`readStandaloneRoom`). A room of two without a name is a direct message, "skrev til deg", and any other a group.
- **A committee's chat space.** A committee may have one space, `Committee.chatSpaceId`, kept by `committeeChatSpaceOperations` in `src/services/groups/committees/chatSpace.ts`. An active admin of the committee or `COMMITTEE_ADMIN` creates it, destroys it and manages its rooms and members. It is named for the committee and follows its name, and is destroyed with it. Its standing members are the committee's active members and its admins the active admins (`chatSpaceRoles.ts`), so a new member is in the space and a new leader moderates its rooms without anyone touching the chat. A membership that ends takes nobody out: they stay until they are removed on the committee's chat page. That page is `/committees/[shortName]/chat`: it mounts `SpaceAdmin` for the rooms with the committee's actions, and shows the people the committee's own way in its `membersSection`.
- **Manual chat spaces.** A space that is no committee's is a manual one, kept by a service of its own, `src/services/manualChat/`, which implements the chat spaces as the committees do. `MANUAL_CHAT_SPACE_ADMIN` creates, renames and destroys them and picks each space's admins, the `ManualChatSpaceAdmin` rows. An admin sets the space's members and rooms and moderates its rooms, and changes nothing else about it. The spaces are listed and made at `/admin/chat-spaces`, and one is managed at `/admin/chat-spaces/[spaceId]`, which mounts `SpaceAdmin` with the service's actions, and beside it who the admins are. That page is guarded by the service's own rule and not by the admin navigation, since a space's admins need hold no permission. A user finds the spaces they are an admin of among their spaces on the chat pages.
- **The chat pages.** `/chat` on Omega's site is the signed-in user's own chat, and nobody opens another user's. The pages are in `src/app/(omegaweb)/chat/`: `chatLinks` builds every link to them, `chatNavDef` is their navigation for a user, each item with the rules of what its page reads, given the user's id. A page is guarded by what it reads and has no rule made for it: each starts with `authorizeChatPage(session)`, which only gives the signed-in user, whose id the page reads with, and which sends a visitor to sign in and turns a company user away, since one has no chat. Without `CHAT_AUTH_URL` the nav def is empty and the pages are not found. The main navigation knows no user where it is defined, so it shows the chat to whoever is a user, as every user has the pages, and to nobody without a chat. `/chat` is for the direct messages and the group rooms, which only the homeserver knows: where the pages have a sign in it lists them from the browser's own session, see the chat session below, and otherwise it links to the chat client. The chat client is Element, whose origin is `CHAT_CLIENT_URL` (`chatClientOrigin` in `src/services/chat/constants.ts`, left unset there is no link and no "Åpne i Element" in the navigation). A profile's "Send melding" leads to `/chat/messages/[username]`, the direct message with that user, and from the user's own profile to `/chat`. Where the pages have a sign in, that page opens the room the two have, see a room on the pages below: `chatUserOperations.readDirectMessage` gives the user's Matrix id, which the room is found by in the browser's session. For two who have no such room yet it is where the first message to them is written, which makes the room, see who is in a room below. Without a sign in the page names the user and links to the chat client's direct message with them. `/chat/rooms/[roomId]` is a room by its Matrix id, which is the one thing every room has to be found by: a group has no other handle, and two users may have more than one direct message. It is the address the list on `/chat` leads to. The button is greyed out for a user who is not on the chat, and is not there without a chat or for a viewer who is no user. `/chat/spaces` lists the spaces the user is in (`chatUserOperations.readSpaces`) with the rooms they are let into, and the manual spaces they administer. Where the pages have a sign in, a room of a space opens here, at `/chat/spaces/rooms/[roomId]` (`chatLinks.spaceRoom`) by the id of its row, and nothing in the list leads to the chat client. Without one, a space and a room that are on the homeserver open in the chat client. `/chat/settings` holds the picture of their account, which `ChatPictureSetting` shows with where it is from and lets them replace and remove, and their subscription to the `CHAT` channel and to the one for direct messages and group rooms under it, and to the two notification channels of each space, all set with the same `UpdateNotificationSubscription` as on the notifications page. Neither channel is given a subscription when someone joins a space: both follow the channels above, so a user who wants nothing from the chat turns the `CHAT` channel off with its sub-channels. `/users/[username]/chat`, where this was, redirects to the settings.
- **The chat session.** The chat pages are to hold a client of their own, which talks to the homeserver from the browser. So the browser keeps the user's session with the chat, and the app takes no part in it: it holds no token and asks the homeserver nothing for a user. For that the chat pages are a client of the chat's sign in, `CHAT_SESSION_CLIENT_ID` in MAS's config (`src/services/chat/constants.ts`), with the one redirect uri `chatLinks.signIn()` on the main domain of Omega's site. `chatSignIn` in `src/services/chat/constants.ts` is what signing in takes: `CHAT_AUTH_URL`, `CHAT_HOMESERVER_PUBLIC_URL`, which is the homeserver as browsers reach it, and `CHAT_SERVER_NAME`. With one of them unset the chat pages are there and sign nobody in. `chatSessionOperations.read` (`src/services/chat/session/`) is all the browser asks the app: where the homeserver is, the client id, and the Matrix id of the signed-in user, which is null until signing in has given them their `ChatUser`. Only the user reads it. The content security policy lets a chat page alone fetch from the homeserver and its sign in: `contentSecurityPolicy` in `src/lib/securityHeaders.ts` takes that as `chatPage`, and the proxy gives it to a path that `isChatPagePath` (`src/app/(omegaweb)/chat/config.ts`) takes, on a domain that serves the chat pages. Every other page has the policy it had, which `tests/lib/securityHeaders.test.ts` holds written out. A policy is its document's and not its page's: a document loaded at a chat page keeps it after the visitor moves on to another page without a new load, and one loaded elsewhere has none of it at a chat page, so the provider below loads the page anew then.
- **The session in the browser.** `src/lib/chatSession/` is the session as the browser keeps it, and runs in the browser alone. It reaches the browser through `ChatSessionBrowser` (`browser.ts`), which the tests answer with `tests/chatSessionBrowser.ts`: a storage, a fetch stub, a lock and an IndexedDB from the dev dependency `fake-indexeddb`, with the tabs of one browser. The SDK, `matrix-js-sdk`, is pinned and is loaded by `loadChatSdk` when it is first needed, never imported at the top of a module, so it is in no other page's scripts and is never run by the server; a type is imported with `import type`. `storage.ts` says what is kept where: the session, which is the Matrix id, the device id and the two tokens, in `localStorage`, what the SDK has synced in an IndexedDB database of the user's own (`syncStoreNameOf`), and nothing on the server. The SDK puts `matrix-js-sdk:` before the name its store is given, and that is the name a database is deleted by. `signIn.ts` starts the round trip to the chat's sign in and completes it at `/chat/sign-in`, where the answer comes back in the fragment of the address, which no server sees. The chat's sign in has a session of its own that outlives the one here, so it may answer for whoever used the browser last: tokens that are not the signed-in user's are revoked and not kept. A browser is one device for a user, by a device id kept per Matrix id and asked for at every sign in, and a device lives as long as its session: `forgetSession` forgets both and the next sign in is a new device. It also deletes what was synced, for every user the browser holds something of (`deleteSyncStores`), so nothing of one user is left for the next. A store is the user's own by its name besides, so one that was left behind is never opened as another's, and the client deletes every other user's before it opens its own. `client.ts` makes the client of a kept session, whose new tokens take the place of the kept as the SDK refreshes them, stops it with its store closed (`stopChatClient`), signs out, which ends the session at the chat's sign in and so removes the device, and holds the lock that lets one tab run the client at a time. `runChatSession` in `run.ts` is the whole of it for one tab and says where it stands as a `ChatSessionState`: it signs out a kept session that is another user's than the one signed in here, runs the client of the user's own once the tab has the lock, and forgets the session when the homeserver says it has ended or another tab signed out. The lock is held only while there is a session to run, so a tab that is signed out keeps no other from signing in, and a tab that signs in takes it before it keeps the session. No encryption is started yet.
- **The session on the pages.** `ChatSessionProvider` (`src/app/_components/Chat/Session/`) is in the chat layout where the pages have a sign in, so one client serves every chat page and is stopped when the visitor leaves them. A component reads it with `useChatSession`, and reads from `state.client` while the state is `RUNNING`. The client shows its state anew at every sync, and the provider hands on only a state that is another, so a component renders again when the session changes and not at every sync. What a component shows of the client it watches itself, as a `Watched` (`watch.ts`) read with React's `useSyncExternalStore`: `read` gives the same object until what is shown has changed, and `subscribe` tells when. `watchAtSync` is for what is cheap to read again at every sync, such as the list of rooms, and tells only of a list that is another. `ChatSessionStatus` says every other state to the user, with the button that signs in. Nothing sends the browser to the chat's sign in but `ChatRoomList` on `/chat`, and it only does so by itself for a user who has an account: signing in is what gives a user their account, so one without is asked first. `/chat` lists the rooms outside the spaces, `standaloneRoomsOf` in `rooms.ts`: a room of two without a name is a direct message and is called what the other one is, and any other is a group, as the notifications have it. A space and its rooms are left out, since `/chat/spaces` lists them from the rows, and the page says which they are from `chatUserOperations.readSpaces`. A room the user is in opens, at `chatLinks.room`, and the list says how many messages in it are unread, and how many of those mention the user (`watchStandaloneRooms`). The count is the homeserver's own, of what it would notify the user of since the message they last told it was read, so it is the same in every client, and a room the user has silenced in another client counts nothing. One they are only asked into is answered in the list and opens once it is accepted, and a conversation is started from `NewConversation` above the list, see who is in a room below. Logging out here signs the browser out of the chat first, where it holds a session with it, which is on the domain that serves the chat pages. The logout page cannot do it: its content security policy lets it reach no chat. So `LogOut` sends such a browser by `/chat/sign-out` (`chatLinks.signOut`), a chat page that ends the session and sends the browser back to the logout page it came from, which then finds no session and logs out. A session is ended only in a tab the logout page has asked for it in (`requestSignOut`), since a link to that page can be put anywhere: `runChatSession` takes the request as it starts, signs out and runs nothing, and without one the page only sends the browser on. `prepareChatSignOut` decides the way for `LogOut`: where no chat page can end the session, with nobody signed in here or no sign in on the chat pages, it is forgotten in the browser, and so it is when the app does not answer, since the page would then show an error and send the browser nowhere. The session with the chat's sign in then lives on until it is ended there. Logging out here never depends on the chat: whatever goes wrong there, a blocked storage included, the logout goes on.
- **A room on the pages.** `OpenChatRoom` (`src/app/_components/Chat/Room/`) opens a room in the browser's session: the one with a Matrix id, or the direct message with a user (`joinedRoom` and `directRoomWith` in `rooms.ts`). It is found among the rooms the homeserver has told the client of, so a room the user is not in does not open, whatever the address says. The direct message with a user is a room without a name that the user is in, of the two of them and nobody else, where the other has joined or is asked in and has not answered, and the one last written in when there are several. It is also a room nobody else gets into or reads (`kindOf`): one of the two who are in it made it, only one who is asked in may join it, and what is written in it is not for everyone to read. Whoever makes a room may set it up to be read from outside, and anyone may make one and ask two others in, so a room a third made and left is no direct message, whoever is in it now: "Send melding" would open a room where that third still reads. For the same reason the SDK's `guessDMUserId` is not what it goes by: that names the one who asked the user in also after they have left. A room opened as the direct message with a user is called by the app's name of them, in its heading, the label of its field and what a screen reader is told. `ChatRoom` is the open room: its timeline and where a message is written. Everything the user does in it goes from the browser straight to the homeserver, and no operation relays a message. `watchRoomTimeline` in `src/lib/chatSession/timeline.ts` is the room as the components show it, built on the SDK's live timeline of the room: what the sync has brought, and what `paginateEventTimeline` has paged back from there, a page of `PAGE_SIZE` at a time until the homeserver gives no token for more. The client runs without the SDK's `timelineSupport`, so a sync that left a gap puts a new live timeline in place of the one that was and no gap is ever shown: what was before is fetched again by paging back. A reader who was far up when the gap came is not kept where they were: the box then holds what came after the gap alone, and they reach the earlier messages by scrolling up, which fetches them again. A page of earlier messages that was on its way when the gap came is put in the timeline that was. `pageBack` then takes it back out of what the SDK knows of the room (`forgetPageOf`), since paging the live timeline would otherwise end where it met those messages, and the room would say it began there. What the user sends is kept apart from the timeline until the homeserver sends it back (`pendingEventOrdering` is detached, set in `run.ts`), so a message on its way is last whatever arrives meanwhile and survives the gap. It is kept in memory alone, so one that was not sent is gone when the page is loaded anew. A message fails at once when the homeserver cannot be reached or refuses it. One the homeserver answers with an error of its own, or with its limit on how fast a user writes, the SDK sends again by itself up to four times first, which is half a minute of "Sender ...". While one message of a room has failed the SDK sends no new one there, and when one fails it gives up on those waiting behind it. So of the messages of a room that were not sent, the first is the one that failed and the later were never tried, and each line says which it is (`sending` is `FAILED` or `HELD`). "Prøv igjen" is on the failed one alone and sends them all again in the order they were written (`resend`): the SDK sends them one after another and again gives up on the rest when one fails, so none goes before an earlier one. "Forkast" lets go of one, and the first of those left is then the one to send again. Nothing is sent again by itself. Its lines are the events in the order the homeserver gave them: a text message is its `body` as text, and never its `formatted_body`, and whatever is not shown yet is a note of what it is (`TimelineNote`), which `timelineWording.ts` puts into words. A file and a picture are still such a note. An event holds whatever its sender put in it, whatever the SDK's types say, and an edit gives another message whatever it carries, which the homeserver checks little of. So a value of an event is shown as a text only when it is one (`textOf`) and is never made one, a time that is none shows no time, and an event that cannot be read at all is the line of what is not shown, so no event keeps a room from opening. These are no line: the event that removes another, an edit and a reaction, which are shown with the message they are of, see what is done with a message below, and a member's new name or picture. `ChatTimeline` is the box that scrolls: it stays at its end while the reader is there, stays where the reader is as earlier lines are put in above, and fetches those as the reader nears the top. A screen reader is read what arrives after the room was opened from a log of its own beside the lines, since a log of every line would read out the earlier ones as they are fetched. A room is read when its end is before the reader in a tab that is shown: `markRead` then sends the homeserver a read receipt for the last message it has, once for each, which takes the unread away in every client of the user's and lets the others in the room see how far the user has read. Nothing here shows how far the others have. The SDK counts a receipt as given from when it is sent, so `markRead` asks what the homeserver itself has said. A receipt it could not be told of is not sent again by itself: it is sent the next time the end is seen, which is at the next scroll, the next line, or when the tab is shown again. A line is the same object until what it shows has changed, and the components of the lines are memoised, so a timeline that changes renders the lines that did, and a name the app gives later renders the lines that show it. The people of a room are shown as the app knows them: `chatUserOperations.readProfiles` gives the user's name and the picture `chatPictureOf` says the account has for the Matrix ids a room names, a hundred at a time (`useChatProfiles`), to whoever sees the users, and not for an archived user, whom only an admin sees. One the app does not name, such as the bot, is shown as the homeserver names them, and so is everyone until the app has answered and when it does not. The pictures are the app's own, so the content security policy lets no image in from the homeserver.
- **What is done with a message.** A message is answered, reacted to, given a new text and removed from its line, behind the one button "Handlinger" (`ChatTimelineLine`). All of it goes from the browser straight to the homeserver, as writing does, so no operation takes part. `watchRoomTimeline` reads what the events say of each other itself, in one pass over the timeline (`readingOf`), and not from what the SDK gathers: an edit and a reaction are kept by the message they are of, only where the timeline holds that message, and are no lines of their own. The timeline has no gaps, so it holds every edit of and reaction to a message it holds, and one of a message that is not loaded shows nowhere until that message is paged in. An answer (`m.in_reply_to`) says whom it answers and the beginning of that message's newest text, and leads to it. To a message the timeline does not hold, which is one paged out, lost at a gap or of another room, it says only that it answers an earlier message, and nothing is fetched for it. An edit (`m.replace`) counts only from the one who wrote the message, of a text message and as one, and the newest wins: the homeserver takes an edit of another's message, of a picture, and with anything as its new content, and none of those changes what is shown. A message that is edited says so. The user edits a text message of their own in the field where messages are written, which Escape lets go of. What was being written there is kept meanwhile and is back in the field when the edit is over (`ChatComposer`). The new text mentions those the message mentioned who still stand in it and those picked for it, and only one it adds is told of it. A reaction (`m.annotation`) is shown under its message, gathered by emoji with how many reacted and the first `NAMED_AT_MOST` of them, once for each person. Only a key that is one emoji as people see it counts (`isEmoji`): the homeserver takes any text of some hundred letters as one, and an emoji with more variation selectors, skin tones or hidden tags than it should have would show as a second button of another's emoji. A message shows the `REACTIONS_AT_MOST` emojis most have given, the first given first among as many, so no number of others hides the one many gave, and always the user's own besides, since it is theirs to take back. The user reacts with one of six emojis, or with one somebody else gave by pressing it, and pressing their own takes it back, which removes that event. The app has no emoji picker, so no other emoji is given from here. A message is removed by the one who wrote it, and by whom the room's levels let (`maySendRedactionForEvent`), which the admins of a space are in its rooms, after a question. It is then the line that says a message was removed, without its text. Nothing is asked of a message of the user's own before the sync has brought it back, so until then it is on its way and has no actions. A reaction, an edit and a removal show at once, before the homeserver has them. The SDK sends nothing in a room while something of it has failed, so one of these that fails is let go at once (`act`): what it changed is as it was, and the room says in a line that is read out that it was not done and why (`refusalWording`). A new text that was not taken is offered back there ("Rediger på nytt") and never put in the field by itself, since the user may be writing something else by then. `edit` and `remove` send nothing and give null where the line no longer lets the user, which is when the message is gone from the timeline, the room has become held up or the levels have changed: the room then says that it was not done, and a new text stays in the field. So only a message that failed holds a room up. While one does (`isHeldUp`), nothing is reacted to, edited or removed, since the SDK would not send it: the buttons are not there, and the actions of a line say that the message must be sent or let go first. An answer written meanwhile waits behind it as any message does. Every message is sent with `m.mentions`, which names nobody unless someone was picked. In the field an at sign and the beginning of a name suggest those who are in the room, by the names the app gives them, in the shared `DropdownPanel`: `members` asks the homeserver for them the first time, since the client loads members as they write. One who is picked is written as an at sign and their name, and is mentioned (`user_ids`) for as long as that stands in the text: `mentionsOf` in `mentions.ts` says whom a text mentions. One whose mention is deleted is forgotten, so nobody is mentioned by a name that is only written, and a name that another begins with is not mentioned by that other's mention. `@room` mentions the whole room (`room`), and is suggested to and sent from only one the room's levels let (`mayTriggerNotifOfType`), as the homeserver and the notifications count it. A message that mentions the user is marked and says so: one that names them, or the whole room from one who may. That is read from `m.mentions` of the message's newest content, and never from its text or its HTML. The homeserver counts no mention an edit added, so the mark and its count may differ there. Everything is done by keyboard too. Tab stops once among the lines, at the actions of the last message, and the arrow keys move from there to those of the others, so a long timeline is not a long way to the field. The button is named by who wrote, when and what, so moving between the lines reads them. The actions open with the focus on "Svar", after the reactions the message has, and hold everything the line offers, also what a pointer reaches on the line itself, which is a reaction's own button and the way to the message an answer answers. Escape closes them, and the focus is in the field once an answer is started, a text is edited or a message is removed.
- **Who is in a room.** Starting a conversation, answering an invitation, asking more in and leaving go from the browser straight to the homeserver, as everything a user does in the chat. `src/lib/chatSession/membership.ts` does them with the SDK, and the components in `src/app/_components/Chat/Membership/` are where the user does. What the homeserver was asked is known to the client when the sync brings it, and not when the homeserver answers, so each of them resolves once the client has it (`untilSync`), and a page that sends the browser on to a room finds the room there. The wait ends as a homeserver that was not reached when the client is found stopped, which is looked for between the syncs too, since a client stopped while it waits out a lost connection tells nobody. A room joined or left is waited for `SYNC_WAIT_MS` at the latest. A room that was made is waited for as long as the client runs, since the homeserver has it: giving up would lose the message that was to be written in it and let the user make it a second time. Nothing listens to the client once a wait has ended. Why the homeserver did not do something is one of three (`refusalOf`): it was not reached, it takes no more of the kind from the user for now, or it refused. `refusalWording` puts them into words, and `chatAction` makes such a call the action of a `Form`. A direct message is made by its first message (`startDirectMessage`): while two have no room, `/chat/messages/[username]` is where that message is written (`StartDirectMessage`), so nobody is asked into a room nothing is written in. The room is made with the homeserver's preset for a direct message, which asks the other in and gives them the standing its maker has, and is noted in the user's account (`m.direct`), which is what other clients such as Element know a direct message by and nothing here reads. A message written while the room is being made is written in that room, so two messages make one room. The message is sent once the client has the room, so a page that is closed or loaded anew in between leaves a room the other is asked into with nothing written in it, and the message is gone. One who declines before the client has counted them leaves the user in a room that is no direct message, where the message is written all the same. Two who write to each other for the first time at the same moment each make a room, and nothing makes one of the two: each then has an invitation from the other in their list, and of two direct messages the pages open the one last written in. The homeserver tells a client that loads the members of a room as they write of a room whole with those alone: one who is asked in and has not answered is counted and not named. So a direct message the user started is not known as the one with that user in a page that is loaded in a browser that has not seen it made. `watchWithInvited` in `invited.ts` asks for the members of each such room, once (`loadMembersIfNeeded`): for the list on `/chat`, which then calls the room by the one asked in, and for `watchDirectRoomWith`, which says `LOOKING` until the homeserver has answered for the rooms that may be the one with that user, so nobody is offered to start a direct message they have. An answer is waited for `INVITED_ANSWER_WAIT_MS` and no longer, so a homeserver that does not give the members keeps nobody from writing, at the price of a second room. An invitation is answered in the list on `/chat`, and one to a direct message on the page of that user too (`ChatInvitationAnswer`): accepting joins the room and declining leaves it (`joinRoom`, `leaveRoom`). An invitation carries the room's maker, name and who may join, and not who else is in it or who reads it, so one is called a direct message when its maker asked as into one, and the room may still turn out a group once the user is in it. `NewConversation` on `/chat` is where the user picks whom to write to: one person and no name leads to the direct message with them, and anything else is a group, which has a name and is made there (`startGroup`). Those to pick from are read by `chatUserOperations.readPage`, to whoever sees the users: the active students with an account on the chat, each with their Matrix id, and never the one who asks. `PickUsersPopUp` (`src/app/_components/User/UserList/`) is the pop-up users are picked in, and `AddUsersPopUp` of the spaces is built on it too. The homeserver takes ten invitations with a room that is made and refuses eleven, so no more than `MAX_INVITED_AT_ONCE` are picked at a time, and after about as many in a row it says to wait. `inviteToRoom` asks in one at a time, goes on past one the homeserver refuses, such as one who is in the room, and stops when it says to wait. The pop-up then says how many were asked in and whom the homeserver refused, and takes both out of the picked, so those still picked are the ones not asked in and asking again asks only them. `ChatRoomActions` is what an open room offers besides writing in it: the way back to where it is listed, asking more into a group where the room's levels let the user, and leaving. A room of a space opens at an address of its own under the spaces. Its page finds it among the rooms `readSpaces` lets the user into, so no other room is found there, and `/chat/rooms/[roomId]` sends the Matrix id of a space's room on to it. An open room is joined from that page (`JoinSpaceRoom`): the homeserver lets the members of the space in and the sync puts nobody there, so nobody is in one until they join, and it is left as any other room. A private room the sync puts those picked for it in, so its page only says to wait until it has, and it is not left from here, since the sync would put the user back. Nobody is asked into a room of a space from here and none is renamed: the homeserver refuses both from anyone but the bot. A room the sync has not put on the homeserver yet has a page that says so.
- **The chat sync.** The operations only write rows. The `chat` worker runs `syncChat` (`src/lib/chatSync/`) every 15 seconds, which makes the homeserver follow, so code changing a user's name or picture, a space or its members leaves the homeserver to it. It runs when `CHAT_HOMESERVER_URL`, `CHAT_SERVER_NAME`, `CHAT_AS_TOKEN`, `CHAT_MAS_URL` and `CHAT_MAS_CLIENT_SECRET` are set (`constants.ts`). `sync.ts` is the run: the accounts (`accounts.ts`) and then the spaces (`spaces.ts`). For a space it reads what the rows want and what the homeserver has, and `planSpaceChanges` in `spaceChanges.ts` turns the difference into a list of changes, which touches neither the database nor the homeserver. `client.ts` is the homeserver as the app acts on it, and `Homeserver` there is what the sync asks of it, which the tests answer with `tests/fakeHomeserver.ts`. A change the homeserver refuses does not stop a run: the rest is done, and the run throws at its end naming what was refused.
- **What the sync does and leaves.** An account gets its user's name and the picture `chatPictureOf` says it has, and a deleted user's account is deactivated and its picture deleted. `ChatUser.syncedName` and `syncedImageId` are what the account was last given, so only a change is sent, and a new name and a new picture in one call, since changes to one profile made right after each other race in Synapse. A picture is uploaded to the homeserver as the bot, as a jpeg of the image's small size: Synapse makes thumbnails of jpeg, png, gif and webp alone, and the sizes of an image are kept as avif. One the image worker has not resized yet, or that cannot be uploaded, waits for a later run and keeps no new name from the account. The account keeps the picture it has meanwhile, unless the image that one is of is deleted: then it is taken away at once. An upload whose account the homeserver then refuses to give it is kept in the worker's memory (`ungivenUploads` in `accounts.ts`), so a retry uploads the file again only when the worker has restarted. The sync deletes its own uploads from the homeserver once an account is no longer given them (`deletePicturesNoLongerGiven`): the picture it had before the one it has, the one it had before it had none, an upload it never got, and those of a deactivated account. `ChatUser.pictureUploads` holds every upload the sync has made for the account and not deleted, noted as it is made, and `syncedPictureUri` the one the account has, so the rest are deleted, and never a file a user put on the homeserver themselves. An upload leaves the list once it is gone, so a delete the homeserver refuses is tried again on the next run and holds nothing else back. Before it deletes for an account the sync asks the homeserver which picture the account shows: a profile the homeserver took whose row was never written leaves the account with a picture no row tells of. Such an account is given the picture its row tells of again, and the other is deleted only once it is. An account that has no picture here has none there: the one the sync gave it is taken away, and so is one its user set in the chat client, which Synapse lets a user without a picture do. No row tells of that one, so the sync asks the homeserver which accounts have a picture. Listing them is heavy for Synapse, so the client reuses the answer for `ACCOUNTS_WITH_PICTURE_REUSE_MS`, and waits as long after a listing that failed, and such a picture is taken away that much later. A space is created, named, given the members of its rows who have an account and are not archived, and emptied of anyone else. A room of a space is a `ChatSpaceRoom` row: the sync creates it as the bot, names it, lists it in the space and destroys it when the row is marked destroyed. The members of the space let themselves into its rooms, and whoever is in one without being in the space is taken out. An invitation counts as being in: the sync invites and then joins as the user, and takes back an invitation whose join failed once its holder is not to be there. A room that is destroyed is closed to the space's members before it is emptied. A private room (`ChatSpaceRoom.isPrivate`, chosen when it is made) is the exception: only those picked for it, its `ChatSpaceRoomMember` rows, are in it, the sync puts them there, and nobody else is shown it. A member removed from the space loses those rows with the membership. The space's admins hold `ROOM_MODERATOR_LEVEL` in its rooms, which removes what others wrote and pins messages. Every other change to a space or a room of one is the bot's, so nobody adds, removes or renames a room in the chat itself. Direct messages and group rooms outside the spaces are their makers' and the sync leaves them alone. A space has no picture yet.

### Company users

A company user is a person who acts for a company on the career site. It is an account of its own, the `CompanyUser` model, and not a `User`: it belongs to one company, has no memberships and holds no permissions beyond those of a visitor.

- **The session.** A session belongs to a user, to a company user or to no one, and never to two of them. `SessionType` in `src/auth/session/Session.ts` is typed so: a session with a `companyUser` has `user: null`, and only a session with a user has memberships, which are the empty list for the other two. `session.user` therefore still means an Omega user everywhere. `Session.fromToken` builds the session a cookie carries and is the one place the kind is decided.
- **Authorizing.** `Require` has `.companyUser()`, `.companyUserId()`, `.companyMember()` and `.companyAdmin()`. The company and whether the user is its admin are on the session, as memberships are, so the checks ask no database. A company user who is turned away gets `UNAUTHORIZED`, not `UNAUTHENTICATED`, and is not sent to the login. The career site's `/profile` sends a company user to their own page under the company.
- **Signing in.** A company user signs in with email and password on the career site alone, at `/career/company-login`. A visitor finds it under "Logg inn" in the career site's navigation, beside the student's login, and in its footer. NextAuth has a credentials provider of its own for them, `company-credentials`, beside the user's (`src/auth/nextAuth/companyCredentials.ts`). `loginProviders` in `authOptions.ts` is the one place that says where NextAuth offers each login: the company login on every domain that serves the career site, and the user's logins on the auth domain alone. With a dedicated auth domain, the career site's domain offers the company login and the auth domain the user's. Without one, Omega's main domain is the auth domain and serves the career site under `/career`, so it offers all three. The form is served on the career site, so NextAuth starts the session on the domain the visitor is on. Its `authorize` refuses a request that already carries a session. Feide has no part in it. The OpenID Connect provider and a site's start route treat a company user as not signed in, through `readUserSessionToken`, so the session never reaches another domain. The token is built in `companySessionTokenOf` and ends when the company user is deactivated, removed or ends their sessions, which a new password and a changed role do by bumping `CompanyUser.sessionEpoch`.
- **Accounts.** Choosing a password by mail and changing an email with verification are the same steps for a user and a company user. They are written once in `src/services/accountFlows/implement.ts` as `implementAccountFlows(kind)`, where a kind says where the account is stored, what its token audiences are and what its mails say. `userAccountFlows` in `src/services/auth/accountFlows.ts` is the user's and `companyUserAccountFlows` in `src/services/careers/companies/users/auth/accountFlows.ts` the company user's. Each kind has its own token audiences, so a token for one can never act on the other. A company user gets their first password from the same link that replaces a forgotten one, sent from their page under the company. On the frontend `implementAccountFlowComponents` mirrors it, bound once for each kind (see "Account flows on the frontend" above), and nothing under `(company-auth)` imports from `@/pageKits/auth`. A company user is signed in as soon as they have chosen a password, where a user is sent to the login.
- **Elsewhere.** A company user has no use of the other sites. Their layouts show `CompanyUserBand`, which leads back to the career site.

### Path Aliases

The project uses extensive TypeScript path aliases. See `tsconfig.json`:
- `@/lib/*` → `src/lib/*`
- `@/components/*` → `src/app/_components/*`
- `@/services/*` → `src/services/*`
- `@/prisma-pn-client-instance` → `src/prisma/client.ts`
- `@/prisma-generated-pn-client` → `generated/pn-prisma/client.ts`
- Many more domain-specific aliases

### Project Structure

```
src/
├── app/                    # Next.js app directory: pages, routes, layouts
│   ├── layout.tsx          # The document and the shared providers, no navigation or theme
│   ├── _components/        # Shared React components
│   ├── api/                # API routes, e.g. NextAuth
│   ├── (omegaweb)/         # Omega's site: its navigation and the user's theme
│   │   ├── admin/          # Admin pages
│   │   └── [feature]/      # Feature-specific pages
│   ├── (careers)/          # The career pages as their own site: own layout, theme and fonts
│   │   └── career/
│   └── (revue)/            # The revue pages as their own site, with RevueShell as their header and footer
│       └── revue/
│           ├── [year]/         # A revue's pages, painted with the theme revueThemeOf derives from its palette
│           └── (static-theme)/ # Every other page, painted with the static revueTheme
├── auth/                   # Authentication and authorization
│   ├── authorizer/         # Authorization classes
│   ├── session/            # Session management
│   └── nextAuth/           # NextAuth configuration
├── services/               # Business logic layer: ServiceOperations
│   ├── users/
│   ├── groups/
│   ├── cms/
│   └── [domain]/           # Domain-specific services
├── prisma/                 # Database
│   ├── schema/             # Prisma schema files, split by domain
│   ├── seeder/             # Database seeding
│   └── client.ts           # Prisma client instance
├── lib/                    # Utility libraries
│   ├── jwt/                # JWT token utilities
│   ├── dates/              # Date handling with Luxon
│   └── paging/             # Pagination utilities
├── contexts/               # React contexts
├── hooks/                  # React hooks
├── styles/                 # Global SCSS styles
└── typings/                # TypeScript type definitions

generated/
└── pn-prisma/              # Generated Prisma client
```

### CMS System

The project includes a custom CMS for content management:
- CMS components in `src/app/_components/Cms/`
- CMS services in `src/services/cms/`
- Articles, sections, paragraphs, images, and links as composable content parts
- Edit mode for authorized users

## Important Patterns

### Comment Style

This applies to every comment you write in code, not to this file's own prose.

- Be brief. Don't explain the obvious: only write a comment when it says something the code doesn't already show, such as a non-obvious reason, a hidden constraint, or a workaround.
- Avoid inserted asides, such as parentheses or em-dashes used mid-sentence. Write linear sentences instead, using a plain connecting word such as "which", "so", "since", or "for example".
- Keep a clear, linear structure: one idea per sentence, in the order the reader needs them.

### Server-Only Code

Files that must run only on the server import `'@ow-server-only'` at the top. This prevents accidental client-side execution of sensitive code.

### Awaitable callbacks

A callback whose result is only awaited is typed `Awaitable<T>` (`T | Promise<T>`, from `@/lib/awaitable`), so callers with nothing to wait for pass a plain function rather than an `async` one or `Promise.resolve(...)`. Keep `Promise<T>` only where the promise itself is needed (`.catch`, `prisma.$transaction`, a third-party type).

### Dates and Timezones

Server-side code (services, lib, server components) only ever works with real instants —
comparisons, storage and duration arithmetic via `Date`/`Date.now()`/`.getTime()`. It never reads
or constructs calendar/clock fields (day, month, hour, ...) through the host's local timezone: the
server always runs in UTC, so local fields there are meaningless. Display is the only place a
timezone matters, and it must always be explicit — normally `Europe/Oslo`, since almost everything
shown (event times, deadlines, transaction timestamps) is org-wide and must look the same to every
viewer, not shift with their device's zone. The one sanctioned exception is native HTML
`date`/`datetime-local` `<input>`s, which are inherently browser-local by the input itself
(`DateInput`/`displayDefaultInputValue.ts`).

- Never `new Date(year, month, day, ...)` — it reads its fields in the host's local timezone.
  Use an ISO string, `Date.UTC(...)`, instant arithmetic (`Date.now() + ms`), or Luxon's `DateTime`.
- Never call local getters (`getDate`, `getMonth`, `getFullYear`, `getHours`, `getMinutes`,
  `getSeconds`, `getDay`) in `src/services/**` or `src/lib/**` — use the `getUTC*` equivalents, or
  `osloDateTime(date)` from `@/lib/dates/oslo` (a Luxon `DateTime` fixed to Europe/Oslo) when you
  need individual fields for display.
- Never call `.toLocaleString()`/`.toLocaleDateString()`/`.toLocaleTimeString()` without an explicit
  `timeZone` — use `displayDate(date)` from `@/lib/dates/displayDate` for a ready-made Norwegian
  string, or pass `{ timeZone: 'Europe/Oslo' }` yourself.

All three are enforced by ESLint at `error` severity (`eslint.config.ts`). See the wiki's
"Dates and Timezones" page for the full rationale.

### Concurrency

Pick the simplest mechanism that satisfies the requirement, from the top of this list down - never
reach for a stronger one "just in case" once a simpler one already works.

| Requirement | Mechanism |
|---|---|
| An invariant the database can enforce directly (uniqueness, a foreign key, a `CHECK`) | A database constraint, not application logic |
| A single read-modify-write that can be expressed as one statement | An atomic SQL statement, not a separate read then write |
| Protecting specific existing rows for the rest of a transaction | A row lock (`SELECT ... FOR UPDATE`) |
| Coordinating work or a logical resource with no row to lock | An advisory lock (`takeAdvisoryLock`/`takeAdvisoryLockOnId`, `src/lib/advisoryLocks.ts`) |
| Correctness depends on the relationship between several reads and writes, not just on protecting individual rows | A stronger isolation level (`SERIALIZABLE`), possibly alongside row locks |
| Keeping two related writes consistent with each other | One database transaction, with the right constraints |

- Keep transactions short: locks are held until the transaction ends, and a long transaction increases
  contention for everyone else.
- Retry correctly: handle a serialization failure (Postgres `40001`) or a deadlock (`40P01`) by
  retrying the whole transaction where that is the right response, not by surfacing it as a user error.
- Acquire multiple locks in a consistent order (e.g. ascending id) to avoid deadlocks.

### Error Handling

- Service operations use custom error classes from `src/services/error.ts`
- `Smorekopp`: base error class for service errors
- `ParseError`: validation and parsing errors
- Error handling is managed internally by the ServiceOperation system via `makeAction()`

### Calling Services from the Frontend

**IMPORTANT**: client components (`'use client'`) must NEVER import from `operations.ts`. They call server actions from `actions.ts`. Operations are server-only: they build on `serviceOperation.ts`, which imports `'@ow-server-only'`.

Server components do the opposite: pages, layouts and other server components import from `operations.ts` and call operations directly, not through actions. A read action exists only when a client component needs it, so don't add one for a page.

#### Pages: `serverPage`

Pages are built with `serverPage` from `@/app/ServerPage`. The example below is trimmed from `src/app/(omegaweb)/news/[nameAndId]/page.tsx`:

```tsx
import { newsOperations } from '@/services/news/operations'
import { newsAuth } from '@/services/news/auth'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string }>) => {
        const news = await newsOperations.read({
            params: { id: decodeVevenUriHandleError(params.nameAndId) },
        })
        const doubleLevelVisibility = await withFallback(
            newsOperations.visibility.readDoubleLevelMatrix({ params: { id: news.id } }),
            null
        )
        return { news, doubleLevelVisibility }
    },
    capabilities: (data) => ({
        canEdit: newsAuth.updateArticle.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY
        }),
    }),
    metadata: (data) => ({ title: data.news.article.name }),
    render: ({ data, capabilities }) => (
        <Article article={data.news.article} capabilities={capabilities} />
    ),
})

export default page
export { generateMetadata }
```

- `operation` loads everything the page needs. It runs inside a service context seeded with the request's session, so operations called in it pick the session up without it being passed. It runs once per request, shared by the page and `generateMetadata`.
- A service error thrown from `operation` renders `ServiceErrorView` in place of the page; `NOT FOUND` becomes `notFound()` and `UNAUTHENTICATED` redirects to login. Wrap calls whose failure should not take the page down in `withFallback(promise, fallback)`. It falls back on every service error; pass the error codes as a third argument to fall back only on those, for example `withFallback(promise, null, ['NOT FOUND'])`.
- Access to the page is decided in `operation`, by the authorizers of the operations it calls, or explicitly: admin pages call `authorizeAdminPage(path, session)`. `capabilities` does not guard the page. It declares what the user may do on it under `can[Something]` keys, and `render` receives the results as `capabilities`. See [Capabilities](#capabilities).
- The page title comes from `metadata`. Don't render `PageTitleSetter` in a page built with `serverPage`.
- A logged-in user who has not finished registering (accepted the terms on `/register`) is sent there by `serverPage` and `serverLayout` before `operation` runs. Only the registration pages pass `allowUnregistered: true`.
- A page is served on its site. Only the pages of the auth kit pass `servedOn: 'auth-domain'`, see [Authentication](#authentication). A request on a domain that does not serve the page is redirected before anything else runs. Every page is built with `serverPage` for that reason too, also one that loads nothing; the logout page is the one exception and sends the request on itself.
- A page's `params` do not hold a dynamic segment as the visitor would read it: Next decodes it and encodes it again with `encodeURIComponent`, while a route handler's are decoded. So a page decodes free text with `decodeURIComponent`, a page under `[username]` with `usernameOfPage(params)` from `src/app/(omegaweb)/links.ts`, and a link puts it in the path with `encodeURIComponent`, as `omegaLinks.user` and `chatLinks.directMessage` do.

#### Layouts: `serverLayout`

Layouts that load data are built with `serverLayout`, also from `@/app/ServerPage`. It works like `serverPage` for layouts. The operation gets `params` and `session`; layouts have no `searchParams`. `render` also receives `children`:

```tsx
export default serverLayout({
    operation: ({ params }: LayoutOperationArgs<{ category: string }>) =>
        articleCategoryOperations.read({ params: { name: decodeURIComponent(params.category) } }),
    render: ({ data: category, children }) => <SideBar category={category}>{children}</SideBar>,
})
```

A layout needs it even when every page under it uses `serverPage`: an error thrown by a layout is not caught by the pages it wraps. Without `serverLayout`, an expected service error, such as an unknown committee, ends up in the error boundary instead of becoming a 404.

The root layout is the exception. It renders the document itself, so it has nothing to show an error view in. It uses `withPageSession` and wraps every read in `withFallback`.

#### Other server components: `withPageSession`

Server components rendered inside a page, such as cards or sections, wrap their operation calls in `withPageSession(async session => ...)` from `@/app/ServerPage`. This sets up the same service context. Errors are not handled there. Wrap calls in `withFallback`, catch them with `handleServiceError`, or let them reach the error boundary.

#### Actions in client components

Action call signatures depend on whether the operation has `paramsSchema`, `dataSchema`, or both:
- No schemas → `action()`
- `paramsSchema` only → `action({ params: { ... } })`
- `dataSchema` only → `action({ data: { ... } })` or `action(formData)`
- Both → `action({ params: { ... } }, { data: { ... } })`

### Authorization in Client Components

In `'use client'` components, use the `useAuthorizer` hook from `@/hooks/useAuthorizer` instead of calling `useSession()` and checking `session.loading` manually. It handles the loading state internally and returns an `AuthResult` with an `authorized` boolean:

```typescript
import useAuthorizer from '@/hooks/useAuthorizer'
import { someAuth } from '@/services/some/auth'

const canDoThing = useAuthorizer({ authorizer: someAuth.operation.data({ userId }) }).authorized
```

Never do this manually in client components:
```typescript
const session = useSession()
const canDoThing = !session.loading && someAuth.operation.data({ userId }).auth(session.session).authorized
```

### Capabilities

What the user may do on a page is declared as capabilities: `can[Something]` keys mapped to authorizers, run against the session into `AuthResult`s. The types and helpers live in `src/auth/authorizer/capabilities.ts`.

- Pages and layouts declare capabilities in `serverPage`/`serverLayout`'s `capabilities: (data, session) => ({ canEdit: fooAuth.update.data({ ... }) })`, and read them in `render` as `capabilities.canEdit.authorized`. A rule that needs the session's own user takes the `session` argument, for example `session.user ? fooAuth.create.data({ userId: session.user.id }) : Require.user()`. Don't run `.auth(session)` inline in `render`.
- Server components take one `capabilities: Capabilities<'canEdit' | 'canDestroy'>` prop and read `capabilities.canEdit.authorized`. Never destructure it, and never take `session` to run authorizers in the component, and never take a boolean per ability. A parent passes its own object on when the keys match, as in `capabilities={capabilities}`. It maps them otherwise, as in `capabilities={{ canEdit: capabilities.canEditParagraph }}`. It builds them per item of a list with `runCapabilities(session, { ... })`.
- Client components choose. They run the rule themselves with `useAuthorizer`/`useEditMode({ authorizer })` when they know it; the parent passes the ids the rule needs, such as `groupId`. Or they take `capabilities: CapabilitiesJsObject<'canEdit'>` when the rule belongs to whoever renders them, such as the CMS editors, where whether a paragraph may be edited is the owning service's rule. The server side hands those over with `capabilitiesToJsObject(capabilities)`, since an `AuthResult` is a class instance and cannot cross to the client as it is.

### Operation Naming Conventions

For every `defineOperation()` call, the operation key must align with its schema and authorizer keys:

- `dataSchema` comes from `fooSchemas.data` and `paramsSchema` from `fooSchemas.params`, one `fooSchemas` object exported from `schemas.ts`. The key must match the operation name exactly. For example, operation `destroyFoo` uses `fooSchemas.data.destroyFoo` and `fooSchemas.params.destroyFoo`, not `fooSchemas.data.createFoo`. The `implementationParamsSchema` of an implemented sub-operation goes in `fooSchemas.params` too, under the key of the operation it implements. Sub-operations whose schemas are built from implementation fields are the exception: those stay in `defineSubOperation`. A service with no data schemas has no `data` key, and vice versa.
- `authorizer` must reference the same operation name. For example, `fooAuth.destroyFoo`, not `fooAuth.createFoo`.

Data and params are different kinds of input and have separate field objects in `schemas.ts`: `fooSchemas.data` picks from `dataFieldSchemas`, what a user writes, trimmed, length-checked and form-coerced, and `fooSchemas.params` picks from `paramsFieldSchemas`, what identifies the thing acted on, such as ids, names used as keys, or cursors. Params have looser rules, since a lookup that finds nothing is a NOT FOUND, not a validation error. A field such as `name` may appear in both with different rules; never pick a params schema from `dataFieldSchemas` or the other way round. When operations share the same shape, define a shared variable and reference it from each key:

```typescript
// schemas.ts
const fooRelation = paramsFieldSchemas.pick({ userId: true, groupId: true })

export const fooSchemas = {
    params: {
        createFoo: fooRelation,
        destroyFoo: fooRelation,
    },
}
```

Another service that validates the same kind of input (the auth service taking an email the way the users service does) imports the field object, exported under its service's name (`userDataFieldSchemas`), rather than re-declaring the rule.

### Form Handling

Forms typically use Server Actions with FormData:
1. Define a dataSchema using `zod-form-data`, imported as `zfd`
2. Create a ServiceOperation with the schema
3. Wrap it with `makeAction()`
4. Call from a client component with FormData

A long form is split with `Tabs` and `FormTab`: the one `Form` holds every value across its tabs and saves them together, and a tab with a refused input is brought forward. See `EventAdmin`. Panels stay mounted, so nothing is lost moving between tabs. A `Form` cannot hold another `Form`, so a tab that saves on its own is a `TabPanel` next to it.

## Testing

- Tests located in `tests/` directory
- Custom Prisma test environment: `tests/PrismaTestEnvironment.ts`
- Test setup in `tests/setup.ts`
- Use `IGNORE_SERVER_ONLY=true` environment variable when running tests
- Use full variable names in callbacks. Single-letter identifiers are not allowed, per the ESLint `id-length` rule. Use the domain name itself, such as `group => group.id` or `user => user.id`, as long as there are no collisions.
