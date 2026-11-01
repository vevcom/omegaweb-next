'use server'
import { careersTeamPersonOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCareersTeamPersonAction = makeAction(careersTeamPersonOperations.create)
export const updateCareersTeamPersonAction = makeAction(careersTeamPersonOperations.update)
export const moveCareersTeamPersonAction = makeAction(careersTeamPersonOperations.move)
export const destroyCareersTeamPersonAction = makeAction(careersTeamPersonOperations.destroy)
export const updateCareersTeamPersonImageAction = makeAction(careersTeamPersonOperations.updateImage)
