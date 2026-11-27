import { lockerLocationDataFieldSchemas, lockerLocationParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

const location = lockerLocationDataFieldSchemas.pick({
    building: true,
    floor: true,
})

const locationId = lockerLocationParamsFieldSchemas.pick({
    id: true,
})

export const lockerLocationContract = defineContract({
    create: {
        data: location,
        authorizer: Require.permission('LOCKER_ADMIN'),
    },
    readAll: {
        authorizer: Require.nothing(),
    },
    update: {
        params: locationId,
        data: location,
        authorizer: Require.permission('LOCKER_ADMIN'),
    },
    destroy: {
        params: locationId,
        authorizer: Require.permission('LOCKER_ADMIN'),
    },
})
