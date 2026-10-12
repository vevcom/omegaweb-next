import { locationMapSchema } from '@/lib/maps/locationMap'
import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { convertAmount } from '@/lib/currency/convert'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { EventCanView } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const baseSchema = z.object({
    name: z.string().min(5, 'Navnet må være minst 5 tegn').max(70, 'Navnet må være maks 70 tegn'),
    location: z.string().min(2, 'Stedet må være minst 2 tegn'),
    locationMap: Zpn.json({ label: 'Kart', schema: locationMapSchema.nullable() }).optional(),
    order: z.coerce.number().int().optional(),
    eventStart: Zpn.date({ label: 'Starttid' }),
    eventEnd: Zpn.date({ label: 'Sluttid' }),
    canBeViewdBy: z.nativeEnum(EventCanView),

    takesRegistration: Zpn.checkboxOrBoolean({ label: 'Tar påmelding' }),
    places: z.coerce.number().int().optional(),
    registrationStart: Zpn.date({ label: 'Påmelding start' }).optional(),
    registrationEnd: Zpn.date({ label: 'Påmelding slutt' }).optional(),
    price: z.coerce.number().min(0).transform(val => convertAmount(val)).optional(),
    paymentStart: Zpn.date({ label: 'Betaling start' }).optional(),
    paymentEnd: Zpn.date({ label: 'Betaling slutt' }).optional(),

    waitingList: Zpn.checkboxOrBoolean({ label: 'Venteliste' }),

    tagIds: Zpn.numberListCheckboxFriendly({ label: 'tags' })
})

const waitingListRefiner = (data: {
    waitingList?: boolean,
    takesRegistration?: boolean
}) => (data.takesRegistration || !data.waitingList)

const waitingListMessage = 'Kan ikke ha venteliste uten påmelding'

/**
 * Both visibility levels are set as the event is created: created with an empty admin level it
 * would be administrable by anyone until someone narrowed it. The regular level may stay empty,
 * which means everyone - whereas a requirement with no conditions at all can never be satisfied,
 * and so means no one but those bypassing with a permission.
 */
const visibilityLevelFields = {
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere arrangementet'),
    }),
    visibilityRegularRequirements: Zpn.json({
        label: 'Hvem kan melde seg på',
        schema: visibilityRequirementsSchema,
    }).default([]),
}

export const eventSchemas = {
    params: z.object({
        id: z.number(),
    }),

    search: z.object({
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(25)
            .optional(),
    }),

    setPublished: z.object({
        published: Zpn.checkboxOrBoolean({ label: 'Publisert' }),
    }),

    create: baseSchema.pick({
        name: true,
        location: true,
        locationMap: true,
        order: true,
        eventStart: true,
        eventEnd: true,
        canBeViewdBy: true,
        takesRegistration: true,
        places: true,
        registrationStart: true,
        registrationEnd: true,
        tagIds: true,
        waitingList: true,
        price: true,
        paymentStart: true,
        paymentEnd: true,
    }).extend(visibilityLevelFields).refine(waitingListRefiner, waitingListMessage),

    update: baseSchema.partial().pick({
        name: true,
        location: true,
        locationMap: true,
        order: true,
        eventStart: true,
        eventEnd: true,
        canBeViewdBy: true,
        takesRegistration: true,
        places: true,
        registrationStart: true,
        registrationEnd: true,
        tagIds: true,
        waitingList: true,
        price: true,
        paymentStart: true,
        paymentEnd: true,
    }).refine(waitingListRefiner, waitingListMessage),

    readManyArchivedPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.object({
            name: z.string().max(100).optional(),
            tags: z.array(z.string()).nullable(),
        }),
    ),
}
