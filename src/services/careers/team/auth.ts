import { Require } from '@/auth/authorizer/Require'

export const editCareersTeam = Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN')
