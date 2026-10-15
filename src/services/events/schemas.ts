import { locationMapSchema } from '@/lib/maps/locationMap'
import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { convertAmount } from '@/lib/currency/convert'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { EventCanView } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(5, 'Navnet må være minst 5 tegn').max(70, 'Navnet må være maks 70 tegn'),
    location: z.string().min(2, 'Stedet må være minst 2 tegn').max(100, 'Stedet må være maks 100 tegn'),
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

    tagIds: Zpn.numberListCheckboxFriendly({ label: 'tags' }),

    published: Zpn.checkboxOrBoolean({ label: 'Publisert' }),

    /**
     * Both visibility levels are set as the event is created: created with an empty admin level it
     * would be administrable by anyone until someone narrowed it. The regular level may stay empty,
     * which means everyone - whereas a requirement with no conditions at all can never be satisfied,
     * and so means no one but those bypassing with a permission.
     */
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere arrangementet'),
    }),
    visibilityRegularRequirements: Zpn.json({
        label: 'Hvem kan melde seg på',
        schema: visibilityRequirementsSchema,
    }).default([]),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number(),
    query: z.string().trim().min(1).max(100),
    limit: z.number().int().min(1).max(25)
        .optional(),
    name: z.string().max(100).optional(),
    tags: z.array(z.string()).nullable(),
})

const waitingListRefiner = (data: {
    waitingList?: boolean,
    takesRegistration?: boolean
}) => (data.takesRegistration || !data.waitingList)

const waitingListMessage = 'Kan ikke ha venteliste uten påmelding'

const eventFields = {
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
} as const

const eventId = paramsFieldSchemas.pick({
    id: true,
})

const eventImplementationId = paramsFieldSchemas.pick({
    eventId: true,
})

export const eventSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            ...eventFields,
            visibilityAdminRequirements: true,
            visibilityRegularRequirements: true,
        }).refine(waitingListRefiner, waitingListMessage),
        update: dataFieldSchemas.pick(eventFields).partial().refine(waitingListRefiner, waitingListMessage),
        setPublished: dataFieldSchemas.pick({
            published: true,
        }),
    },
    params: {
        visibility: eventId,
        read: eventId,
        readManyCurrent: paramsFieldSchemas.pick({
            tags: true,
        }),
        readManyArchivedPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            paramsFieldSchemas.pick({
                name: true,
                tags: true,
            }),
        ),
        search: paramsFieldSchemas.pick({
            query: true,
            limit: true,
        }),
        update: eventId,
        updateCmsCoverImage: eventImplementationId,
        setPublished: eventId,
        destroy: eventId,
        updateParagraphContent: eventImplementationId,
    },
}
