import { Zpn } from '@/lib/fields/zpn'
import { imageSchemas } from '@/services/images/subservice/schemas'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { SEX, RelationshipStatus, Theme } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const userDataFieldSchemas = z.object({
    username: z.string().max(50).min(2).toLowerCase(),
    sex: z.nativeEnum(SEX).optional().nullable(),
    email: z.string().trim().toLowerCase()
        .max(200)
        .min(2)
        .email(),
    emailVerified: z.string().datetime({}).optional().nullable(),
    mobile: z.string().regex(/^\+?\d{4,20}$/, { message: 'Skriv kun tall, uten mellomrom.' }),
    firstname: z.string().max(50).min(2),
    lastname: z.string().max(50).min(2),
    allergies: z.string().max(150).optional().nullable(),
    relationshipStatusText: z.string().max(150).optional(),
    relationshipStatus: z.nativeEnum(RelationshipStatus).optional(),
    theme: z.nativeEnum(Theme),
    password: z.string().max(50).min(12, {
        // eslint-disable-next-line
        message: 'Passoret må minst ha 12 tegn, en stor og en liten bokstav, et tall, en rune, to emojier, en musikk note, en magisk sopp og en dråpe smørekopp-blod (avsky).'
    }),
    confirmPassword: z.string().max(50).min(12),
    currentPassword: z.string().max(50).optional(),
    imageConsent: Zpn.checkboxOrBoolean({
        label: 'Accepted images'
    }).optional(),
    acceptedTerms: Zpn.checkboxOrBoolean({
        label: 'Accepted terms',
    }).refine(value => value, 'Du må godta vilkårene for å bruke siden.'),
    // Whatever the card reader gives, as is: it is only ever compared to what the reader gives later.
    studentCard: z.string().trim().min(1).max(100),
})

const groupFilter = z.object({
    groupOrder: z.union([z.number(), z.literal('ACTIVE')]),
    groupId: z.number()
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    userId: z.number(),
    username: z.string(),
    email: z.string().trim().toLowerCase(),
    studentCard: z.string(),
    query: z.string().trim().min(1).max(100),
    limit: z.number().int().min(1).max(25)
        .optional(),
    partOfName: z.string().max(100),
    groups: z.array(groupFilter),
    selectedGroup: groupFilter.nullable().optional(),
    sort: z.object({
        field: z.enum(['name', 'username']),
        direction: z.enum(['asc', 'desc']),
    }).optional(),
})

const passwordsMatch = (data: { password?: string, confirmPassword?: string }) => data.password === data.confirmPassword
const passwordsMatchMessage = 'Passordene må være like'

const id = paramsFieldSchemas.pick({
    id: true,
})

const username = paramsFieldSchemas.pick({
    username: true,
})

const userLookup = paramsFieldSchemas.pick({
    username: true,
    id: true,
    email: true,
    studentCard: true,
}).partial()

// The reads take the id out of a query string too, so it is coerced there.
const coercedId = z.coerce.number().optional()

export const userSchemas = {
    data: {
        create: userDataFieldSchemas.pick({
            email: true,
            firstname: true,
            lastname: true,
            username: true,
            emailVerified: true,
        }),

        update: userDataFieldSchemas.partial().pick({
            firstname: true,
            lastname: true,
            username: true,
            mobile: true,
            allergies: true,
            sex: true,
            imageConsent: true,
            relationshipStatusText: true,
            relationshipStatus: true,
        }),

        updateTheme: userDataFieldSchemas.pick({
            theme: true,
        }),

        updateProfile: userDataFieldSchemas.partial().pick({
            allergies: true,
            sex: true,
            imageConsent: true,
            relationshipStatusText: true,
            relationshipStatus: true,
        }).extend({
            mobile: userDataFieldSchemas.shape.mobile.or(z.literal('').transform(() => null)).optional(),
        }),

        register: userDataFieldSchemas.pick({
            allergies: true,
            password: true,
            confirmPassword: true,
            sex: true,
            imageConsent: true,
            acceptedTerms: true,
        }).refine(passwordsMatch, passwordsMatchMessage),

        updatePassword: userDataFieldSchemas.pick({
            password: true,
            confirmPassword: true,
        }).refine(passwordsMatch, passwordsMatchMessage),

        registerNewEmail: userDataFieldSchemas.pick({
            email: true,
            currentPassword: true,
        }),

        // Not an operation: the email a verification mail is sent to, validated by sendVerifyEmail.
        verifyEmail: userDataFieldSchemas.pick({
            email: true,
        }),

        updateProfileImage: imageSchemas.data.uploadImage,

        connectStudentCard: userDataFieldSchemas.pick({
            studentCard: true,
        }),
    },
    params: {
        read: userLookup.extend({ id: coercedId }),
        readBasic: paramsFieldSchemas.pick({
            username: true,
            id: true,
        }).partial().extend({ id: coercedId }),
        readOrNull: userLookup.extend({ id: coercedId }),
        readProfile: username,
        readUserWithBalance: userLookup,

        readPage: readPageInputSchemaObject(
            id,
            paramsFieldSchemas.pick({
                partOfName: true,
                groups: true,
                selectedGroup: true,
                sort: true,
            })
        ),

        search: paramsFieldSchemas.pick({
            query: true,
            limit: true,
        }),

        connectStudentCard: id,
        update: z.union([id, username]),
        updateProfile: username,
        updateBioParagraphContent: paramsFieldSchemas.pick({
            userId: true,
        }),
        updatePassword: id,
        updateTheme: username,
        registerNewEmail: id,
        register: id,
        destroy: id,
        updateProfileImage: username,
    },
}
