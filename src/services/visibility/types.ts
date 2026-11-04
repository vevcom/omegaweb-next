import type { visibilityOperations } from './operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type { VisibilityRequirementGroupType } from '@/prisma-generated-pn-types'

export type VisibilityCondition = {
    type: Extract<VisibilityRequirementGroupType, 'ORDER'>
    groupId: number
    order: number
} | {
    type: Extract<VisibilityRequirementGroupType, 'ACTIVE'>
    groupId: number
}

export type VisibilityRequirement = {
    conditions: VisibilityCondition[]
}

export type VisibilityMatrix = {
    requirements: VisibilityRequirement[]
}

export type DoubleLevelVisibilityMatrix = {
    regularLevel: VisibilityMatrix,
    adminLevel: VisibilityMatrix
}

/**
 * The two levels of a double level visibility. REGULAR is what it takes to see the resource, ADMIN
 * what it takes to change it. Whoever passes the admin level also passes the regular level, so the
 * two are set independently: the regular level need not list the administrators again.
 */
export type DoubleLevel = 'REGULAR' | 'ADMIN'

/**
 * The shape any owning service's `updateRegularLevel`/`updateAdminLevel` action has once its
 * implementationParams is bound (e.g. a collectionId) - still expecting `params: { visibilityId }`
 * to be bound.
 */
export type UpdateVisibilityAction = ActionFromSubServiceOperation<typeof visibilityOperations.update>
