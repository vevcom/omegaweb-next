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
})

const paramsFieldSchemas = z.object({
    variantId: z.number(),
})

export const eventSlotSchemas = {
    data: {
        saveSchedule: dataFieldSchemas.pick({
            schedule: true,
        }),
    },
    params: {
        saveSchedule: paramsFieldSchemas.pick({
            variantId: true,
        }),
        readOfVariant: paramsFieldSchemas.pick({
            variantId: true,
        }),
    },
}
