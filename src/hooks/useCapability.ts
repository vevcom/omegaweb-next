import useAuthorizer from './useAuthorizer'
import type { ActionReturn } from '@/services/actionTypes'
import type { Rule, RuleData } from '@/services/serviceContract'
import type { z } from 'zod'

/**
 * Decides a declared capability for the user who is signed in: whether they may, by the rule of
 * the capability, and its action with the params bound. While the session loads they may not.
 */
export default function useCapability<
    Params = never,
    Data = never,
    EntryRule extends Rule = Rule,
    ImplementationParams = never,
>(
    capability: CallableCapability<Params, Data, EntryRule, ImplementationParams>,
    input: CapabilityInput<Params, EntryRule, ImplementationParams>,
): DecidedCapability<Data> {
    const given: {
        params?: Params,
        implementationParams?: ImplementationParams,
        authorizerData?: RuleData<EntryRule>,
    } = input
    const { authorized } = useAuthorizer({ authorizer: capability.authorizer.data(given.authorizerData ?? {}) })
    return { authorized, ...bindParams(capability, given.params, given.implementationParams) }
}

/**
 * A declared capability that has an action, in each of the shapes an action takes. An owner's
 * implementation of a sub-operation takes its implementation params first.
 */
export type CallableCapability<Params, Data, EntryRule extends Rule, ImplementationParams = never> = {
    readonly authorizer: EntryRule,
} & (
    | {
        readonly implementationParams: InputSchema<ImplementationParams>,
        readonly params: InputSchema<Params>,
        readonly data: InputSchema<Data>,
        readonly action: (
            implementationParams: { implementationParams: ImplementationParams },
            params: { params: Params },
            data: { data: Data },
        ) => Returned,
    }
    | {
        readonly implementationParams: undefined,
        readonly params: InputSchema<Params>,
        readonly data: InputSchema<Data>,
        readonly action: (params: { params: Params }, data: { data: Data }) => Returned,
    }
    | {
        readonly implementationParams: undefined,
        readonly params: InputSchema<Params>,
        readonly data: undefined,
        readonly action: (params: { params: Params }) => Returned,
    }
    | BoundAction<Data> & { readonly implementationParams: undefined, readonly params: undefined }
)

/**
 * `params` and `implementationParams` are refused for a capability that takes none, and
 * `authorizerData` for a rule that needs none.
 */
export type CapabilityInput<Params, EntryRule extends Rule, ImplementationParams = never> =
    & InputPart<'params', Params, [Params] extends [never] ? true : false>
    & ImplementationParamsInput<ImplementationParams>
    & AuthorizerDataInput<EntryRule>

export type ImplementationParamsInput<ImplementationParams> =
    InputPart<'implementationParams', ImplementationParams, [ImplementationParams] extends [never] ? true : false>

export type AuthorizerDataInput<EntryRule extends Rule> =
    InputPart<'authorizerData', RuleData<EntryRule>, [keyof RuleData<EntryRule>] extends [never] ? true : false>

export type DecidedCapability<Data> = { readonly authorized: boolean } & BoundAction<Data>

type BoundAction<Data> =
    | { readonly data: InputSchema<Data>, readonly action: (data: { data: Data }) => Returned }
    | { readonly data: undefined, readonly action: () => Returned }

type InputSchema<Input> = z.ZodType<unknown, z.ZodTypeDef, Input>

/**
 * A key that is given its value, or that may only be left out when there is none. It is two mapped types and not
 * a conditional one, since a component whose props hold a conditional type cannot be rendered with its props
 * spread where they are still generic, as a factory of forms renders a submitter.
 */
type InputPart<Key extends string, Value, None extends boolean> =
    & { [Part in Key as None extends true ? never : Part]: Value }
    & { [Part in Key as None extends true ? Part : never]?: undefined }

type Returned = Promise<ActionReturn<unknown>>

function bindParams<Params, Data, EntryRule extends Rule, ImplementationParams>(
    capability: CallableCapability<Params, Data, EntryRule, ImplementationParams>,
    params: Params | undefined,
    implementationParams: ImplementationParams | undefined,
): BoundAction<Data> {
    if (capability.params === undefined) return capability
    if (params === undefined) throw new Error('A capability that takes params was decided without them.')

    if (capability.implementationParams !== undefined) {
        if (implementationParams === undefined) {
            throw new Error('A capability that takes implementation params was decided without them.')
        }
        const { data: dataSchema, action } = capability
        return { data: dataSchema, action: data => action({ implementationParams }, { params }, data) }
    }
    if (capability.data === undefined) {
        const { action } = capability
        return { data: undefined, action: () => action({ params }) }
    }
    const { data: dataSchema, action } = capability
    return { data: dataSchema, action: data => action({ params }, data) }
}
