import { Zpn } from '@/lib/fields/zpn'
import { isSafeLink, safeLinkMessage } from '@/lib/fields/safeLink'
import { imageSchemas } from '@/services/images/subservice/schemas'
import { z } from 'zod'

const dateOrderRefiner = (data: { startDate?: Date, endDate?: Date }) =>
    !data.startDate || !data.endDate || data.startDate <= data.endDate

const dateOrderMessage = 'Til-datoen kan ikke være før fra-datoen'

const dataFieldSchemas = z.object({
    title: z.string().min(2, 'Minimum lengde er 2 tegn').max(80, 'Maks lengde er 80 tegn'),
    text: z.string().min(2, 'Minimum lengde er 2 tegn').max(300, 'Maks lengde er 300 tegn'),
    link: z.string().min(1, 'Lenken kan ikke være tom').refine(isSafeLink, safeLinkMessage),
    startDate: Zpn.date({ label: 'Fra dato' }),
    endDate: Zpn.date({ label: 'Til dato' }),
})

const paramsFieldSchemas = z.object({
    promoId: z.number(),
})

const promo = dataFieldSchemas.pick({
    title: true,
    text: true,
    link: true,
    startDate: true,
    endDate: true,
})

const promoId = paramsFieldSchemas.pick({
    promoId: true,
})

export const promoSchemas = {
    data: {
        create: promo.merge(imageSchemas.data.uploadImage).refine(dateOrderRefiner, dateOrderMessage),
        update: promo.partial().refine(dateOrderRefiner, dateOrderMessage),
        updateImage: imageSchemas.data.uploadImage,
    },
    params: {
        update: promoId,
        updateImage: promoId,
        read: promoId,
        destroy: promoId,
    },
}
