import { AuthResult } from './AuthResult'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { visibilityFilter as buildVisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { SessionMaybeUser, SessionType, UserGuaranteeOption } from '@/auth/session/Session'
import type { VisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { Permission } from '@/prisma-generated-pn-types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/** Marks a builder as needing no further data. `Record<string, never>` would be an index
 * signature forcing *every* property to `never`, collapsing `Data & Record<string, never>` to
 * `never` - this mapped type over zero keys leaves `Data` untouched instead. */
type NoData = Record<never, never>

/** What a check returns. `PrismaWhereFilter` is `never` for a check that attaches no filter, which
 * is all of them but `.visibilityFilter()`. A chain's filter type is the union of those of its
 * checks, so `never` leaves it as it was. */
type RequireCheckResult<PrismaWhereFilter extends object | undefined = never> =
    | { success: true, prismaWhereFilter?: PrismaWhereFilter }
    | { success: false, errorMessage?: string }

/** One rule of a chain: given the session and the data the chain was supplied, pass or fail. */
type RequireCheck<Data extends object = NoData, PrismaWhereFilter extends object | undefined = never> =
    (args: { session: SessionMaybeUser } & Data) => RequireCheckResult<PrismaWhereFilter>

/** Checks ANDed together. A check needing less data than the group has is still a member: it is
 * handed everything and reads what it needs. */
type RequireGroup<Data extends object, PrismaWhereFilter extends object | undefined> =
    readonly RequireCheck<Data, PrismaWhereFilter>[]

/** A builder needing any data, for `anyOf`/`allOf` to accept builders that each need something
 * different. `Data` is contravariant, so `RequireBuilder<object>` would only accept builders
 * needing no data at all. A builder that attaches a filter is not accepted. */
type AnyRequireBuilder = RequireBuilder<
    any, // eslint-disable-line @typescript-eslint/no-explicit-any
    never,
    UserGuaranteeOption,
    UserGuaranteeOption
>

/** Extracts and intersects the `Data` every builder in a tuple still needs, for `anyOf`/`allOf`. */
type CombinedData<Builders extends readonly AnyRequireBuilder[]> =
    Builders extends readonly [
        RequireBuilder<infer Data, never, UserGuaranteeOption, UserGuaranteeOption>, ...infer Rest
    ]
        ? Rest extends readonly AnyRequireBuilder[] ? Data & CombinedData<Rest> : Data
        : NoData

/** The user guarantee of `anyOf(...builders)`: a user is certain only if every builder is certain
 * of one. */
type UserOfAny<Builders extends readonly AnyRequireBuilder[]> = Builders[number]['userGuarantee']

/** The user guarantee of `allOf(...builders)`: a user is certain if any one builder is certain of
 * one. */
type UserOfAll<Builders extends readonly AnyRequireBuilder[]> =
    Builders extends readonly [infer First extends AnyRequireBuilder, ...infer Rest extends readonly AnyRequireBuilder[]]
        ? First['userGuarantee'] & UserOfAll<Rest>
        : UserGuaranteeOption

/** The error messages used when a check is not given its own. */
const defaultMessages = {
    user: 'Du må være innlogget for å få tilgang',
    generic: 'Du har ikke tilgang til denne ressursen',
    noRulesConfigured: 'Ingen regler er konfigurert for denne autorisasjonen',
    permission: (permission: Permission) => `Du trenger tillatelse '${permission}' for å få tilgang`,
    groupAdmin: (groupId: number) => `Du må være gruppeleder for gruppe ${groupId} for å få tilgang`,
}

/** ANDs every check in `group`, short-circuiting on the first failure. On success the result
 * carries the `prismaWhereFilter` of whichever check in the group attached one, wherever in the
 * group it sits - a check added after `.visibilityFilter()` must not drop its filter. Should
 * several checks attach one, the last wins. */
function evaluateGroup<PrismaWhereFilter extends object | undefined>(
    group: RequireGroup<NoData, PrismaWhereFilter>,
    args: { session: SessionMaybeUser }
): RequireCheckResult<PrismaWhereFilter> {
    if (group.length === 0) return { success: false, errorMessage: defaultMessages.noRulesConfigured }
    let prismaWhereFilter: PrismaWhereFilter | undefined
    for (const check of group) {
        const result = check(args)
        if (!result.success) return result
        prismaWhereFilter = result.prismaWhereFilter ?? prismaWhereFilter
    }
    return { success: true, prismaWhereFilter }
}

/**
 * A chain of authorization rules, built once and reusable across calls. Static conditions (e.g.
 * `.permission()`) take their value immediately; conditions that depend on the request (e.g.
 * `.userId()`) instead register what they'll need in `Data`, supplied later via `.data()` - so
 * `Require.permission('X').userId()` can be defined once at module scope, with `userId` filled in
 * per call via `.data({ userId })`. `.auth()` only exists once `Data` is fully supplied.
 *
 * Internally, a chain is `groups`: AND-groups OR'd together. Condition methods append to the last
 * group; `.or()` starts a new, empty one. An empty group always fails - including the whole
 * chain, not just that branch - so a dangling `.or()` breaks loudly instead of quietly doing less.
 *
 * Chaining therefore only ever narrows the last group: on a chain `a OR b`, `.permission('P')`
 * gives `a OR (b AND P)`, and `a` still passes on its own. To require something of a whole chain
 * that has several groups, combine the two from `Require`: `Require.allOf(chain, extra)` is
 * `(a AND extra) OR (b AND extra)`.
 *
 * The chain also tracks whether passing it proves there is a logged-in user. `'HAS_USER'` means a
 * check such as `.user()` or `.userId()` proved one, `'HAS_USER' | 'NO_USER'` that there may be
 * none. `LastUser` is that of the group being built, where one such check is enough. `EarlierUser`
 * is that of the groups before it. Any one group may be the one that passes, so `.auth()` promises
 * a user only when both are `'HAS_USER'`.
 */
export class RequireBuilder<
    Data extends object = NoData,
    PrismaWhereFilter extends object | undefined = never,
    EarlierUser extends UserGuaranteeOption = never,
    LastUser extends UserGuaranteeOption = UserGuaranteeOption,
> {
    /** Private: every chain starts from `Require`. `groups` are the AND-groups, OR'd together. */
    private constructor(private readonly groups: readonly RequireGroup<Data, PrismaWhereFilter>[]) {}

    /** Type-only: the names of the data this chain still needs, `never` once `.data()` has supplied
     * all of it. `Authorizer` only accepts `never` here, so handing over a chain that still lacks
     * data is a type error that names what is missing. It is never set and must not be read. */
    declare readonly missingData: keyof Data

    /** Type-only: whether passing this chain proves a logged-in user; see the class doc. It is
     * never set and must not be read. */
    declare readonly userGuarantee: EarlierUser | LastUser

    /** The chain with no rules yet, exported as `Require`. Its one empty group fails until a
     * condition is added to it. */
    static readonly identity = new RequireBuilder<NoData>([[]])

    /** ANDs `otherGroups` onto the last group only, distributing if there's more than one.
     * The one primitive behind every condition method, `anyOf` and `allOf` alike. The caller states
     * what the result guarantees of a user, as only it knows what `otherGroups` prove. */
    private appendToLastGroup<
        NextData extends object,
        NextPrismaWhereFilter extends object | undefined,
        NextEarlierUser extends UserGuaranteeOption,
        NextLastUser extends UserGuaranteeOption,
    >(
        otherGroups: readonly RequireGroup<NextData, NextPrismaWhereFilter>[]
    ): RequireBuilder<Data & NextData, PrismaWhereFilter | NextPrismaWhereFilter, NextEarlierUser, NextLastUser> {
        const precedingGroups = this.groups.slice(0, -1)
        const lastGroup = this.groups[this.groups.length - 1]
        const newGroups = otherGroups.map(otherGroup => [...lastGroup, ...otherGroup])
        return new RequireBuilder<Data & NextData, PrismaWhereFilter | NextPrismaWhereFilter, NextEarlierUser, NextLastUser>(
            [...precedingGroups, ...newGroups]
        )
    }

    /** Adds one check to the last group. What every condition method below is built on. `NextUser`
     * is `'HAS_USER'` for a check that only passes with a logged-in user. */
    private and<
        NextData extends object = NoData,
        NextPrismaWhereFilter extends object | undefined = never,
        NextUser extends UserGuaranteeOption = UserGuaranteeOption,
    >(
        nextCheck: RequireCheck<NextData, NextPrismaWhereFilter>
    ): RequireBuilder<Data & NextData, PrismaWhereFilter | NextPrismaWhereFilter, EarlierUser, LastUser & NextUser> {
        return this.appendToLastGroup([[nextCheck]])
    }

    /** No requirement: always authorized. For an operation with genuinely no access rule. */
    nothing(): RequireBuilder<Data, PrismaWhereFilter, EarlierUser, LastUser> {
        return this.and(() => ({ success: true }))
    }

    /** Requires a logged-in user. */
    user(opts?: { errorMessage?: string }): RequireBuilder<Data, PrismaWhereFilter, EarlierUser, 'HAS_USER'> {
        return this.and<NoData, never, 'HAS_USER'>(({ session }) => (
            session.user
                ? { success: true }
                : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.user }
        ))
    }

    /** Requires the session to hold `permission`. */
    permission(permission: Permission, opts?: { errorMessage?: string }):
        RequireBuilder<Data, PrismaWhereFilter, EarlierUser, LastUser> {
        return this.and(({ session }) => (
            session.permissions.includes(permission)
                ? { success: true }
                : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.permission(permission) }
        ))
    }

    /** Requires the logged-in user to be the one with the given id. Needs `{ userId: number }`
     * supplied via `.data()`. */
    userId(opts?: { errorMessage?: string }):
        RequireBuilder<Data & { userId: number }, PrismaWhereFilter, EarlierUser, 'HAS_USER'> {
        return this.and<{ userId: number }, never, 'HAS_USER'>(({ session, userId }) => {
            if (!session.user) {
                return { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.user }
            }
            return session.user.id === userId
                ? { success: true }
                : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.generic }
        })
    }

    /** Requires the logged-in user to match one of the given fields. Needs
     * `{ userField: { username?, id?, email? } }` supplied via `.data()`. */
    userField(opts?: { errorMessage?: string }): RequireBuilder<
        Data & { userField: { username?: string, id?: number, email?: string } }, PrismaWhereFilter, EarlierUser, 'HAS_USER'
    > {
        type UserField = { userField: { username?: string, id?: number, email?: string } }
        return this.and<UserField, never, 'HAS_USER'>(({ session, userField }) => {
            const { user } = session
            const matches = user !== null && (
                (userField.id !== undefined && user.id === userField.id) ||
                (userField.username !== undefined && user.username === userField.username) ||
                (userField.email !== undefined && user.email === userField.email)
            )
            return matches
                ? { success: true }
                : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.generic }
        })
    }

    /** Requires an active admin membership of the group. Needs `{ groupId: number }` supplied via
     * `.data()`. */
    groupAdmin(opts?: { errorMessage?: string }):
        RequireBuilder<Data & { groupId: number }, PrismaWhereFilter, EarlierUser, LastUser> {
        return this.and<{ groupId: number }>(({ session, groupId }) => (
            session.memberships.some(membership => membership.groupId === groupId && membership.active && membership.admin)
                ? { success: true }
                : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.groupAdmin(groupId) }
        ))
    }

    /** A caller-defined check. `check` reads whatever it needs off `Ownership`, supplied later via
     * `.data()`, e.g. `Require.ownership<{ ledgerAccount }>(({ ledgerAccount }) => ...)`. */
    ownership<Ownership extends object>(
        check: (args: { session: SessionMaybeUser } & Ownership) => boolean,
        opts?: { errorMessage?: string }
    ): RequireBuilder<Data & Ownership, PrismaWhereFilter, EarlierUser, LastUser> {
        return this.and<Ownership>((args) => (
            check(args)
                ? { success: true }
                : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.generic }
        ))
    }

    /** Whether the session satisfies one level of a double-level visibility matrix. Needs
     * `{ visibility: DoubleLevelVisibilityMatrix }` via `.data()`. `level` picks which half, and
     * belongs in auth.ts - fixed per operation, or chosen from the resource's own data - never
     * left for the caller to pick by supplying "the correct half" in `.data()` instead.
     *
     * Not `.visibility()`: that name is kept for a resource with a single level, where there is no
     * half to choose. No resource has one yet, so that method does not exist. */
    levelOfDoubleVisibility(opts: { level: 'regularLevel' | 'adminLevel', errorMessage?: string }):
        RequireBuilder<Data & { visibility: DoubleLevelVisibilityMatrix }, PrismaWhereFilter, EarlierUser, LastUser> {
        return this.and<{ visibility: DoubleLevelVisibilityMatrix }>(({ session, visibility }) => (
            checkVisibility(session.memberships, visibility[opts.level])
                ? { success: true }
                : { success: false, errorMessage: opts.errorMessage }
        ))
    }

    /** Always authorized, but attaches a Prisma `where` filter (the second positional argument
     * `defineOperation`'s `operation` receives) scoping a list query to what's visible - for
     * listing operations where filtering out invisible rows is correct, not denying the request.
     * No filter attached when the session holds `bypassPermission`. */
    visibilityFilter(opts?: { bypassPermission?: Permission | null }):
        RequireBuilder<Data, PrismaWhereFilter | VisibilityFilter, EarlierUser, LastUser> {
        return this.and<NoData, VisibilityFilter>(({ session }) => (
            (opts?.bypassPermission && session.permissions.includes(opts.bypassPermission))
                ? { success: true }
                : { success: true, prismaWhereFilter: buildVisibilityFilter(session.memberships) }
        ))
    }

    /** Escape hatch for checks that don't fit the other methods. `check` must be synchronous -
     * resolve any async data (e.g. a Prisma lookup) first. Give it a `CustomData` type argument
     * like `.ownership()` if it needs data supplied later via `.data()`. */
    custom<CustomData extends object = NoData>(
        check: (args: { session: SessionMaybeUser } & CustomData) => boolean | RequireCheckResult,
        opts?: { errorMessage?: string }
    ): RequireBuilder<Data & CustomData, PrismaWhereFilter, EarlierUser, LastUser> {
        return this.and<CustomData>((args) => {
            const result = check(args)
            if (typeof result === 'boolean') {
                return result
                    ? { success: true }
                    : { success: false, errorMessage: opts?.errorMessage ?? defaultMessages.generic }
            }
            return result
        })
    }

    /** Starts a new group, OR'd against everything before it, e.g.
     * `Require.permission('IMAGE_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })`. Takes no
     * argument - to OR in an already-built builder, follow it with `.allOf(thatBuilder)` (`allOf`
     * of one builder is just that builder). Leaving it dangling fails the whole chain; see the
     * class doc. `anyOf`/`allOf` are for three-or-more or dynamic composition instead. */
    or(): RequireBuilder<Data, PrismaWhereFilter, EarlierUser | LastUser, UserGuaranteeOption> {
        return new RequireBuilder([...this.groups, []])
    }

    /** OR: authorized if any of `builders` passes. Every branch is evaluated, and on total
     * failure the branches' messages are joined. Like every method it extends the last group only;
     * see the class doc. */
    anyOf<Builders extends readonly [AnyRequireBuilder, ...AnyRequireBuilder[]]>(
        ...builders: Builders
    ): RequireBuilder<
        Data & CombinedData<Builders>,
        PrismaWhereFilter,
        EarlierUser | (LastUser & UserOfAny<Builders>),
        LastUser & UserOfAny<Builders>
    > {
        return this.appendToLastGroup(builders.flatMap(builder => builder.groups))
    }

    /** AND: authorized only if all of `builders` pass. Short-circuits on the first failure. Like
     * every method it extends the last group only: `chain.allOf(extra)` leaves the earlier groups
     * of `chain` without `extra`. Use `Require.allOf(chain, extra)` to require both in full; see
     * the class doc. */
    allOf<Builders extends readonly [AnyRequireBuilder, ...AnyRequireBuilder[]]>(
        ...builders: Builders
    ): RequireBuilder<
        Data & CombinedData<Builders>,
        PrismaWhereFilter,
        EarlierUser | (LastUser & UserOfAll<Builders>),
        LastUser & UserOfAll<Builders>
    > {
        const andedGroups = builders.reduce<readonly RequireGroup<CombinedData<Builders>, never>[]>((groups, builder) => (
            groups.flatMap(group => builder.groups.map(otherGroup => [...group, ...otherGroup]))
        ), [[]])
        return this.appendToLastGroup(andedGroups)
    }

    /** Supplies everything this chain still needs. Can be called anywhere in the chain - before or
     * after further conditions are added - as long as everything is supplied by the time
     * `.auth()` is called. */
    data(this: RequireBuilder<Data, PrismaWhereFilter, EarlierUser, LastUser>, data: Data):
        RequireBuilder<NoData, PrismaWhereFilter, EarlierUser, LastUser> {
        const groups = this.groups.map(group => group.map(check =>
            (args: { session: SessionMaybeUser }) => check({ ...args, ...data })
        ))
        return new RequireBuilder<NoData, PrismaWhereFilter, EarlierUser, LastUser>(groups)
    }

    /** Evaluates the chain for `session`. Only callable once every field `Data` required has been
     * supplied via `.data()` - a chain with anything still missing is a type error here, not a
     * runtime surprise.
     *
     * Authorized if any group passes. An empty group fails the whole chain; see the class doc. On
     * failure the messages of the groups are joined.
     *
     * A group that passes without a filter grants unfiltered access, e.g. the admin half of
     * `Require.permission('X_ADMIN').or().visibilityFilter()`. Only when every group that passes
     * attaches a filter is one handed on, and then the first: where they differ that shows less
     * than their union would, never more.
     *
     * When authorized, the session of the result is typed as having a user if every group proves
     * one; see the class doc. That is the one place a type is asserted: the checks proved it at
     * runtime, which the compiler cannot follow. */
    auth(this: RequireBuilder<NoData, PrismaWhereFilter, EarlierUser, LastUser>, session: SessionMaybeUser):
        AuthResult<EarlierUser | LastUser, true, PrismaWhereFilter> | AuthResult<UserGuaranteeOption, false> {
        if (this.groups.some(group => group.length === 0)) {
            return new AuthResult(session, false, undefined, defaultMessages.noRulesConfigured)
        }
        const groupResults = this.groups.map(group => evaluateGroup(group, { session }))
        const passed = groupResults.flatMap(result => (result.success ? [result] : []))
        if (passed.length === 0) {
            const errorMessage = groupResults
                .flatMap(result => (!result.success && result.errorMessage ? [result.errorMessage] : []))
                .join(' eller ')
            return new AuthResult(session, false, undefined, errorMessage || undefined)
        }
        const unfiltered = passed.some(result => result.prismaWhereFilter === undefined)
        const provenSession = session as SessionType<EarlierUser | LastUser>
        return new AuthResult(provenSession, true, unfiltered ? undefined : passed[0].prismaWhereFilter)
    }
}

/** Where every authorizer starts, e.g. `Require.permission('X_ADMIN').or().userId()`. */
export const Require: RequireBuilder = RequireBuilder.identity
