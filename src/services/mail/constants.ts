import { isBuildPhase } from '@/lib/isBuildPhase'
import { ServiceError } from '@/services/error'


export const NTNUEmailDomain = 'stud.ntnu.no'

export const validMailAddressDomains = isBuildPhase() ? ['build-phase-placeholder.invalid'] : (() => {
    if (!process.env.EMAIL_DOMAIN || !process.env.EMAIL_HOSTNAME) {
        throw new ServiceError('INVALID CONFIGURATION', 'The env vars EMAIL_DOMAIN and EMAIL_HOSTNAME must be set')
    }
    return [
        process.env.EMAIL_DOMAIN,
        process.env.EMAIL_HOSTNAME
    ] as const
})()
