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

A service is written in one of two forms while the services are moved from the one above to the contract form. In the contract form an operation is declared once, as an entry of `contract.ts`, and its operation, its action and what the frontend imports are made from that entry. Its actions and capabilities are not in the service: they are how the frontend reaches it, as an API route is, and live under `src/app/_capabilities/`, in a tree that mirrors `src/services/`. See `src/services/omegaquotes/` and `src/app/_capabilities/omegaquotes/`.

**Contract form:**
```typescript
// schemas.ts
export const fooDataFieldSchemas = z.object({ name: z.string().trim().min(2).max(40) })
export const fooParamsFieldSchemas = z.object({ id: z.number() })

// contract.ts
export const fooContract = defineContract({
  update: {
    params: fooParamsFieldSchemas.pick({ id: true }),
    data: fooDataFieldSchemas.pick({ name: true }),
    authorizer: Require.permission('FOO_ADMIN').or().userId(),
  },
})

// operations.ts
export const fooOperations = {
  update: defineOperation(fooContract.update, {
    authorizerData: async ({ params, prisma }) => {
      const foo = await prisma.foo.findUniqueOrThrow({ where: { id: params.id }, select: { ownerId: true } })
      return { userId: foo.ownerId }
    },
    operation: async ({ params, data, session, prisma }) => {
      // Business logic here
    },
  }),
} as const

// src/app/_capabilities/foo/actions.ts
export const updateFooAction = makeAction(fooOperations.update)

// src/app/_capabilities/foo/capabilities.ts
export const fooCapabilities = defineCapabilities(fooContract, {
  update: updateFooAction,
})
```

- **`defineContract`**, from `src/services/serviceContract.ts`, takes an entry per operation: its `params` schema and its `data` schema, each left out when the operation takes none, and `authorizer`, its rule. `contract.ts` imports nothing of the server, so the browser can import it too.
- **`defineOperation(entry, { authorizerData?, operation })`** makes the operation of an entry. Its schemas and its rule are the entry's, so it cannot run another rule than its own. `authorizerData` returns the data the rule still needs, and may read the database. Leaving it out is a type error when the rule needs data, and so is giving it when the rule needs none. It may return more than the rule needs, but never a `session`. `transaction` is the flag of the other form, and gives `operation` the client it says.
- **`defineCapabilities(contract, actions)`** joins the contract with its actions, by key. An action made from another entry, from another contract or from no entry is a type error, except between two contracts of the very same type, such as two with only a `readAll` behind a permission, which the compiler cannot tell apart. The result has every key of the contract, each with `params`, `data`, `authorizer` and `action`, which is `undefined` for an operation given no action.
- A service's `contract.ts` is imported by the service's own files and by its capabilities file under `_capabilities`, and by nothing else, except a sub-contract, which the contracts that implement it import too. See [Sub-operations, ownership checks and internal calls](#sub-operations-ownership-checks-and-internal-calls). The frontend imports from `@/capabilities/...`: a page, a component or the navigation reads a rule as `fooCapabilities.update.authorizer` and an action as `fooCapabilities.update.action`. An action given to no capability, such as the read a paging context calls, is imported from the `actions.ts` beside it.

### Authorizers

Rules are written once as `Require` chains, in a service's `auth.ts` or in the entries of its `contract.ts`. The same rule runs on the server, inside the operation, and on the frontend, with `useAuthorizer`. `operations.ts` only supplies data to a rule, with `.data({...})` or through `authorizerData`. It never builds a `Require` chain itself.

- **Conditions:** `.permission('X')`, `.user()`, and `.userField()` take no extra data. `.userId()` needs `{ userId }`. `.groupAdmin()` needs `{ groupId }`. `.companyUser()` takes none, `.companyUserId()` needs `{ companyUserId }`, and `.companyMember()` and `.companyAdmin()` need `{ companyId }`; see [Company users](#company-users). `.levelOfDoubleVisibility({ level })` needs `{ visibility }`. `.ownership<Data>(check)` and `.custom<Data>(check)` let the caller define the check. `.visibilityFilter()` attaches a Prisma `where` filter to a list query instead of denying it. `.nothing()` means the operation has no access rule.
- **Combining:** conditions in a chain are ANDed; `.or()` starts a new OR'd group. `.anyOf(...)` and `.allOf(...)` combine already-built chains. `chain.allOf(extra)` only extends the last group of `chain`; use `Require.allOf(chain, extra)` to require `extra` on every branch.
- **Data:** a chain that needs data, such as `userId` or `groupId`, is a type error until `.data({...})` has supplied all of it. Rules that need data from the database fetch it in the operation's `authorizer`. The authorizer may be async and receives `prisma`; it then calls `.data()`. An operation made from a contract entry returns the data from `authorizerData` instead. A `session` among the data is never used: a rule checks the session it is run for.

### Sub-operations, ownership checks and internal calls

- **`defineSubOperation`** defines an operation for a sub-service, such as CMS paragraphs, images, or links, that other services embed. It has no authorizer of its own. Its schemas and `operation` are functions, so an implementer can pass implementation fields.
- **`.implement({ authorizer, ownershipCheck, beforeRun? })`** turns a sub-operation into a callable operation for one owning service. For example, `companyOperations` implements `cmsImageOperations.update` for a company's logo.
  - `authorizer`: may this user act on the owning resource?
  - `ownershipCheck`: does the sub-resource actually belong to the owning resource? For example, is the paragraph the career page's special paragraph? Returning false rejects the call. This is resource-to-resource integrity, not user permission.
  - `beforeRun`: optional extra checks that run after both and may throw.
- **A sub-contract** is the contract form of a sub-service: `defineSubContract` in its `contract.ts` holds an entry per sub-operation, with its `params` and `data` schemas and no rule. Only `cmsParagraphContract.updateContent` has one yet, and every other sub-operation is written in the form above. The sub-operation is made from its entry with `defineSubOperation(entry, { operation })`. An owner implements the entry in its own contract with `subEntry.implement({ implementationParams?, authorizer })`, which adds its rule and, when it has them, its implementation params, and makes its operation from that entry with `subOperation.implement(ownerEntry, { authorizerData?, ownershipCheck })`. So the owner's operation runs its entry's rule, and `authorizerData` is required, refused and checked as for a plain operation, and is given the implementation params too. An entry implemented from another sub-entry, a plain entry and an implemented entry given to `defineOperation` are type errors. The sub-operation still takes `.implement({ authorizer, ownershipCheck })` beside it, for the owners not yet moved. See `careers/team/contract.ts`. A rule given to `subEntry.implement` is a const, as every rule in an `auth.ts` is, since one written there with a check of its own, such as `Require.filter(...)`, loses the type of its data.
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
├── constants.ts    # Domain constants and config values: env vars, field selections
├── contract.ts     # defineContract(): the schemas and the rule of each operation
├── operations.ts   # defineOperation() calls, exported as `{ ... } as const`
├── schemas.ts      # Plain Zod schemas: the field objects the contract picks from
└── types.ts        # TypeScript types specific to this domain, if needed

src/app/_capabilities/[domain]/
├── actions.ts      # 'use server': makeAction() wrappers, one per operation
└── capabilities.ts # defineCapabilities(): the contract joined with its actions, for the frontend
```

A service not yet moved to the contract form has no `contract.ts` and no `capabilities.ts`. Its `actions.ts` is in the service's own folder, its rules are in `auth.ts`, as `Require` chains shared with the frontend, and its `schemas.ts` also exports `fooSchemas.data` and `fooSchemas.params`, keyed by operation. See [Service Layer Pattern](#service-layer-pattern).

Rules:
- **`constants.ts`**: not `ConfigVars.ts` or any other name
- **`operations.ts`**: the exported object must end with `as const`
- **`schemas.ts`**: holds every `dataSchema` and `paramsSchema` the service's operations use, or in the contract form the field objects its entries pick from. See [Operation Naming Conventions](#operation-naming-conventions). No schema is defined inline in `operations.ts`.
- **`contract.ts`**: imported only by the files of its own service, as `./contract`, and by its capabilities file. ESLint refuses it anywhere else, by any alias that reaches it (`@/services`, `@/careers`, `@/cms`), except a sub-contract in another service's `contract.ts`, which only an owner that implements it imports. A new sub-contract is added to `subContracts` in `eslint.config.ts`.
- **`actions.ts`**: must have `'use server'` at the top; only calls `makeAction()`
- Sub-domains, such as `mail/alias/`, follow the same layout within their subfolder, also under `_capabilities`

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

### Chat

The chat is a Matrix homeserver outside this repo, in chat-infrastructure. The code uses Matrix's words: a space is a group of rooms with a member list, a room is where messages are written, and the homeserver is the whole installation.

- **Signing in.** The chat signs its users in through the provider on the auth domain. Its sign in service, MAS, is a client there, named by the host of `CHAT_AUTH_URL` (`src/services/chat/constants.ts`). Left unset, there is no chat.
- **Chat users.** A user's account on the chat is a `ChatUser` row (`src/services/chat/users/`), and a user without one is not on the chat. Signing in to the chat is what gives a user theirs: the chat client of the provider has `beforeCode`, which calls `chatUserOperations.optIn` before the code is issued. No other code creates one.
- **The localpart.** `ChatUser.localpart` is what stands before the colon in the user's Matrix id. It is made from the username once (`localpart.ts`) and never changes, since Matrix does not let it. The token tells MAS which it is, as the claim `chat_localpart` of the `chat` scope, which only the chat's sign in is given. So this app decides what a user is called on the homeserver, and the homeserver never names one itself. A deleted user's `ChatUser` stays, without a user: that is what tells the sync to deactivate the account, and it keeps the localpart from ever being another user's.
- **Chat spaces.** A space is a `ChatSpace` row and its members `ChatSpaceMember` rows, kept by the sub-service in `src/services/chat/spaces/`. A service that owns spaces gets its operations from `implementChatSpaces({ purpose, implementationParamsSchema, authorizers, ownershipCheck })`: `read`, `readMembers`, `update`, `destroy`, `addMembers` and `removeMembers`, and for the rooms of a space `readRooms`, `createRoom`, `updateRoom`, `destroyRoom`, and `addRoomMembers` and `removeRoomMembers` for a private room, guarded by its own authorizers and refusing a space that is another owner's, and under `internal` the sub-operation `create`, which it calls in the transaction that writes its own row, and `read`, `readRooms`, `readMembers`, `update` and `destroy` for its own server code. Only users with a `ChatUser` can be members, and `readAddableUsers` reads them a page at a time for whoever sets a space's members: the picker in `AddUsersPopUp` reads from it, through `UserDetails.readPage`, and not from the user list's own partitions, which show a former student to a user admin alone. `SpaceAdmin` (`src/app/_components/Chat/SpaceAdmin/`) is where a space's name, rooms and members are managed. It knows no owner: the owner's page hands it its own actions as `actions`, typed `ChatSpaceAdminActions` in `types.ts`, with its implementation params bound, and an action left out is not offered. Who administers a space is never stored: the owner adds how its admins are read to `chatSpaceAdmins` in `admins.ts`, by its purpose, and the sync asks on every run. The owner may also name those a space has as members without anyone adding them, in `chatSpaceStandingMembers` beside it: the sync gives each a member row and takes none away, so one who is named no longer stays until they are removed.
- **A space's notification channels.** A space has two channels, `ChatSpace.mentionsNotificationChannelId` and `allNotificationChannelId`, with the purposes `CHAT_SPACE_MENTIONS` and `CHAT_SPACE_ALL`: one for the messages that mention a user and one for every other message in its rooms. Neither offers the weekly mail: mentions offer mail and push, and every other message push alone. They sit under the special channel `CHAT` (`src/services/chat/chatNotificationChannel.ts`) and are kept by `chatSpaceNotificationOperations` in `src/services/chat/spaces/notifications/`, which says once what a channel of each purpose is, as `channels` to `implementNotificationChannelsForPurpose`: the special channel it sits under, its description and the methods it offers. Making one is then `internal.createAsConfigured` with its name, as an event's channels are made too. The sub-service calls its `internal` operations: the channels are made with the space, renamed with it, and removed by the chat sync when it deletes the space's row. A test makes a space with `createChatSpace` from `tests/chatSpaces.ts`, since a row made by hand has no channels. Nothing is sent in them yet.
- **Hearing from the homeserver.** The app is the homeserver's application service, so Synapse sends it every event in every room, at `/api/chat/appservice` (`CHAT_APPSERVICE_PATH`), signed with `CHAT_HS_TOKEN`. The route under `src/app/api/chat/appservice/` answers the transactions of Matrix's application service api and nothing else, and the proxy lets it through for a host that is no site's, since the homeserver asks by the app's name inside the cluster. `chatAppserviceOperations.receiveTransaction` (`src/services/chat/appservice/`) keeps the messages as `ChatRoomMessage` rows, with who wrote, where and who is mentioned, and never what is said: those written in the rooms of the spaces by their room, and those written outside every space, in direct messages and the group rooms users make themselves, by the Matrix room they were written in (`standaloneMatrixRoomId`), since the app keeps no row for such a room. Everything else is let go: edits, and what is written in the room a space itself is or in a room being destroyed. A message that is removed before it is notified of is forgotten. Without the token set, nothing is taken, and production refuses to start on the development token. The chat sync then makes a notification of each kept message (`notifyOfMessages` in `src/lib/chatSync/messages.ts`): one that mentions someone goes in the space's channel for mentions, to those mentioned, and any other in its channel for every message, to the others in the room. It asks the homeserver who is in the room, so nobody outside it is notified, and the one who wrote never is. A mention of the whole room counts only from one the room's levels let mention it, which is a moderator, and is any other message otherwise. A message is notified of within the hour or not at all: one that keeps failing, and what piled up while the homeserver or the worker was away, is let go. A notification says who wrote and where, and leads to the user's chat page. Outside the spaces there is one channel for everything, the special channel `CHAT_DIRECT_AND_GROUP` under `CHAT` (`src/services/chat/directAndGroupNotificationChannel.ts`), which offers mail and push. What one user wrote in one room since the last run is one notification there, to the others in the room and to those invited to it, since one who is written to for the first time is not in the room yet. The bot is in no such room, so the sync reads it as an admin of the homeserver (`readStandaloneRoom`). A room of two without a name is a direct message, "skrev til deg", and any other a group.
- **A committee's chat space.** A committee may have one space, `Committee.chatSpaceId`, kept by `committeeChatSpaceOperations` in `src/services/groups/committees/chatSpace.ts`. An active admin of the committee or `COMMITTEE_ADMIN` creates it, destroys it and manages its rooms and members. It is named for the committee and follows its name, and is destroyed with it. Its standing members are the committee's active members and its admins the active admins (`chatSpaceRoles.ts`), so a new member is in the space and a new leader moderates its rooms without anyone touching the chat. A membership that ends takes nobody out: they stay until they are removed on the committee's chat page. That page is `/committees/[shortName]/chat`: it mounts `SpaceAdmin` for the rooms with the committee's actions, and shows the people the committee's own way in its `membersSection`.
- **Manual chat spaces.** A space that is no committee's is a manual one, kept by a service of its own, `src/services/manualChat/`, which implements the chat spaces as the committees do. `MANUAL_CHAT_SPACE_ADMIN` creates, renames and destroys them and picks each space's admins, the `ManualChatSpaceAdmin` rows. An admin sets the space's members and rooms and moderates its rooms, and changes nothing else about it. The spaces are listed and made at `/admin/chat-spaces`, and one is managed at `/admin/chat-spaces/[spaceId]`, which mounts `SpaceAdmin` with the service's actions, and beside it who the admins are. That page is guarded by the service's own rule and not by the admin navigation, since a space's admins need hold no permission. A user finds the spaces they are an admin of on their own chat page.
- **A user's chat page.** `/users/[username]/chat` is theirs alone: a link to the chat client, whose origin is `CHAT_CLIENT_URL` (`chatClientOrigin` in `src/services/chat/constants.ts`, left unset there is no link), their subscription to the `CHAT` channel and to the one for direct messages and group rooms under it, and the spaces they are in (`chatUserOperations.readSpaces`), each with their subscription to its two notification channels, all set with the same `UpdateNotificationSubscription` as on the notifications page. Neither channel is given a subscription when someone joins a space: both follow the channels above, so a user who wants nothing from the chat turns the `CHAT` channel off with its sub-channels.
- **The chat sync.** The operations only write rows. The `chat` worker runs `syncChat` (`src/lib/chatSync/`) every 15 seconds, which makes the homeserver follow, so code changing a user's name, a space or its members leaves the homeserver to it. It runs when `CHAT_HOMESERVER_URL`, `CHAT_SERVER_NAME`, `CHAT_AS_TOKEN`, `CHAT_MAS_URL` and `CHAT_MAS_CLIENT_SECRET` are set (`constants.ts`). `sync.ts` is the run: the accounts (`accounts.ts`) and then the spaces (`spaces.ts`). For a space it reads what the rows want and what the homeserver has, and `planSpaceChanges` in `spaceChanges.ts` turns the difference into a list of changes, which touches neither the database nor the homeserver. `client.ts` is the homeserver as the app acts on it, and `Homeserver` there is what the sync asks of it, which the tests answer with `tests/fakeHomeserver.ts`. A change the homeserver refuses does not stop a run: the rest is done, and the run throws at its end naming what was refused.
- **What the sync does and leaves.** An account gets its user's name, and a deleted user's account is deactivated. A space is created, named, given the members of its rows who have an account and are not archived, and emptied of anyone else. A room of a space is a `ChatSpaceRoom` row: the sync creates it as the bot, names it, lists it in the space and destroys it when the row is marked destroyed. The members of the space let themselves into its rooms, and whoever is in one without being in the space is taken out. An invitation counts as being in: the sync invites and then joins as the user, and takes back an invitation whose join failed once its holder is not to be there. A room that is destroyed is closed to the space's members before it is emptied. A private room (`ChatSpaceRoom.isPrivate`, chosen when it is made) is the exception: only those picked for it, its `ChatSpaceRoomMember` rows, are in it, the sync puts them there, and nobody else is shown it. A member removed from the space loses those rows with the membership. The space's admins hold `ROOM_MODERATOR_LEVEL` in its rooms, which removes what others wrote and pins messages. Every other change to a space or a room of one is the bot's, so nobody adds, removes or renames a room in the chat itself. Direct messages and group rooms outside the spaces are their makers' and the sync leaves them alone. It does not set pictures yet.

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
- `@/capabilities/*` → `src/app/_capabilities/*`
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
│   ├── _capabilities/      # Actions and capabilities of the services in the contract form, in a tree that mirrors services/
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
- **A paragraph is markdown, and the server makes its html.** Its update takes `markdown`, stores it in `contentMd`, and stores in `contentHtml` what `markdownToSafeHtml` makes of it, which drops raw html. Before anything parses it, its schema refuses markdown over `paragraphMarkdownLimits` (`cms/paragraphs/constants.ts`, checked by `costlyMarkdownIssue` in `src/lib/markdown/markdownCost.ts`): its length, its lines, the lines of one block and how deep a line with a list or quote marker nests, where the parser's time grows faster than the markdown. These lower what a save can cost and do not bound it: markdown within them can still take more than a minute to render, and a bound needs a time budget, which is not built yet. A markdown whose html would be longer than `maxContentHtmlLength` is refused too, measured on the parsed markdown before its html is made, since a link definition used many times repeats its address and title. The editor shows why a save was refused. The markdown is CommonMark with GitHub's strikethrough of two tildes, which the server renders with `{ strikethrough: true }`. The rich text editor (`CmsParagraphEditorForm`, tiptap) starts from `contentMd` and sends markdown, made by `src/lib/markdown/editorMarkdown.ts`, which escapes text so that what is typed is stored as typed. Markdown has no empty paragraph, so a blank line typed in the editor is not stored, and is gone after a reload, from the editor and from the page. A paragraph imported as html has no `contentMd`: the editor starts from its sanitized `contentHtml` (`paragraphEditorContent`), and it is markdown from its first save. That html is why `CmsParagraph` sanitizes `contentHtml` again when it shows it.
- **The editor gets no feature markdown cannot say**, such as underline, colours or tables, since the markdown is what is stored. A feature that markdown can say is added to both directions of `editorMarkdown.ts` and to the syntax the server renders.

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

**IMPORTANT**: client components (`'use client'`) must NEVER import from `operations.ts`. They call server actions from `actions.ts`, which is in the service's folder, or for a service in the contract form in `src/app/_capabilities/[domain]/`, where `capabilities.ts` beside it holds each action with its rule. Operations are server-only: they build on `serviceOperation.ts`, which imports `'@ow-server-only'`.

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

For a service in the contract form the rule is `someCapabilities.operation.authorizer`, from `@/capabilities/some/capabilities`.

`useCapability` from `@/hooks/useCapability` decides a whole capability: whether the user may, by its rule, and its action with the params bound. A declared form calls it for its submitter, see [Form Handling](#form-handling):

```typescript
const create = useCapability(someCapabilities.create, { params: { groupId }, authorizerData: { userId } })
```

Never do this manually in client components:
```typescript
const session = useSession()
const canDoThing = !session.loading && someAuth.operation.data({ userId }).auth(session.session).authorized
```

### Capabilities

What the user may do on a page is declared as capabilities: `can[Something]` keys mapped to authorizers, run against the session into `AuthResult`s. The types and helpers live in `src/auth/authorizer/capabilities.ts`. A `capabilities.ts` under `src/app/_capabilities/` is not this: it holds what a service declares for each of its operations, and a page takes a rule from it, as in `canCreate: fooCapabilities.create.authorizer`.

- Pages and layouts declare capabilities in `serverPage`/`serverLayout`'s `capabilities: (data, session) => ({ canEdit: fooAuth.update.data({ ... }) })`, and read them in `render` as `capabilities.canEdit.authorized`. A rule that needs the session's own user takes the `session` argument, for example `session.user ? fooAuth.create.data({ userId: session.user.id }) : Require.user()`. Don't run `.auth(session)` inline in `render`.
- Server components take one `capabilities: Capabilities<'canEdit' | 'canDestroy'>` prop and read `capabilities.canEdit.authorized`. Never destructure it, and never take `session` to run authorizers in the component, and never take a boolean per ability. A parent passes its own object on when the keys match, as in `capabilities={capabilities}`. It maps them otherwise, as in `capabilities={{ canEdit: capabilities.canEditParagraph }}`. It builds them per item of a list with `runCapabilities(session, { ... })`.
- Client components choose. They run the rule themselves with `useAuthorizer`/`useEditMode({ authorizer })` when they know it; the parent passes the ids the rule needs, such as `groupId`. Or they take `capabilities: CapabilitiesJsObject<'canEdit'>` when the rule belongs to whoever renders them, such as the CMS editors, where whether a paragraph may be edited is the owning service's rule. The server side hands those over with `capabilitiesToJsObject(capabilities)`, since an `AuthResult` is a class instance and cannot cross to the client as it is.

### Operation Naming Conventions

In the contract form an operation is made from the entry of its own key, as in `update: defineOperation(fooContract.update, { ... })`, and its schemas and its rule are that entry's. For every `defineOperation({ ... })` call in the other form, the operation key must align with its schema and authorizer keys:

- `dataSchema` comes from `fooSchemas.data` and `paramsSchema` from `fooSchemas.params`, one `fooSchemas` object exported from `schemas.ts`. The key must match the operation name exactly. For example, operation `destroyFoo` uses `fooSchemas.data.destroyFoo` and `fooSchemas.params.destroyFoo`, not `fooSchemas.data.createFoo`. The `implementationParamsSchema` of an implemented sub-operation goes in `fooSchemas.params` too, under the key of the operation it implements. Sub-operations whose schemas are built from implementation fields are the exception: those stay in `defineSubOperation`. A service with no data schemas has no `data` key, and vice versa.
- `authorizer` must reference the same operation name. For example, `fooAuth.destroyFoo`, not `fooAuth.createFoo`.

Data and params are different kinds of input and have separate field objects in `schemas.ts`: `fooSchemas.data` picks from `dataFieldSchemas`, what a user writes, trimmed, length-checked and form-coerced, and `fooSchemas.params` picks from `paramsFieldSchemas`, what identifies the thing acted on, such as ids, names used as keys, or cursors. In the contract form an entry's `data` and `params` pick from the same two field objects, exported as `fooDataFieldSchemas` and `fooParamsFieldSchemas`. Params have looser rules, since a lookup that finds nothing is a NOT FOUND, not a validation error. A field such as `name` may appear in both with different rules; never pick a params schema from `dataFieldSchemas` or the other way round. When operations share the same shape, define a shared variable and reference it from each key:

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

A form is written in one of two ways while the forms are moved from the first to the second.

#### `Form` with `FormData`

`Form` from `@/components/Form/Form` posts the `FormData` of the inputs among its children to an action:
1. Define a dataSchema using `zod-form-data`, imported as `zfd`
2. Create a ServiceOperation with the schema
3. Wrap it with `makeAction()`
4. Call from a client component with FormData

A long form is split with `Tabs` and `FormTab`: the one `Form` holds every value across its tabs and saves them together, and a tab with a refused input is brought forward. See `EventAdmin`. Panels stay mounted, so nothing is lost moving between tabs. A `Form` cannot hold another `Form`, so a tab that saves on its own is a `TabPanel` next to it.

#### The declared form

A form of a service in the contract form is declared, with `Form` from `@/components/Form/Declared/Form`. A capability is bound in one file, which gives the form's submitter and its field, and the form is written with those two in any component, also one the server renders. See `src/app/(omegaweb)/omegaquotes/` and `src/app/(omegaweb)/admin/lockers/`.

```tsx
// fooSubmitters.ts, beside the components that use it
'use client'
export const [UpdateFooSubmitter, UpdateFooField] = Form.Submitter({ capability: fooCapabilities.update })

// any component
<UpdateFooSubmitter
    params={{ id: foo.id }}
    authorizerData={{ userId: foo.ownerId }}
    submitText="Lagre"
    refreshOnSuccess
>
    <UpdateFooField kind="string" name="name" label="Navn" />
</UpdateFooSubmitter>
```

- **`Form.Submitter({ capability })`** is called at the top of a `'use client'` file, since a schema cannot be passed from a server component to a client component. It binds the capability and nothing else, and returns a pair: the submitter, which is rendered around the fields, and the field of that form. The two are named exports of their own, written `export const [FooSubmitter, FooField] = Form.Submitter({ ... })`, since a server component cannot reach into an object or a pair exported from a `'use client'` file. ESLint refuses a `Form.Submitter(...)` that is not the whole right side of such a top-level `export const [A, B] = ...`, also one with a rest element in the brackets. It reads the call as it is written, so it does not see `Form` under another name or a `Submitter` taken out of it. The component that declares the form imports its submitters file, and nothing of `Form`.
- The submitter takes `params`, what the capability's params schema takes, and `authorizerData`, the data its rule still needs. Leaving one out is a type error when the capability needs it, and so is giving one it does not need. It decides the capability itself, with `useCapability`, and renders nothing for a user who may not submit.
- Everything else about a form is a prop of the submitter too, given where the form is declared: `title`, `submitText`, which is `Opprett` when left out, `submitColor`, `confirmation`, which asks before it submits, `refreshOnSuccess`, `closePopUpOnSuccess`, `defaultValues` and `className`.
- **`defaultValues`** is what the fields start as, by name: `defaultValues={{ name: foo.name }}`. The compiler holds them to the names and the types the capability's data schema takes. They are read once, when the form is first rendered, so a form that is saved and stays on the page keeps what was typed.
- **A form with no fields** is a submitter with no children: a button that calls the action, with the same wait, check mark, error and confirmation as any form, and nothing for a user who may not. It is how an action that takes no data is called, such as a destroy: `export const [DestroyFooSubmitter] = Form.Submitter({ capability: fooCapabilities.destroy })`, rendered as `<DestroyFooSubmitter params={{ id: foo.id }} />`.
- **A field** is `kind`, `name`, `label` and the props of its kind. `kind` says which input of `src/app/_components/UI/` it is: `string` is `TextInput`, `text` is `Textarea` and `number` is `NumberInput`. `name` is a key of the capability's data schema. A field gets its value from the form and sets it there, and shows the first of its errors under it. The inputs are used as they are, never copied or restyled for a form.
- **What the compiler holds.** `name` is a key of this capability's schema where the schema takes what the kind writes: a string field fits a key that takes a string, also one that may be left out or be null, and not one that takes a number or one of a few words, and a number field fits a key that takes a number. The other props are those of the kind, and `kind` is one the table has. A misspelt name, a name of the wrong kind and a prop of another kind are type errors. That holds for a `kind` written as one word: a `kind` given as a union of kinds lets the props of any of them through.
- **What is held only when the form runs.** A field reads the form of the submitter it was made with, through a context of that `Form.Submitter` call. Under another submitter, or under none, it throws an error that says so. A pop-up renders what is in it outside whatever is around it, so a form in a pop-up has its submitter inside the pop-up too, or its fields are under none. A submitter throws when it is rendered inside another, since the browser submits a form inside a form itself and the values are lost. In development a field whose value the schema drops is an error at that field.
- **A kind is one file and one line.** A kind is `defineKind<Writes, Props>(emptyValue, Component)` in a file of `Form/Declared/Kinds/`: what it writes to the form, which decides the names it fits, the props it takes beside `kind`, `name` and `label`, and the component that binds an input to its one value. The component is given `label`, its props and `field`, with `name`, `value`, `set` and `leave`, and never the form's store. It is also handed the `kind` and `name` the field was written with. `Kinds/kinds.ts` is the table, and the field and its types are derived from it, so a new kind is its file and its line there. The empty value of a text field is `''`. A number field has no number that means empty, so its empty value is `undefined`, and its component sets `undefined` when the input is emptied. A schema that requires the number then refuses the form. A schema moved with its form takes a number as `z.number()` and not as `z.coerce.number()`, which read the empty text of a posted form as 0. The compiler does not hold that, since a number field also fits a key that takes a coerced or a nullable number, so it is on whoever moves the form.
- **No function props, and no hooks for whoever declares the form.** A submitter takes no `onSubmit`, `onChange` or `successCallback`, so a server component can render it. What happens after a save is a prop of the submitter, such as `refreshOnSuccess`. An effect a form needs and the submitter lacks is added to the submitter as a prop, for every form.
- **The form's state stays in `Form/Declared/`.** Outside that folder only `Form` is imported from it, which ESLint enforces, so no component reads or drives a form's values through its store. The folder's tests are the exception.
- The submitter holds the values of its fields by their `name`. On submit it parses them in the browser with the capability's data schema, through `parseData` in `src/services/parseData.ts`, which the operation parses with too. A refused form sends no request. Otherwise the action is called with the values as they are, never as `FormData`, and the server parses them again. An issue is shown at the field it names, and by the submit button when it names none, whether the browser or the server raised it. A field is checked when it is left, once it has been changed, and after a refused submit the form is checked as its values change. A submit while one is under way, or while the check mark of the last one shows, does nothing.

## Testing

- Tests located in `tests/` directory
- Custom Prisma test environment: `tests/PrismaTestEnvironment.ts`
- Test setup in `tests/setup.ts`
- Use `IGNORE_SERVER_ONLY=true` environment variable when running tests
- Use full variable names in callbacks. Single-letter identifiers are not allowed, per the ESLint `id-length` rule. Use the domain name itself, such as `group => group.id` or `user => user.id`, as long as there are no collisions.
