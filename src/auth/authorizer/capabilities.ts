import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { AuthResultAny, AuthResultTypeAny } from '@/auth/authorizer/AuthResult'
import type { SessionMaybeUser } from '@/auth/session/Session'

export type CapabilityAuthorizer = Authorizer<UserRequiredOutOpt, object | undefined>

/** A capability is named for what it allows: `canEdit`, `canDestroy`, `canReadRegistrations`, ... */
export type CapabilityKey = `can${string}`

/**
 * The authorizers behind a set of capabilities, keyed by what each allows. Used as the constraint
 * of the generic that holds them (`Authorizers extends CapabilityAuthorizers<Authorizers>`), so
 * a key that does not start with `can` is a type error.
 */
export type CapabilityAuthorizers<Authorizers> = {
    [Key in keyof Authorizers]: Key extends CapabilityKey ? CapabilityAuthorizer : never
}

/**
 * What the current user may do: the AuthResult of each authorizer, under the same key. This is
 * what server components take, as one `capabilities` prop they read without destructuring -
 * `capabilities.canEdit.authorized` - so the rule behind each ability stays visible at the use.
 *
 * @example
 * type PropTypes = {
 *     article: ExpandedArticle,
 *     capabilities: Capabilities<'canEdit'>,
 * }
 */
export type Capabilities<Keys extends CapabilityKey> = Record<Keys, AuthResultAny>

/**
 * Capabilities as plain objects, which is how they cross into a client component that gets them
 * from the server rather than running the authorizers itself - see {@link capabilitiesToJsObject}.
 */
export type CapabilitiesJsObject<Keys extends CapabilityKey> = Record<Keys, AuthResultTypeAny>

/**
 * Runs each authorizer against the session. `serverPage` and `serverLayout` do this for the
 * capabilities of a page; a server component that renders a list calls it per item.
 *
 * @example
 * <InterestGroup capabilities={runCapabilities(session, {
 *     canUpdate: interestGroupAuth.update.data({ groupId: interestGroup.groupId }),
 *     canDestroy: interestGroupAuth.destroy,
 * })} />
 */
export function runCapabilities<Authorizers extends CapabilityAuthorizers<Authorizers>>(
    session: SessionMaybeUser,
    authorizers: Authorizers,
): Capabilities<Extract<keyof Authorizers, CapabilityKey>> {
    return Object.fromEntries(
        Object.entries(authorizers).map(([capability, authorizer]) => [
            capability,
            (authorizer as CapabilityAuthorizer).auth(session),
        ])
    ) as Capabilities<Extract<keyof Authorizers, CapabilityKey>>
}

/**
 * The plain-object form of capabilities, for passing them to a client component. An AuthResult
 * is a class instance, which cannot cross the server/client boundary as it is.
 */
export function capabilitiesToJsObject<Keys extends CapabilityKey>(
    capabilities: Capabilities<Keys>,
): CapabilitiesJsObject<Keys> {
    return Object.fromEntries(
        Object.entries<AuthResultAny>(capabilities).map(([capability, result]) => [
            capability,
            result.toJsObject(),
        ])
    ) as CapabilitiesJsObject<Keys>
}
