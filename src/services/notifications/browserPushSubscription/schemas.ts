import { pushServiceDomains } from './constants'
import { z } from 'zod'

function isPushServiceUrl(url: string) {
    if (!URL.canParse(url)) return false
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && pushServiceDomains.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
    )
}

const dataFieldSchemas = z.object({
    pushServiceUrl: z.string().max(2048).refine(isPushServiceUrl, 'Nettleseren bruker en push-tjeneste vi ikke støtter'),
    publicKey: z.string().min(1).max(256),
    authSecret: z.string().min(1).max(256),
})

const paramsFieldSchemas = z.object({
    userId: z.number(),
    pushServiceUrl: z.string(),
})

export const browserPushSubscriptionSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            pushServiceUrl: true,
            publicKey: true,
            authSecret: true,
        }),
    },
    params: {
        create: paramsFieldSchemas.pick({
            userId: true,
        }),
        destroy: paramsFieldSchemas.pick({
            pushServiceUrl: true,
        }),
    },
}
