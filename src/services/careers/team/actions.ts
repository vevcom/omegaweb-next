'use server'
import { careersTeamOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCareersTeamDepartmentAction = makeAction(careersTeamOperations.createDepartment)
export const updateCareersTeamDepartmentAction = makeAction(careersTeamOperations.updateDepartment)
export const moveCareersTeamDepartmentAction = makeAction(careersTeamOperations.moveDepartment)
export const destroyCareersTeamDepartmentAction = makeAction(careersTeamOperations.destroyDepartment)
export const updateCareersTeamDepartmentParagraphAction = makeAction(careersTeamOperations.updateDepartmentParagraph)
export const createCareersTeamPersonAction = makeAction(careersTeamOperations.createPerson)
export const updateCareersTeamPersonAction = makeAction(careersTeamOperations.updatePerson)
export const moveCareersTeamPersonAction = makeAction(careersTeamOperations.movePerson)
export const destroyCareersTeamPersonAction = makeAction(careersTeamOperations.destroyPerson)
export const updateCareersTeamPersonCmsImageAction = makeAction(careersTeamOperations.updatePersonCmsImage)
