import { Zpn } from '@/lib/fields/zpn'
import { imageSchemas } from '@/services/images/subservice/schemas'
import { z } from 'zod'

/**
 * The promo link ends up straight in the href of the banner anchor, so it is restricted to
 * internal paths and http(s) urls. Schemes like `javascript:` would otherwise run on click,
 * and protocol relative paths (`//host`) would leave the site while looking internal.
 */
const isSafePromoLink = (link: string): boolean => {
    if (link.startsWith('//')) return false
    if (link.startsWith('/')) return true
    try {
        return ['http:', 'https:'].includes(new URL(link).protocol)
    } catch {
        return false
    }
}

const safePromoLinkMessage = 'Lenken må være en intern sti (/...) eller en http(s)-URL'

const dateOrderRefiner = (data: { startDate?: Date, endDate?: Date }) =>
    !data.startDate || !data.endDate || data.startDate <= data.endDate

const dateOrderMessage = 'Til dato kan ikke være før fra dato'

const dataFieldSchemas = z.object({
    title: z.string().min(2, 'min length is 2').max(80, 'max length is 80'),
    text: z.string().min(2, 'min length is 2').max(300, 'max length is 300'),
    link: z.string().min(1, 'Lenken kan ikke være tom').refine(isSafePromoLink, safePromoLinkMessage),
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
