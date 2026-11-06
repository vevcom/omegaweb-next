import { eventAuth } from './auth'
import { canRegister } from './registration/auth'
import { Session } from '@/auth/session/Session'
import type { EventAccess } from './types'
import type { SessionUser } from '@/auth/session/Session'
import type { VisibilityCondition, VisibilityMatrix } from '@/services/visibility/types'

const MAX_AUDIENCES = 12
// Matches no creator, so a row never gets in by having created the draft.
const NOBODY = -1

export type Registers = 'yes' | 'no' | 'login'
export type WhoCanWhatRow = {
    /** Who the row is about when it is someone in particular. The rest are described by `audience`. */
    label: 'loggedOut' | 'loggedIn' | 'eventAdmin' | null,
    audience: VisibilityMatrix | null,
    sees: boolean,
    registers: Registers,
    administers: boolean,
}

/** Each way of passing a matrix, since someone can pass it through any one condition of each requirement. */
function waysToPass(matrix: VisibilityMatrix): VisibilityCondition[][] {
    return matrix.requirements.reduce<VisibilityCondition[][]>(
        (ways, requirement) => ways.flatMap(way => requirement.conditions.map(condition => [...way, condition])),
        [[]],
    )
}

/** The same whichever order the conditions, or their fields, came in. */
const keyOf = (way: VisibilityCondition[]) => way
    .map(condition => [condition.type, condition.groupId, condition.type === 'ORDER' ? condition.order : ''].join())
    .sort()
    .join(';')

function sessionOf(conditions: VisibilityCondition[]) {
    return Session.fromJsObject({
        user: { id: NOBODY } as SessionUser['user'],
        permissions: [],
        memberships: conditions.map(condition => ({
            groupId: condition.groupId,
            active: condition.type === 'ACTIVE',
            order: condition.type === 'ORDER' ? condition.order : NOBODY,
            admin: false,
        })),
    })
}

/**
 * What those the event names can do with it, from the same rules that decide it on the site. Each
 * audience its quotas and administrators name is a row of its own, so someone who has to be in two
 * groups is not shown as two people who get nothing.
 */
export function whoCanWhat(access: EventAccess): WhoCanWhatRow[] {
    const ways = [...access.quotaVisibilities, access.adminVisibility].flatMap(waysToPass)
    const distinct = ways.filter((way, index) => way.length > 0 && index === ways.findIndex(
        other => keyOf(other) === keyOf(way)
    ))

    const rowOf = (
        session: Session<'HAS_USER'> | Session<'NO_USER'>,
        row: Pick<WhoCanWhatRow, 'label' | 'audience'>,
    ): WhoCanWhatRow => {
        const mayRegister = access.quotaVisibilities.length > 0 && canRegister.data(access).auth(session).authorized
        const loggedOut = session.user === null
        const needsLogin = loggedOut && access.published && access.quotaVisibilities.length > 0
        let registers: Registers = mayRegister ? 'yes' : 'no'
        if (needsLogin) registers = 'login'
        return {
            ...row,
            sees: eventAuth.read.data(access).auth(session).authorized,
            registers,
            administers: eventAuth.update.data(access).auth(session).authorized,
        }
    }

    return [
        rowOf(Session.empty(), { label: 'loggedOut', audience: null }),
        rowOf(sessionOf([]), { label: 'loggedIn', audience: null }),
        ...distinct.slice(0, MAX_AUDIENCES).map(way => rowOf(sessionOf(way), {
            label: null,
            audience: { requirements: way.map(condition => ({ conditions: [condition] })) },
        })),
        rowOf(
            Session.fromJsObject({ user: sessionOf([]).user, permissions: ['EVENT_ADMIN'], memberships: [] }),
            { label: 'eventAdmin', audience: null },
        ),
    ]
}
