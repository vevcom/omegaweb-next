import { createLockerLocationAction, destroyLockerLocationAction, updateLockerLocationAction } from './actions'
import { lockerLocationContract } from '@/services/lockers/locations/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const lockerLocationCapabilities = defineCapabilities(lockerLocationContract, {
    create: createLockerLocationAction,
    update: updateLockerLocationAction,
    destroy: destroyLockerLocationAction,
})
