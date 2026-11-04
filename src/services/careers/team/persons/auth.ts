import { Require } from '@/auth/authorizer/Require'
import { editCareersTeam } from '@/services/careers/team/auth'

export const careerTeamImagesImagePanelAuth = Require.permission('IMAGE_ADMIN')

export const careersTeamPersonAuth = {
    create: editCareersTeam,
    update: editCareersTeam,
    move: editCareersTeam,
    destroy: editCareersTeam,
    updateImage: editCareersTeam,
} as const
