import { imageSchemas } from '@/services/images/subservice/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(32).trim().min(1),
    shortName: z.string().max(32).trim().min(1),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    shortName: z.string(),
})

const committee = dataFieldSchemas.pick({
    name: true,
    shortName: true,
})

const committeeId = paramsFieldSchemas.pick({
    id: true,
})

const committeeShortName = paramsFieldSchemas.pick({
    shortName: true,
})

export const committeeSchemas = {
    data: {
        // The logo is optional on create - committeeOperations.create falls back to the
        // DEFAULT_COMMITTEE_LOGO standard image when it's omitted.
        create: committee.merge(imageSchemas.data.uploadImage.partial()),
        update: committee.partial(),
        updateLogo: imageSchemas.data.uploadImage,
    },
    params: {
        read: z.union([
            committeeId,
            committeeShortName,
        ]),
        readArticle: committeeShortName,
        readParagraph: committeeShortName,
        updateParagraphContent: committeeShortName,
        updateLogo: committeeShortName,
        destroy: committeeId,
        update: committeeId,
        updateArticle: committeeShortName,
    },
}
