import { slotsOrProblem, wholeMinute } from './schedule'
import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const minutes = z.number({ invalid_type_error: 'Minuttene må være et tall' }).int('Minuttene må være et helt tall')

const dataFieldSchemas = z.object({
    // Its limits and the slots it gives are judged whole, by `slotsOrProblem`, as the setup form judges them.
    schedule: z.object({
        start: Zpn.date({ label: 'Første tidsluke' }).transform(wholeMinute),
        slotMinutes: minutes,
        breakMinutes: minutes,
        totalMinutes: minutes,
        longBreakEveryMinutes: minutes.nullable(),
        longBreakMinutes: minutes.nullable(),
    }).superRefine((schedule, context) => {
        const { problem } = slotsOrProblem(schedule)
        if (problem) context.addIssue({ code: z.ZodIssueCode.custom, message: problem })
    }).nullable(),
    // Where those who hold a slot go when the schedule gives other slots: each to a new slot, named
    // by its start, or to the waiting list, or everyone registered is removed. See `saveSchedule`.
    placing: z.discriminatedUnion('removeEveryone', [
        // The registrations of the variant as the form knew them, so that no one who came since is removed.
        z.object({ removeEveryone: z.literal(true), registrationIds: z.array(z.number().int()) }),
        z.object({
            removeEveryone: z.literal(false),
            placements: z.array(z.object({
                registrationId: z.number().int(),
                slotStart: Zpn.date({ label: 'Ny tidsluke' }).nullable(),
            })),
        }),
    ]).nullable(),
})

const paramsFieldSchemas = z.object({
    variantId: z.number(),
})

export const eventSlotSchemas = {
    data: {
        saveSchedule: dataFieldSchemas.pick({
            schedule: true,
        }).extend({
            placing: dataFieldSchemas.shape.placing.default(null),
        }),
    },
    params: {
        saveSchedule: paramsFieldSchemas.pick({
            variantId: true,
        }),
        readOfVariant: paramsFieldSchemas.pick({
            variantId: true,
        }),
        readBoard: paramsFieldSchemas.pick({
            variantId: true,
        }),
    },
}
