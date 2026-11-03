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
docker compose -f docker-compose.dev.yml up --build
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

A PR must contain at most one migration per feature or fix it introduces, as long as that work has never reached prod. Iterating on a schema locally before a PR is normal and produces several migrations; squash them into one before opening or updating the PR, by deleting the extra migration folders, resetting the dev database, and regenerating a single migration from the final schema. Once a migration has shipped to prod, it is final and must never be edited, deleted, or squashed; a later change goes in a new migration.

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
- **Transaction Management**: the `opensTransaction` flag signals that a ServiceOperation will open its own database transaction. Transactions cannot be nested, so this lets the type system and runtime validation prevent calling such operations from within an existing transaction.

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

- **Conditions:** `.permission('X')`, `.user()`, and `.userField()` take no extra data. `.userId()` needs `{ userId }`. `.groupAdmin()` needs `{ groupId }`. `.levelOfDoubleVisibility({ level })` needs `{ visibility }`. `.ownership<Data>(check)` and `.custom<Data>(check)` let the caller define the check. `.visibilityFilter()` attaches a Prisma `where` filter to a list query instead of denying it. `.nothing()` means the operation has no access rule.
- **Combining:** conditions in a chain are ANDed; `.or()` starts a new OR'd group. `.anyOf(...)` and `.allOf(...)` combine already-built chains. `chain.allOf(extra)` only extends the last group of `chain`; use `Require.allOf(chain, extra)` to require `extra` on every branch.
- **Data:** a chain that needs data, such as `userId` or `groupId`, is a type error until `.data({...})` has supplied all of it. Rules that need data from the database fetch it in the operation's `authorizer`. The authorizer may be async and receives `prisma`; it then calls `.data()`.

### Sub-operations, ownership checks and internal calls

- **`defineSubOperation`** defines an operation for a sub-service, such as CMS paragraphs, images, or links, that other services embed. It has no authorizer of its own. Its schemas and `operation` are functions, so an implementer can pass implementation fields.
- **`.implement({ authorizer, ownershipCheck, beforeRun? })`** turns a sub-operation into a callable operation for one owning service. For example, `careersFrontpageOperations` implements `cmsParagraphOperations.updateContent`.
  - `authorizer`: may this user act on the owning resource?
  - `ownershipCheck`: does the sub-resource actually belong to the owning resource? For example, is the paragraph the career page's special paragraph? Returning false rejects the call. This is resource-to-resource integrity, not user permission.
  - `beforeRun`: optional extra checks that run after both and may throw.
- **`.internalCall({ params, data, ... })`** runs a sub-operation from server code with no authorizer and no ownership check. Use it only for calls from other operations or server code that has already authorized the user.
- A service that owns a CMS image, paragraph or link creates it through that sub-service's `create.internalCall`, inside its own transaction when it creates the owning row, for example `companyOperations.create`, and never by nesting the CMS row in the owner's Prisma write.
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

- **`definitions.ts`** defines every worker (`images`, `notifications`, `paymentCompletion`, `store`, `ledger`) as `{ name, intervalMs, tick }`: what it does, in what order and how often.
- **`types.ts`** holds the `Worker` type that shape follows and `WorkerName`, the names `main.ts` accepts.
- **`main.ts`** is the entrypoint of the `worker` compose service (`npm run worker`). It runs the workers side by side in one process: the loops, the wait between ticks and shutting down on SIGTERM/SIGINT. Naming workers as arguments (`tsx src/workers/main.ts images`) runs only those, so one can be moved into a container of its own from compose alone.

Nothing outside `src/workers/` is called a worker.

- **Services** export the units of work, named for what they do, next to the domain logic they use: `processNextImage` (`images/subservice/processingQueue.ts`), `dispatchNextEmailNotification`, `dispatchNextPushNotification` and `sendDueWeeklyDigests` (`notifications/methods/dispatchQueue.ts`), `runNextPaymentCompletionHook` (`ledger/transactions/paymentCompletionHooks.ts`), `destroyImageOrphans` and `destroyOmbulOrphans`, and the ledger sweeper's checks (`ledger/sweeper.ts`).
- A unit of work that handles one item at a time returns `true` when there may be more waiting, so the worker comes straight back instead of waiting out its interval.
- The ledger sweeper is the ledger's common failure path. It cancels stale PENDING transactions, reimburses succeeded payments no transaction claimed, and flags what it can't fix for admins at `/admin/ledger-review`. Code using the ledger leaves these cases to it instead of handling them itself.

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
│   └── (careers)/          # The career pages as their own site: own layout, theme and fonts
│       └── career/
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

Files that must run only on the server import `'@pn-server-only'` at the top. This prevents accidental client-side execution of sensitive code.

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

**IMPORTANT**: client components (`'use client'`) must NEVER import from `operations.ts`. They call server actions from `actions.ts`. Operations are server-only: they build on `serviceOperation.ts`, which imports `'@pn-server-only'`.

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

## Testing

- Tests located in `tests/` directory
- Custom Prisma test environment: `tests/PrismaTestEnvironment.ts`
- Test setup in `tests/setup.ts`
- Use `IGNORE_SERVER_ONLY=true` environment variable when running tests
- Use full variable names in callbacks. Single-letter identifiers are not allowed, per the ESLint `id-length` rule. Use the domain name itself, such as `group => group.id` or `user => user.id`, as long as there are no collisions.
