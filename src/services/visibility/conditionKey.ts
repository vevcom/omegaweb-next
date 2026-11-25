import type { VisibilityCondition } from './types'

/** The same for two conditions exactly when they let in the same memberships. */
export function conditionKey(condition: VisibilityCondition) {
    return `${condition.groupId}-${condition.order ?? 'any'}-${condition.onlyActive}-${condition.onlyAdmins}`
}
