import useAuthorizer from './useAuthorizer'
import type { ActionReturn } from '@/services/actionTypes'
import type { Rule, RuleData } from '@/services/serviceContract'
import type { z } from 'zod'

/**
 * Decides a declared capability for the user who is signed in: whether they may, by the rule of
 * the capability, and its action with the params bound. While the session loads they may not.
 */
export default function useCapability<Params = never, Data = never, EntryRule extends Rule = Rule>(
    capability: CallableCapability<Params, Data, EntryRule>,
    input: CapabilityInput<NoInfer<Params>, EntryRule>,
): DecidedCapability<Data> {
    const { authorized } = useAuthorizer({ authorizer: capability.authorizer.data(input.authorizerData ?? {}) })
    return { authorized, ...bindParams(capability, input.params) }
}

/** A declared capability that has an action, in each of the four shapes an action takes. */
export type CallableCapability<Params, Data, EntryRule extends Rule> = { readonly authorizer: EntryRule } & (
    | {
        readonly params: InputSchema<Params>,
        readonly data: InputSchema<Data>,
        readonly action: (params: { params: Params }, data: { data: Data }) => Returned,
    }
    | {
        readonly params: InputSchema<Params>,
        readonly data: undefined,
        readonly action: (params: { params: Params }) => Returned,
    }
    | BoundAction<Data> & { readonly params: undefined }
)

/** `params` is refused for a capability that takes none, and `authorizerData` for a rule that needs none. */
export type CapabilityInput<Params, EntryRule extends Rule> =
    & ([Params] extends [never] ? { params?: undefined } : { params: Params })
    & ([keyof RuleData<EntryRule>] extends [never]
        ? { authorizerData?: undefined }
        : { authorizerData: RuleData<EntryRule> })

export type DecidedCapability<Data> = { readonly authorized: boolean } & BoundAction<Data>

type BoundAction<Data> =
    | { readonly data: InputSchema<Data>, readonly action: (data: { data: Data }) => Returned }
    | { readonly data: undefined, readonly action: () => Returned }

type InputSchema<Input> = z.ZodType<unknown, z.ZodTypeDef, Input>

type Returned = Promise<ActionReturn<unknown>>

function bindParams<Params, Data, EntryRule extends Rule>(
    capability: CallableCapability<Params, Data, EntryRule>,
    params: Params | undefined,
): BoundAction<Data> {
    if (capability.params === undefined) return capability
    if (params === undefined) throw new Error('A capability that takes params was decided without them.')

    if (capability.data === undefined) {
        const { action } = capability
        return { data: undefined, action: () => action({ params }) }
    }
    const { data: dataSchema, action } = capability
    return { data: dataSchema, action: data => action({ params }, data) }
}
