'use server'
import { careersTeamOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCareersTeamDepartmentAction = makeAction(careersTeamOperations.createDepartment)
export const updateCareersTeamDepartmentAction = makeAction(careersTeamOperations.updateDepartment)
export const moveCareersTeamDepartmentAction = makeAction(careersTeamOperations.moveDepartment)
export const destroyCareersTeamDepartmentAction = makeAction(careersTeamOperations.destroyDepartment)
export const updateCareersTeamDepartmentParagraphAction = makeAction(careersTeamOperations.updateDepartmentParagraph)
