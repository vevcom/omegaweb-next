'use server'
import { makeAction } from '@/services/serverAction'
import { flairOperations } from '@/services/flairs/operations'

export const createFlairAction = makeAction(flairOperations.create)
export const updateFlairAction = makeAction(flairOperations.update)
export const destroyFlairAction = makeAction(flairOperations.destroy)

export const assignFlairToUserAction = makeAction(flairOperations.assignToUser)
export const unAssignFlairToUserAction = makeAction(flairOperations.unAssignToUser)

export const increaseFlairRankAction = makeAction(flairOperations.increaseRank)
export const decreaseFlairRankAction = makeAction(flairOperations.decreaseRank)

export const updateFlairImageAction = makeAction(flairOperations.updateImage)
