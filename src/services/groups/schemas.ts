import { z } from 'zod'
import type { MembershipSelectorType } from './types'

const membershipSelectorSchema: z.ZodType<MembershipSelectorType> = z.union([
    z.number(),
    z.literal('ACTIVE'),
    z.literal('ALL'),
])

const dataFieldSchemas = z.object({
    users: z.array(z.object({
        userId: z.number(),
        admin: z.boolean(),
    })),
    userIds: z.number().array(),
    userId: z.number(),
    admin: z.boolean(),
    title: z.string().min(1, 'Tittelen kan ikke være tom'),
    pensioned: z.boolean(),
    /**
     * The users that are to be kept on into the new order, and whether each one administers the
     * group there. Every one of them must be an active member of the group's current order.
     */
    keep: z.array(z.object({
        userId: z.number(),
        admin: z.boolean(),
    })),
})

/**
 * Every common operation addresses a group by its `groupId` - the group type's own service is
 * responsible for mapping its own identifiers (a committee's shortName, say) onto a groupId before
 * calling through.
 */
const paramsFieldSchemas = z.object({
    groupId: z.number(),
    /**
     * The order to manage the memberships of. Left out it is the group's own current order, which is
     * the one being managed in all but the historical cases.
     */
    order: z.number().optional(),
    userId: z.number(),
    /**
     * Leave out to read memberships of every order, active and inactive alike.
     */
    active: z.boolean().optional(),
    groups: z.array(z.object({
        groupId: z.number(),
        admin: z.boolean(),
    })),
})

const group = paramsFieldSchemas.pick({
    groupId: true,
})

/**
 * Shared by the member management operations, which all address one group at one order.
 */
const groupMember = paramsFieldSchemas.pick({
    groupId: true,
    order: true,
})

const user = paramsFieldSchemas.pick({
    userId: true,
})

export const groupSchemas = {
    data: {
        addMembers: dataFieldSchemas.pick({
            users: true,
        }),
        removeMembers: dataFieldSchemas.pick({
            userIds: true,
        }),
        setMemberAdmin: dataFieldSchemas.pick({
            userId: true,
            admin: true,
        }),
        setMemberTitle: dataFieldSchemas.pick({
            userId: true,
            title: true,
        }),
        pension: dataFieldSchemas.pick({
            pensioned: true,
        }),
        migrateGroup: dataFieldSchemas.pick({
            keep: true,
        }),
    },
    params: {
        readMembershipsOfUserOfType: user,
        readMembers: paramsFieldSchemas.pick({
            groupId: true,
            active: true,
        }),
        addMembers: groupMember,
        removeMembers: groupMember,
        setMemberAdmin: groupMember,
        setMemberTitle: groupMember,
        pension: group,
        migrateGroup: group,
        /**
         * The order here selects memberships rather than naming one order: a number, 'ACTIVE' or
         * 'ALL' - see `MembershipSelectorType`.
         */
        readMembershipsOfUserOfAllTypes: user.extend({
            order: membershipSelectorSchema.optional(),
        }),
        readUsersOfGroups: paramsFieldSchemas.pick({
            groups: true,
        }),
        readGroupsOfUser: user,
        destroy: group,
    },
}
