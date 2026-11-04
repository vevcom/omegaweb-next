import { Require } from '@/auth/authorizer/Require'

export const editCareersTeam = Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN')

export const careersTeamAuth = {
    readDepartments: Require.nothing(),
    createDepartment: editCareersTeam,
    updateDepartment: editCareersTeam,
    moveDepartment: editCareersTeam,
    destroyDepartment: editCareersTeam,
    updateDepartmentParagraph: editCareersTeam,
} as const
