import { z } from 'zod'

/**
 * Schemas shared by the common group operations. Every common operation addresses a group by its
 * `groupId` - the group type's own service is responsible for mapping its own identifiers
 * (a committee's shortName, say) onto a groupId before calling through.
 */
const groupMemberParams = z.object({
    groupId: z.number(),
    /**
     * The order to manage the memberships of. Left out it is the group's own current order, which is
     * the one being managed in all but the historical cases.
     */
    order: z.number().optional(),
})

export const groupSchemas = {
    groupParams: z.object({
        groupId: z.number(),
    }),
    /**
     * Shared by the member management operations, which all address one group at one order.
     */
    groupMemberParams,
    readMembershipsOfUserOfType: z.object({
        userId: z.number(),
    }),
    readMembers: z.object({
        groupId: z.number(),
        /**
         * Leave out to read memberships of every order, active and inactive alike.
         */
        active: z.boolean().optional(),
    }),
    addMembers: z.object({
        users: z.array(z.object({
            userId: z.number(),
            admin: z.boolean(),
        })),
    }),
    removeMembers: z.object({
        userIds: z.number().array(),
    }),
    setMemberAdmin: z.object({
        userId: z.number(),
        admin: z.boolean(),
    }),
    setMemberTitle: z.object({
        userId: z.number(),
        title: z.string().min(1, 'Tittelen kan ikke være tom'),
    }),
    pension: z.object({
        pensioned: z.boolean(),
    }),
    migrateManually: z.object({
        /**
         * The users that are to be kept on into the new order, and whether each one administers the
         * group there. Every one of them must be an active member of the group's current order.
         */
        keep: z.array(z.object({
            userId: z.number(),
            admin: z.boolean(),
        })),
    }),
} as const
