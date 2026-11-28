import {
    createCareersTeamDepartmentAction,
    destroyCareersTeamDepartmentAction,
    moveCareersTeamDepartmentAction,
    updateCareersTeamDepartmentAction,
    updateCareersTeamDepartmentParagraphAction,
} from './actions'
import { careersTeamContract } from '@/services/careers/team/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const careersTeamCapabilities = defineCapabilities(careersTeamContract, {
    createDepartment: createCareersTeamDepartmentAction,
    updateDepartment: updateCareersTeamDepartmentAction,
    moveDepartment: moveCareersTeamDepartmentAction,
    destroyDepartment: destroyCareersTeamDepartmentAction,
    updateDepartmentParagraph: updateCareersTeamDepartmentParagraphAction,
})
