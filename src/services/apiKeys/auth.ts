import { Require } from '@/auth/authorizer/Require'

const baseAuthorizer = Require.permission('APIKEY_ADMIN')

export const apiKeyAuth = {
    create: baseAuthorizer,
    read: baseAuthorizer,
    readMany: baseAuthorizer,
    readWithHash: baseAuthorizer,
    update: baseAuthorizer,
    updateIfExpired: baseAuthorizer,
    destroy: baseAuthorizer,
} as const
