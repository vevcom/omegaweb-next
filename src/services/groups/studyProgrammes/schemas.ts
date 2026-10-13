import { ClassLevel } from '@/prisma-generated-pn-types'
import { z } from 'zod'

// Text inputs arrive as strings, and an empty one means "not set" rather than 0.
const optionalIntFromForm = z.preprocess(
    value => (value === '' ? null : value),
    z.coerce.number().int().nullable().optional()
)

const optionalStringFromForm = z.preprocess(
    value => (value === '' ? null : value),
    z.string().trim().nullable().optional()
)

// A select submits '' when nothing is picked, which means "not set" rather than a level.
const optionalClassLevelFromForm = z.preprocess(
    value => (value === '' ? null : value),
    z.nativeEnum(ClassLevel).nullable().optional()
)

const booleanFromForm = z.union([
    z.boolean(),
    z.enum(['true', 'false']).transform(value => value === 'true'),
])

const dataFieldSchemas = z.object({
    name: z.string().min(1).trim(),
    code: z.string().min(1).trim(),
    insititueCode: optionalStringFromForm,
    classLevel: optionalClassLevelFromForm,
    yearsLength: optionalIntFromForm,
    partOfOmega: booleanFromForm.optional(),
    studyProgrammeIds: z.number().array(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    userId: z.number(),
})

const studyProgramme = dataFieldSchemas.pick({
    name: true,
    code: true,
    insititueCode: true,
    classLevel: true,
    yearsLength: true,
    partOfOmega: true,
})

const studyProgrammeId = paramsFieldSchemas.pick({
    id: true,
})

const user = paramsFieldSchemas.pick({
    userId: true,
})

export const studyProgrammeSchemas = {
    data: {
        create: studyProgramme,
        update: studyProgramme.partial(),
        upsertMany: z.object({
            studyProgrammes: studyProgramme.array(),
        }),
        recordFeideReturnedForUser: dataFieldSchemas.pick({
            studyProgrammeIds: true,
        }),
    },
    params: {
        read: studyProgrammeId,
        update: studyProgrammeId,
        destroy: studyProgrammeId,
        readFeideReturnedForUser: user,
        recordFeideReturnedForUser: user,
    },
}
