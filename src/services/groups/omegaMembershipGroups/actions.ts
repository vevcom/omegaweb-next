'use server'

import { makeAction } from '@/services/serverAction'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'

export const updateOmegaMembershipUserLevelAction = makeAction(omegaMembershipGroupOperations.updateUserLevel)
export const updateOmegaMembershipUserOrderAction = makeAction(omegaMembershipGroupOperations.updateUserOrder)
