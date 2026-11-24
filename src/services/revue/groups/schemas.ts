import { z } from 'zod'

export const revueGroupDataFieldSchemas = z.object({
    name: z.string().trim().min(2, 'Navnet må ha minst 2 tegn').max(30, 'Navnet kan ha maks 30 tegn'),
    committeeId: z.coerce.number().int(),
    order: z.coerce.number().int(),
    revueGroupId: z.coerce.number().int(),
    /**
     * The groups of the previous revue a new revue carries over, each with the members of a sub group
     * that go with it and whether each administers it. One of the previous revue's that is left out is
     * not carried over.
     */
    carriedGroups: z.array(z.object({
        revueGroupId: z.number(),
        keep: z.array(z.object({ userId: z.number(), admin: z.boolean() })),
    })).refine(
        groups => new Set(groups.map(group => group.revueGroupId)).size === groups.length,
        'En gruppe kan bare tas med én gang',
    ),
})

const paramsFieldSchemas = z.object({
    revueGroupId: z.number(),
    revueId: z.number(),
    year: z.number(),
    name: z.string(),
    userId: z.number(),
    order: z.number().int(),
})

const revueGroupId = paramsFieldSchemas.pick({ revueGroupId: true })

export const revueGroupSchemas = {
    data: {
        create: z.discriminatedUnion('type', [
            revueGroupDataFieldSchemas.pick({ name: true }).extend({ type: z.literal('REVUE_SUB_GROUP') }),
            revueGroupDataFieldSchemas.pick({ name: true, committeeId: true }).extend({ type: z.literal('COMMITTEE') }),
        ]),
        addToRevue: revueGroupDataFieldSchemas.pick({ revueGroupId: true, order: true }),
        update: revueGroupDataFieldSchemas.pick({ name: true }),
        carryInto: revueGroupDataFieldSchemas.pick({ carriedGroups: true }),
    },
    params: {
        create: paramsFieldSchemas.pick({ revueId: true }).partial(),
        addToRevue: paramsFieldSchemas.pick({ revueId: true }),
        removeFromRevue: paramsFieldSchemas.pick({ revueId: true, revueGroupId: true }),
        read: paramsFieldSchemas.pick({ name: true }),
        readManyInRevue: paramsFieldSchemas.pick({ revueId: true }),
        readInRevue: paramsFieldSchemas.pick({ year: true, name: true }),
        update: revueGroupId,
        destroy: revueGroupId,
        articleSection: revueGroupId,
        carryInto: paramsFieldSchemas.pick({ revueId: true }),
        readManyOfUser: paramsFieldSchemas.pick({ userId: true }),
        readMemberProfilesInRevue: paramsFieldSchemas.pick({ year: true, name: true }),
        readMembersAtOrder: paramsFieldSchemas.pick({ revueGroupId: true, order: true }),
    },
}
