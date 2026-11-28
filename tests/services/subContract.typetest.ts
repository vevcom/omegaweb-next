import { Require } from '@/auth/authorizer/Require'
import { makeAction } from '@/services/serverAction'
import { defineCapabilities, defineContract, defineSubContract } from '@/services/serviceContract'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { z } from 'zod'
import type { Action, ActionFromSubServiceOperation } from '@/services/actionTypes'

// Checked by `npx tsc --noEmit` and never run, so jest does not match its name. The
// `@ts-expect-error` lines are the test: tsc fails on any of them that stops being an error.

type Equal<Left, Right> =
    (<Probe>() => Probe extends Left ? 1 : 2) extends (<Probe>() => Probe extends Right ? 1 : 2) ? true : false

function expectTrue<Check extends true>(): Check | void {}

const partId = z.object({ partId: z.number() })
const text = z.object({ text: z.string() })
const ownerId = z.object({ ownerId: z.number() })
const permitted = Require.permission('OMEGAQUOTES_USE')
const ownedByUser = Require.userId().permission('OMEGAQUOTES_USE')

// The sub-contract: what each sub-operation takes, and no rule.

const partContract = defineSubContract({
    update: { params: partId, data: text },
    destroy: { params: partId },
    // The schemas of update, so only the key tells the two apart.
    updateTwin: { params: partId, data: text },
})

defineSubContract({
    ruled: {
        params: partId,
        // @ts-expect-error A sub-entry has no rule. The owner gives it.
        authorizer: permitted,
    },
})

const partOperations = {
    update: defineSubOperation(partContract.update, { operation: ({ params, data }) => `${params.partId} ${data.text}` }),
    destroy: defineSubOperation(partContract.destroy, { operation: ({ params }) => params.partId }),
    updateTwin: defineSubOperation(partContract.updateTwin, { operation: ({ params }) => params.partId }),
}

// The owner's contract: an entry implemented, with the owner's rule and implementation params.

const ownerContract = defineContract({
    rename: { params: ownerId, data: text, authorizer: permitted },
    // The schemas of the sub-entry update, written by hand.
    plainTwin: { params: partId, data: text, authorizer: permitted },
    updatePart: partContract.update.implement({ implementationParams: ownerId, authorizer: ownedByUser }),
    // The same sub-entry, implementation params and rule: a second part of the owner.
    updateOtherPart: partContract.update.implement({ implementationParams: ownerId, authorizer: ownedByUser }),
    destroyPart: partContract.destroy.implement({ authorizer: permitted }),
    updateTwin: partContract.updateTwin.implement({ implementationParams: ownerId, authorizer: ownedByUser }),
})

defineContract({
    handwritten: {
        params: partId,
        // @ts-expect-error Only the implementation of a sub-entry has implementation params.
        implementationParams: ownerId,
        authorizer: permitted,
    },
})

// The owner's operations, made from its entries. authorizerData is given the implementation params.

const ownerOperations = {
    updatePart: partOperations.update.implement(ownerContract.updatePart, {
        authorizerData: ({ implementationParams }) => ({ userId: implementationParams.ownerId }),
        ownershipCheck: ({ params, implementationParams }) => params.partId === implementationParams.ownerId,
    }),
    updateOtherPart: partOperations.update.implement(ownerContract.updateOtherPart, {
        authorizerData: ({ implementationParams }) => ({ userId: implementationParams.ownerId }),
        ownershipCheck: () => true,
    }),
    destroyPart: partOperations.destroy.implement(ownerContract.destroyPart, {
        ownershipCheck: ({ params }) => params.partId > 0,
    }),
}

// A missing or wrong authorizerData, as for a plain operation.

// @ts-expect-error The rule needs a user id, so authorizerData cannot be left out.
partOperations.update.implement(ownerContract.updatePart, { ownershipCheck: () => true })

partOperations.update.implement(ownerContract.updatePart, {
    // @ts-expect-error The user id is a number.
    authorizerData: ({ implementationParams }) => ({ userId: String(implementationParams.ownerId) }),
    ownershipCheck: () => true,
})

partOperations.destroy.implement(ownerContract.destroyPart, {
    // @ts-expect-error The rule needs no data, so there is nothing to give it.
    authorizerData: () => ({ userId: 1 }),
    ownershipCheck: () => true,
})

partOperations.destroy.implement(ownerContract.destroyPart, {
    // @ts-expect-error The rule is the entry's, so the implementation takes none.
    authorizer: () => permitted,
    ownershipCheck: () => true,
})

// A wrong implementationParams.

partOperations.destroy.implement(ownerContract.destroyPart, {
    // @ts-expect-error An entry without implementation params gives its implementation none.
    ownershipCheck: ({ implementationParams }) => Boolean(implementationParams),
})

// @ts-expect-error The operation takes the implementation params its entry declares.
void ownerOperations.updatePart({ params: { partId: 1 }, data: { text: '' } })

// An entry is implemented by the sub-operation it was implemented from, and by no other.

// @ts-expect-error Implemented from another sub-entry, whose schemas differ.
partOperations.destroy.implement(ownerContract.updatePart, { ownershipCheck: () => true })

partOperations.update.implement(
    // @ts-expect-error Implemented from another sub-entry, whose schemas are the same.
    ownerContract.updateTwin,
    { authorizerData: ({ implementationParams }) => ({ userId: implementationParams.ownerId }), ownershipCheck: () => true },
)

// @ts-expect-error A plain entry implements nothing, also one with the schemas of the sub-entry.
partOperations.update.implement(ownerContract.plainTwin, { ownershipCheck: () => true })

const otherPartContract = defineSubContract({ destroy: { params: partId } })
const otherSubContractOwner = defineContract({
    destroyPart: otherPartContract.destroy.implement({ authorizer: permitted }),
})

// @ts-expect-error Implemented from another sub-contract's entry of the same key and schemas.
partOperations.destroy.implement(otherSubContractOwner.destroyPart, { ownershipCheck: () => true })

// @ts-expect-error An implemented entry is no plain operation's, which would run without an ownership check.
defineOperation(ownerContract.destroyPart, { operation: () => null })

// The actions and the capabilities. With implementation params they come first.

const ownerActions = {
    rename: makeAction(defineOperation(ownerContract.rename, { operation: () => null })),
    updatePart: makeAction(ownerOperations.updatePart),
    updateOtherPart: makeAction(ownerOperations.updateOtherPart),
    destroyPart: makeAction(ownerOperations.destroyPart),
}

void ownerActions.updatePart({ implementationParams: { ownerId: 1 } }, { params: { partId: 1 } }, { data: { text: '' } })
void ownerActions.destroyPart({ params: { partId: 1 } })
// @ts-expect-error The implementation params are the entry's.
void ownerActions.updatePart({ implementationParams: { ownerId: 'one' } }, { params: { partId: 1 } }, new FormData())

const ownerCapabilities = defineCapabilities(ownerContract, {
    rename: ownerActions.rename,
    updatePart: ownerActions.updatePart,
    destroyPart: ownerActions.destroyPart,
})
void ownerCapabilities.updatePart.action(
    { implementationParams: { ownerId: 1 } }, { params: { partId: 1 } }, { data: { text: '' } }
)

defineCapabilities(ownerContract, {
    // @ts-expect-error Made from another entry, which implements the same sub-entry with the same rule.
    updatePart: ownerActions.updateOtherPart,
})

defineCapabilities(ownerContract, {
    // @ts-expect-error An implemented operation's action under the key of a plain entry.
    rename: ownerActions.updatePart,
})

const todaysForm = partOperations.update.implement({
    implementationParamsSchema: ownerId,
    authorizer: ({ implementationParams }) => ownedByUser.data({ userId: implementationParams.ownerId }),
    ownershipCheck: () => true,
})

defineCapabilities(ownerContract, {
    // @ts-expect-error Implemented in today's form, so made from no entry.
    updatePart: makeAction(todaysForm),
})

// Another owner with the same entry under the same key. Its operation is made from the same
// sub-operation, and compiles, since a sub-operation knows no owner: its action is what is refused.
const secondOwnerContract = defineContract({
    destroyPart: partContract.destroy.implement({ authorizer: permitted }),
    oneMore: { authorizer: permitted },
})
const secondOwnerDestroyPart = partOperations.destroy.implement(secondOwnerContract.destroyPart, {
    ownershipCheck: () => true,
})

defineCapabilities(ownerContract, {
    // @ts-expect-error Made from another owner's entry.
    destroyPart: makeAction(secondOwnerDestroyPart),
})

// What a shared component takes an owner's action by is as today.
expectTrue<Equal<
    ActionFromSubServiceOperation<typeof partOperations.update>,
    Action<string, undefined, typeof partId, typeof text>
>>()

// Not caught: a rule with a check of its own written inside `implement` reads its data as `any`,
// and authorizerData is then asked for. Declared as a const first, it needs none.
const inline = defineContract({
    destroyPart: partContract.destroy.implement({ authorizer: Require.filter(() => ({ id: 1 })) }),
})
// @ts-expect-error The trap: the rule needs no data, and authorizerData is still asked for.
partOperations.destroy.implement(inline.destroyPart, { ownershipCheck: () => true })
