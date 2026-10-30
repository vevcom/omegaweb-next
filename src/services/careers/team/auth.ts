import { Require } from '@/auth/authorizer/Require'

const editTeam = Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN')

export const careersTeamAuth = {
    readDepartments: Require.nothing(),
    createDepartment: editTeam,
    updateDepartment: editTeam,
    moveDepartment: editTeam,
    destroyDepartment: editTeam,
    updateDepartmentParagraph: editTeam,
    createPerson: editTeam,
    updatePerson: editTeam,
    movePerson: editTeam,
    destroyPerson: editTeam,
    updatePersonCmsImage: editTeam,
} as const
