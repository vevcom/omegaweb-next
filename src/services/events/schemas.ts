import { eventVariantSetupFormSchema } from './variants/schemas'
import { locationMapSchema } from '@/lib/maps/locationMap'
import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { convertAmount } from '@/lib/currency/convert'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { searchMaxLength } from '@/services/search/constants'
import { EventCanView } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(5, 'Navnet må være minst 5 tegn').max(70, 'Navnet må være maks 70 tegn'),
    location: z.string().min(2, 'Stedet må være minst 2 tegn').max(100, 'Stedet må være maks 100 tegn')
        .or(z.literal('').transform(() => null)),
    locationMap: Zpn.json({ label: 'Kart', schema: locationMapSchema.nullable() }).optional(),
    order: z.coerce.number().int().optional(),
    eventStart: Zpn.date({ label: 'Starttid' }),
    eventEnd: Zpn.date({ label: 'Sluttid' }),
    canBeViewedBy: z.nativeEnum(EventCanView),
    // The committee hosting the event, shown on its page. The form sends 'NULL' for none.
    hostedByCommitteeId: z.literal('NULL').transform(() => null).or(z.coerce.number().int()).optional(),
    // The account a paid event is paid into. Linked apart from the rest of the event (see
    // connectToLedgerAccount), since linking an account takes access to that account.
    ledgerAccountId: z.coerce.number().int(),

    // The first variant and quota of a new event, when it takes registration. Later ones, and
    // changes to these, go through the variant and quota services.
    takesRegistration: Zpn.checkboxOrBoolean({ label: 'Tar påmelding' }),
    places: z.coerce.number().int().min(0).optional(),
    registrationStart: Zpn.date({ label: 'Påmeldingsstart' }).optional(),
    registrationEnd: Zpn.date({ label: 'Påmeldingsslutt' }).optional(),
    takesPayment: Zpn.checkboxOrBoolean({ label: 'Tar betaling' }).default(false),
    price: z.coerce.number().min(0).transform(val => convertAmount(val)).optional(),
    paymentStart: Zpn.date({ label: 'Betalingsstart' }).optional(),
    paymentEnd: Zpn.date({ label: 'Betalingsslutt' }).optional(),
    requeueUnpaidRegistrations: Zpn.checkboxOrBoolean({ label: 'Flytt ubetalte bakerst på ventelisten' }).default(false),
    quotaVisibilityRequirements: Zpn.json({
        label: 'Hvem kan melde seg på',
        schema: visibilityRequirementsSchema,
    }).default([]),

    waitingList: Zpn.checkboxOrBoolean({ label: 'Venteliste' }),
    bindingRegistration: Zpn.checkboxOrBoolean({ label: 'Bindende påmelding' }).default(false),
    allowRegistrationInMultipleVariants: Zpn.checkboxOrBoolean({ label: 'Plass i flere varianter' }).default(false),

    tagIds: Zpn.numberListCheckboxFriendly({ label: 'Tagger' }),

    published: Zpn.checkboxOrBoolean({ label: 'Publisert' }),
    notifyAboutChange: Zpn.checkboxOrBoolean({ label: 'Varsle de påmeldte' }).default(false),

    // What the form on the event's page holds besides the event's own fields. See saveSetup.
    variants: Zpn.json({
        label: 'Påmelding',
        schema: eventVariantSetupFormSchema,
    }),
    adminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere arrangementet'),
    }),
    // The form sends 'NULL' while no account is picked, which leaves the link as it is.
    ledgerAccountSelection: z.literal('NULL').transform(() => undefined).or(z.coerce.number().int()),

    // Created with an empty admin visibility the event would be administrable by anyone until
    // someone narrowed it. A requirement with no conditions can never be satisfied, and so means
    // no one but those bypassing with EVENT_ADMIN.
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere arrangementet'),
    }),
})

/**
 * The fields as an authorized operation has parsed them. An internal operation parses what it is
 * given once more, so it takes these: parsing them again changes nothing.
 */
const parsedFieldSchemas = dataFieldSchemas.extend({
    location: z.string().nullable(),
    hostedByCommitteeId: z.number().int().nullable().optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number(),
    name: z.string().trim().max(searchMaxLength).optional(),
    tags: z.array(z.string()).nullable(),
})

const waitingListRefiner = (data: {
    waitingList?: boolean,
    takesRegistration?: boolean
}) => (data.takesRegistration || !data.waitingList)

const waitingListMessage = 'Kan ikke ha venteliste uten påmelding'

const bindingRegistrationRefiner = (data: {
    bindingRegistration?: boolean,
    takesRegistration?: boolean
}) => (data.takesRegistration || !data.bindingRegistration)

const bindingRegistrationMessage = 'Kan ikke ha bindende påmelding uten påmelding'

const eventFields = {
    name: true,
    location: true,
    locationMap: true,
    order: true,
    eventStart: true,
    eventEnd: true,
    canBeViewedBy: true,
    hostedByCommitteeId: true,
    tagIds: true,
    waitingList: true,
    bindingRegistration: true,
    allowRegistrationInMultipleVariants: true,
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
            takesRegistration: true,
            places: true,
            registrationStart: true,
            registrationEnd: true,
            takesPayment: true,
            price: true,
            paymentStart: true,
            paymentEnd: true,
            requeueUnpaidRegistrations: true,
            quotaVisibilityRequirements: true,
            visibilityAdminRequirements: true,
        })
            .partial({
                location: true,
                eventStart: true,
                eventEnd: true,
                canBeViewedBy: true,
                tagIds: true,
                waitingList: true,
                takesRegistration: true,
                visibilityAdminRequirements: true,
            })
            .refine(waitingListRefiner, waitingListMessage)
            .refine(bindingRegistrationRefiner, bindingRegistrationMessage),
        update: dataFieldSchemas.pick({
            ...eventFields,
            notifyAboutChange: true,
        }).partial(),
        updateFields: parsedFieldSchemas.pick({
            ...eventFields,
            notifyAboutChange: true,
        }).partial(),
        saveSetup: dataFieldSchemas.pick({
            ...eventFields,
            notifyAboutChange: true,
            variants: true,
            adminRequirements: true,
            ledgerAccountSelection: true,
        }).partial(),
        setPublished: dataFieldSchemas.pick({
            published: true,
        }),
        connectToLedgerAccount: dataFieldSchemas.pick({
            ledgerAccountId: true,
        }),
    },
    params: {
        adminVisibility: eventId,
        read: eventId,
        readStatistics: eventId,
        readManyCurrent: paramsFieldSchemas.pick({
            tags: true,
            name: true,
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
        update: eventId,
        updateFields: eventId,
        saveSetup: eventId,
        updateCmsCoverImage: eventImplementationId,
        setPublished: eventId,
        connectToLedgerAccount: eventId,
        destroy: eventId,
        updateParagraphContent: eventImplementationId,
    },
}
