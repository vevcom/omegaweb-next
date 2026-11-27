import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { makeAction } from '@/services/serverAction'
import { defineCapabilities, defineContract } from '@/services/serviceContract'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'
import type { ActionReturn } from '@/services/actionTypes'

// Checked by `npx tsc --noEmit` and never run, so jest does not match its name. The
// `@ts-expect-error` lines are the test: tsc fails on any of them that stops being an error.

type Equal<Left, Right> =
    (<Probe>() => Probe extends Left ? 1 : 2) extends (<Probe>() => Probe extends Right ? 1 : 2) ? true : false

function expectTrue<Check extends true>(): Check | void {}

const id = z.object({ id: z.number() })
const name = z.object({ name: z.string() })
const anyone = Require.nothing()

// The four shapes of an entry, their operations and their actions.

const shapes = defineContract({
    both: { params: id, data: name, authorizer: anyone },
    onlyParams: { params: id, authorizer: anyone },
    onlyData: { data: name, authorizer: anyone },
    neither: { authorizer: anyone },
    // The same schemas and the same rule as onlyParams, so only the key tells the two apart.
    twin: { params: id, authorizer: anyone },
})

const shapeOperations = {
    both: defineOperation(shapes.both, { operation: ({ params, data }) => `${params.id} ${data.name}` }),
    onlyParams: defineOperation(shapes.onlyParams, { operation: ({ params }) => params.id }),
    onlyData: defineOperation(shapes.onlyData, { operation: ({ data }) => data.name }),
    neither: defineOperation(shapes.neither, { operation: () => true }),
    twin: defineOperation(shapes.twin, { operation: ({ params }) => params.id }),
}

const shapeActions = {
    both: makeAction(shapeOperations.both),
    onlyParams: makeAction(shapeOperations.onlyParams),
    onlyData: makeAction(shapeOperations.onlyData),
    neither: makeAction(shapeOperations.neither),
    twin: makeAction(shapeOperations.twin),
}

void shapeOperations.both({ params: { id: 1 }, data: { name: 'a' } })
void shapeOperations.neither({})
// @ts-expect-error The operation takes the data its entry declares.
void shapeOperations.both({ params: { id: 1 } })

defineOperation(shapes.onlyParams, {
    // @ts-expect-error An entry with no data schema gives its operation no data.
    operation: ({ data }) => String(data),
})

void shapeActions.both({ params: { id: 1 } }, { data: { name: 'a' } })
void shapeActions.both({ params: { id: 1 } }, new FormData())
void shapeActions.onlyParams({ params: { id: 1 } })
void shapeActions.onlyData({ data: { name: 'a' } })
void shapeActions.neither()
// @ts-expect-error The action takes the params its entry declares.
void shapeActions.onlyParams({ params: { id: 'one' } })
// @ts-expect-error An entry with no schemas gives an action with no arguments.
void shapeActions.neither({ params: { id: 1 } })

expectTrue<Equal<Awaited<ReturnType<typeof shapeActions.both>>, ActionReturn<string>>>()
expectTrue<Equal<Awaited<ReturnType<typeof shapeActions.neither>>, ActionReturn<boolean>>>()

defineContract({
    misspelt: {
        // @ts-expect-error An entry has params, data and authorizer, and nothing else.
        parms: id,
        authorizer: anyone,
    },
})

// The join: an action sits under the key of the entry it was made from.

const shapeCapabilities = defineCapabilities(shapes, {
    both: shapeActions.both,
    onlyParams: shapeActions.onlyParams,
})

void shapeCapabilities.both.action({ params: { id: 1 } }, { data: { name: 'a' } })
expectTrue<Equal<keyof typeof shapeCapabilities, 'both' | 'onlyParams' | 'onlyData' | 'neither' | 'twin'>>()
expectTrue<Equal<typeof shapeCapabilities.twin.action, undefined>>()

defineCapabilities(shapes, {
    // @ts-expect-error Made from another entry, whose schemas differ.
    both: shapeActions.onlyData,
})

defineCapabilities(shapes, {
    // @ts-expect-error Made from another entry, whose schemas and rule are the same.
    onlyParams: shapeActions.twin,
})

defineCapabilities(shapes, {
    // @ts-expect-error A key the contract lacks.
    missing: shapeActions.both,
})

const operationWithoutEntry = defineOperation({
    paramsSchema: id,
    authorizer: () => anyone,
    operation: ({ params }) => params.id,
})

defineCapabilities(shapes, {
    // @ts-expect-error Made without an entry.
    onlyParams: makeAction(operationWithoutEntry),
})

const otherContract = defineContract({
    onlyParams: { params: id, authorizer: anyone },
    both: { params: id, authorizer: anyone },
})
const otherActions = {
    onlyParams: makeAction(defineOperation(otherContract.onlyParams, { operation: ({ params }) => params.id })),
    both: makeAction(defineOperation(otherContract.both, { operation: ({ params }) => params.id })),
}

defineCapabilities(shapes, {
    // @ts-expect-error Made from another contract. This entry is the same there, and its other entries differ.
    onlyParams: otherActions.onlyParams,
})

defineCapabilities(shapes, {
    // @ts-expect-error Made from another contract's entry of the same key, which takes less.
    both: otherActions.both,
})

// The same five entries and one more, so only the contract being invariant in the mark refuses it.
const widerContract = defineContract({
    both: { params: id, data: name, authorizer: anyone },
    onlyParams: { params: id, authorizer: anyone },
    onlyData: { data: name, authorizer: anyone },
    neither: { authorizer: anyone },
    twin: { params: id, authorizer: anyone },
    oneMore: { authorizer: anyone },
})

defineCapabilities(shapes, {
    // @ts-expect-error Made from a contract with one entry more.
    onlyParams: makeAction(defineOperation(widerContract.onlyParams, { operation: ({ params }) => params.id })),
})

// Not caught: two contracts of the very same type, with the same keys and the same shapes of
// schemas and rules, pass each other's actions. A permission's name is not in a rule's type.

// authorizerData: what the entry's rule still needs, and only when it needs something.

const rules = defineContract({
    ownedByUser: { params: id, authorizer: Require.userId().permission('OMEGAQUOTES_USE') },
    needsNoData: { params: id, authorizer: Require.permission('OMEGAQUOTES_USE') },
    filtered: { authorizer: Require.filter(() => ({ id: 1 })) },
})

defineOperation(rules.ownedByUser, {
    authorizerData: ({ params }) => ({ userId: params.id }),
    operation: () => null,
})

// The data may be read from the database, and may hold more than the rule needs.
defineOperation(rules.ownedByUser, {
    authorizerData: async ({ params, prisma }) => {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: params.id }, select: { id: true, username: true } })
        return { userId: user.id, username: user.username }
    },
    operation: () => null,
})

// @ts-expect-error The rule needs a user id, so authorizerData cannot be left out.
defineOperation(rules.ownedByUser, { operation: () => null })

defineOperation(rules.ownedByUser, {
    // @ts-expect-error The user id is a number.
    authorizerData: ({ params }) => ({ userId: String(params.id) }),
    operation: () => null,
})

defineOperation(rules.ownedByUser, {
    // @ts-expect-error Not the data the rule needs.
    authorizerData: () => ({ groupId: 1 }),
    operation: () => null,
})

defineOperation(rules.ownedByUser, {
    // @ts-expect-error The session is never the operation's to give.
    authorizerData: ({ params }) => ({ userId: params.id, session: Session.empty() }),
    operation: () => null,
})

defineOperation(rules.needsNoData, {
    // @ts-expect-error The rule needs no data, so there is nothing to give it.
    authorizerData: () => ({ userId: 1 }),
    operation: () => null,
})

// A rule's filter reaches its operation as the second argument.
defineOperation(rules.filtered, {
    operation: ({ prisma }, prismaWhereFilter) => {
        expectTrue<Equal<typeof prismaWhereFilter, { id: number } | undefined>>()
        return prisma.user.count({ where: prismaWhereFilter })
    },
})
