import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(2, { message: 'Navnet må være minst 2 tegn.' }),
    startDate: Zpn.date({ label: 'Start' }),
    endDate: Zpn.date({ label: 'Siste frist for søknader' }),
    endPriorityDate: Zpn.date({ label: 'Siste frist for prioritering' }),
    participatingCommitteeIds: Zpn.numberListCheckboxFriendly({ label: 'Deltakende komitéer' })
})

const paramsFieldSchemas = z.object({
    name: z.string(),
})

/**
 * The period starts before applications close, and prioritizing closes no earlier than that.
 * Only the pairs that are both given are compared, so a partial update is judged on what it
 * changes alone - the operation compares the merged dates.
 */
export const periodDatesInOrder = ({ startDate, endDate, endPriorityDate }: {
    startDate?: Date,
    endDate?: Date,
    endPriorityDate?: Date,
}) => (
    (!startDate || !endDate || startDate < endDate)
    && (!endDate || !endPriorityDate || endDate <= endPriorityDate)
)

export const periodDatesMessage =
    'Søknadsfristen må være etter starten, og prioriteringsfristen kan ikke være før søknadsfristen.'

const period = dataFieldSchemas.pick({
    name: true,
    startDate: true,
    endDate: true,
    endPriorityDate: true,
    participatingCommitteeIds: true
})

const periodName = paramsFieldSchemas.pick({
    name: true,
})

export const applicationPeriodSchemas = {
    data: {
        create: period.refine(periodDatesInOrder, periodDatesMessage),
        update: period.partial().refine(periodDatesInOrder, periodDatesMessage),
    },
    params: {
        read: periodName,
        update: periodName,
        removeAllApplicationTexts: periodName,
        destroy: periodName,
        readNumberOfApplications: periodName,
    },
}
