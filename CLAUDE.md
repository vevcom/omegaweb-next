# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Next is the website for Sanctus Omega Broderskab, built with Next.js 16, TypeScript, Prisma, and PostgreSQL. The application runs in Docker containers for both development and production.

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

Reseed the database (deletes all data and re-seeds):
```bash
npm run docker:reseed
```

Create a migration after schema changes (writes `src/prisma/migrations/<timestamp>_<name>/`, which must be committed). The dev database is built from migrations, so a schema change only reaches it through one. Works whether or not the dev environment is running:
```bash
npm run docker:migrate:dev -- --name <name>
```

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
docker exec -it -w /workspaces/projectNext pn-dev /bin/bash
```

## Architecture

### Service Layer Pattern

The codebase uses a ServiceOperation pattern for all business logic. Services are located in `src/services/` and organized by domain (e.g., `users`, `groups`, `cms`, `events`).

**Key concepts:**
- **ServiceOperation**: Core abstraction defined in `src/services/serviceOperation.ts`. All business logic is wrapped in ServiceOperations.
- **Server Actions**: Client-callable functions created by wrapping ServiceOperations with `makeAction()` from `src/services/serverAction.ts`.
- **Authorization**: Every ServiceOperation has an authorizer built with the `Require` chain from `src/auth/authorizer/Require.ts` (see [Authorizers](#authorizers)).
- **Transaction Management**: The `opensTransaction` flag signals that a ServiceOperation will open its own database transaction. Since transactions cannot be nested, this allows the type system and runtime validation to prevent calling such operations from within an existing transaction.

**Pattern example:**
```typescript
// auth.ts
export const fooAuth = {
  update: Require.permission('FOO_ADMIN').or().userId(),
} as const

// schemas.ts
const fieldSchemas = z.object({ id: z.number(), name: z.string() })

export const fooSchemas = {
  update: fieldSchemas.pick({ name: true }),
}
export const fooParamsSchemas = {
  update: fieldSchemas.pick({ id: true }),
}

// operations.ts
const update = defineOperation({
  paramsSchema: fooParamsSchemas.update,
  dataSchema: fooSchemas.update,
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

Rules are written once in the service's `auth.ts` as `Require` chains, so the same rule can run on the server (in the operation) and in the frontend (with `useAuthorizer`). `operations.ts` only supplies data to them with `.data({...})`; it never builds a `Require` chain itself.

- **Conditions:** `.permission('X')`, `.user()`, `.userId()` (needs `{ userId }`), `.userField()`, `.groupAdmin()` (needs `{ groupId }`), `.levelOfDoubleVisibility({ level })` (needs `{ visibility }`), `.ownership<Data>(check)` and `.custom<Data>(check)` for caller-defined checks, `.visibilityFilter()` for list queries (attaches a Prisma `where` filter instead of denying), and `.nothing()` for operations with no access rule.
- **Combining:** conditions in a chain are ANDed; `.or()` starts a new OR'd group. `.anyOf(...)` and `.allOf(...)` combine already-built chains. `chain.allOf(extra)` only extends the last group of `chain`; use `Require.allOf(chain, extra)` to require `extra` on every branch.
- **Data:** a chain that needs data (`userId`, `groupId`, ...) is a type error until `.data({...})` has supplied all of it. Rules that need data from the database fetch it in the operation's `authorizer` (which may be async and receives `prisma`), then call `.data()`.

### Sub-operations, ownership checks and internal calls

- **`defineSubOperation`** defines an operation for a sub-service (CMS paragraphs, images, links, ...) that other services embed. It has no authorizer of its own; schemas and `operation` are functions so an implementer can pass implementation fields.
- **`.implement({ authorizer, ownershipCheck, beforeRun? })`** turns a sub-operation into a callable operation for one owning service (e.g. `careerOperations` implements `cmsParagraphOperations.updateContent`).
  - `authorizer`: may this user act on the owning resource?
  - `ownershipCheck`: does the sub-resource actually belong to the owning resource (e.g. the paragraph is the career page's special paragraph)? Returning false rejects the call. It is resource-to-resource integrity, not user permission.
  - `beforeRun`: optional extra checks that run after both and may throw.
- **`.internalCall({ params, data, ... })`** runs a sub-operation from server code with no authorizer and no ownership check. Only for calls from other operations or server code that has already authorized the user.
- **`bypassAuth: true`** skips the authorizer of a top-level operation when calling it from trusted server code (e.g. NextAuth callbacks, seeders). Clients cannot set it; `makeAction` never passes it.
- Operations called inside another operation inherit its context (prisma client or transaction, session, `bypassAuth`) through async local storage; pass `prisma: tx` explicitly to run one inside a transaction.

### Service Folder Structure

Each service domain follows a standard file layout. See `src/services/omegaquotes/` as the canonical example:

```
src/services/[domain]/
├── actions.ts      # 'use server' — makeAction() wrappers, one per operation
├── auth.ts         # Authorizer definitions (`Require` chains, shared with the frontend)
├── constants.ts    # Domain constants and config values (env vars, field selections)
├── operations.ts   # defineOperation() calls, exported as `{ ... } as const`
├── schemas.ts      # Plain Zod schemas: data in `fooSchemas`, params in `fooParamsSchemas`
└── types.ts        # TypeScript types specific to this domain (if needed)
```

Rules:
- **`constants.ts`** — not `ConfigVars.ts` or any other name
- **`operations.ts`** — the exported object must end with `as const`
- **`schemas.ts`** — holds every `dataSchema` and `paramsSchema` the service's operations use (see [Operation Naming Conventions](#operation-naming-conventions)); none are defined inline in `operations.ts`
- **`actions.ts`** — must have `'use server'` at the top; only calls `makeAction()`
- Sub-domains (e.g. `mail/alias/`) follow the same layout within their subfolder

### Prisma Schema Organization

Prisma schemas are split into multiple domain-specific files in `src/prisma/schema/`:
- `schema.prisma` - Main configuration (generator, datasource)
- `user.prisma`, `group.prisma`, `cms.prisma`, etc. - Domain models

The Prisma client is generated to `generated/pn-prisma/` outside the src folder.

### Authentication

- Uses NextAuth.js v4 with custom JWT tokens
- Auth configuration in `src/auth/nextAuth/`
- Session management via `ServerSession` and `Session` classes
- Custom visibility and authorization system

### Path Aliases

The project uses extensive TypeScript path aliases (see `tsconfig.json`):
- `@/lib/*` → `src/lib/*`
- `@/components/*` → `src/app/_components/*`
- `@/services/*` → `src/services/*`
- `@/prisma-pn-client-instance` → `src/prisma/client.ts`
- `@/prisma-generated-pn-client` → `generated/pn-prisma/client.ts`
- Many more domain-specific aliases

### Project Structure

```
src/
├── app/                    # Next.js app directory (pages, routes, layouts)
│   ├── _components/        # Shared React components
│   ├── api/                # API routes (NextAuth, etc.)
│   ├── admin/              # Admin pages
│   └── [feature]/          # Feature-specific pages
├── auth/                   # Authentication & authorization
│   ├── authorizer/         # Authorization classes
│   ├── session/            # Session management
│   └── nextAuth/           # NextAuth configuration
├── services/               # Business logic layer (ServiceOperations)
│   ├── users/
│   ├── groups/
│   ├── cms/
│   └── [domain]/           # Domain-specific services
├── prisma/                 # Database
│   ├── schema/             # Prisma schema files (split by domain)
│   ├── seeder/             # Database seeding
│   └── client.ts           # Prisma client instance
├── lib/                    # Utility libraries
│   ├── jwt/                # JWT token utilities
│   ├── dates/              # Date handling (Luxon)
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

### Server-Only Code

Files that must run only on the server import `'@pn-server-only'` at the top. This is enforced to prevent accidental client-side execution of sensitive code.

### Error Handling

- Service operations use custom error classes from `src/services/error.ts`
- `Smorekopp` - Base error class for service errors
- `ParseError` - Validation/parsing errors
- Error handling is managed internally by the ServiceOperation system via `makeAction()`

### Calling Services from the Frontend

**IMPORTANT**: Client components (`'use client'`) must NEVER import from `operations.ts`. They call server actions from `actions.ts`. Operations are server-only — they build on `serviceOperation.ts`, which imports `'@pn-server-only'`.

Server components do the opposite: pages, layouts and other server components import from `operations.ts` and call operations directly, not through actions. A read action exists only when a client component needs it, so don't add one for a page.

#### Pages: `serverPage`

Pages are built with `serverPage` from `@/app/serverPage` (trimmed from `src/app/news/[nameAndId]/page.tsx`):

```tsx
import { newsOperations } from '@/services/news/operations'
import { newsAuth } from '@/services/news/auth'
import { serverPage, withFallback } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

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
- A service error thrown from `operation` renders `ServiceErrorView` in place of the page; `NOT FOUND` becomes `notFound()` and `UNAUTHENTICATED` redirects to login. Wrap calls whose failure should not take the page down in `withFallback(promise, fallback)`. It falls back on every service error; pass the error codes as a third argument to fall back only on those, e.g. `withFallback(promise, null, ['NOT FOUND'])`.
- Access to the page is decided in `operation`, by the authorizers of the operations it calls or explicitly (admin pages call `authorizeAdminPage(path, session)`). `capabilities` does not guard the page: it declares what the user may do on it under `can[Something]` keys, and `render` receives the results as `capabilities` (see [Capabilities](#capabilities)).
- The page title comes from `metadata` — don't render `PageTitleSetter` in a page built with `serverPage`.

#### Layouts: `serverLayout`

Layouts that load data are built with `serverLayout`, also from `@/app/serverPage`. It is `serverPage` for layouts — the operation gets `params` and `session` (layouts have no `searchParams`), and `render` also receives `children`:

```tsx
export default serverLayout({
    operation: async ({ params }: LayoutOperationArgs<{ category: string }>) =>
        articleCategoryOperations.read({ params: { name: decodeURIComponent(params.category) } }),
    render: ({ data: category, children }) => <SideBar category={category}>{children}</SideBar>,
})
```

A layout needs it even when every page under it uses `serverPage`: an error thrown by a layout is not caught by the pages it wraps, so without `serverLayout` an expected service error (an unknown committee, say) ends up in the error boundary instead of becoming a 404.

The root layout is the exception. It renders the document itself, so it has nothing to show an error view in — it uses `withPageSession` and wraps every read in `withFallback`.

#### Other server components: `withPageSession`

Server components rendered inside a page (cards, sections) wrap their operation calls in `withPageSession(async session => ...)` from `@/app/serverPage`, which sets up the same service context. Errors are not handled there: wrap calls in `withFallback`, catch them with `handleServiceError`, or let them reach the error boundary.

#### Actions in client components

Action call signatures depend on whether the operation has `paramsSchema` and/or `dataSchema`:
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

- Pages and layouts declare them in `serverPage`/`serverLayout`'s `capabilities: (data, session) => ({ canEdit: fooAuth.update.data({ ... }) })` and read them in `render` as `capabilities.canEdit.authorized`. A rule that needs the session's own user takes the `session` argument (`session.user ? fooAuth.create.data({ userId: session.user.id }) : Require.user()`) — don't run `.auth(session)` inline in `render`.
- Server components take one `capabilities: Capabilities<'canEdit' | 'canDestroy'>` prop and read `capabilities.canEdit.authorized`. Never destructure it, and never take `session` to run authorizers in the component or a boolean per ability. A parent passes its own object on when the keys match (`capabilities={capabilities}`), maps them otherwise (`capabilities={{ canEdit: capabilities.canEditParagraph }}`), and builds them per item of a list with `runCapabilities(session, { ... })`.
- Client components choose: run the rule themselves with `useAuthorizer`/`useEditMode({ authorizer })` when they know it (the parent passes the ids the rule needs, such as `groupId`), or take `capabilities: CapabilitiesJsObject<'canEdit'>` when the rule belongs to whoever renders them (the CMS editors: whether a paragraph may be edited is the owning service's rule). The server side hands those over with `capabilitiesToJsObject(capabilities)` — an `AuthResult` is a class instance and cannot cross to the client as it is.

### Operation Naming Conventions

For every `defineOperation()` call, the operation key must align with its schema and authorizer keys:

- `dataSchema` comes from the service's `fooSchemas` and `paramsSchema` from its `fooParamsSchemas`, both exported from `schemas.ts`. The key must match the operation name exactly — e.g. operation `destroyFoo` uses `fooSchemas.destroyFoo` and `fooParamsSchemas.destroyFoo`, not `fooSchemas.createFoo`. Sub-operations whose schemas are built from implementation fields are the exception: those stay in `defineSubOperation`.
- `authorizer`: must reference the same operation name — e.g. `fooAuth.destroyFoo`, not `fooAuth.createFoo`.

Both objects pick their fields from one `fieldSchemas` object (a `z.object`) in `schemas.ts`, so a field such as `userId` or `name` has the same schema in every operation that takes it, whether as data or as params. When operations share the same schema shape, define a shared variable and reference it from each key in the schemas object (the same goes for `fooParamsSchemas`):

```typescript
// schemas.ts
const fooRelation = fieldSchemas.pick({ userId: true, groupId: true })

export const fooSchemas = {
    createFoo: fooRelation,
    destroyFoo: fooRelation,
}
```

### Form Handling

Forms typically use Server Actions with FormData:
1. Define a dataSchema using `zod-form-data` (`zfd`)
2. Create a ServiceOperation with the schema
3. Wrap it with `makeAction()`
4. Call from a client component with FormData

## Testing

- Tests located in `tests/` directory
- Custom Prisma test environment (`tests/PrismaTestEnvironment.ts`)
- Test setup in `tests/setup.ts`
- Use `IGNORE_SERVER_ONLY=true` environment variable when running tests
- Use full variable names in callbacks — no single-letter identifiers (ESLint `id-length` rule). Use the domain name itself (e.g. `group => group.id`, `user => user.id`) as long as there are no collisions.

## Migration from OmegaWeb Basic

The project includes migration tooling from an older system (OmegaWeb Basic):
- Schema in `src/prisma/owSchema/`
- Migration command: `npm run dobbelOmega:run`
- Only relevant for data migration tasks
