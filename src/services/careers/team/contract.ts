import { editCareersTeam } from './auth'
import { careersTeamDataFieldSchemas, careersTeamParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { cmsParagraphContract } from '@/services/cms/paragraphs/contract'
import { defineContract } from '@/services/serviceContract'

const departmentName = careersTeamDataFieldSchemas.pick({
    name: true,
})

const departmentId = careersTeamParamsFieldSchemas.pick({
    departmentId: true,
})

export const careersTeamContract = defineContract({
    readDepartments: {
        authorizer: Require.nothing(),
    },
    createDepartment: {
        data: departmentName,
        authorizer: editCareersTeam,
    },
    updateDepartment: {
        params: departmentId,
        data: departmentName,
        authorizer: editCareersTeam,
    },
    moveDepartment: {
        params: departmentId,
        data: careersTeamDataFieldSchemas.pick({
            direction: true,
        }),
        authorizer: editCareersTeam,
    },
    destroyDepartment: {
        params: departmentId,
        authorizer: editCareersTeam,
    },
    updateDepartmentParagraph: cmsParagraphContract.updateContent.implement({
        authorizer: editCareersTeam,
    }),
})
