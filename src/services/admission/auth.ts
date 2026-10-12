import { Require } from '@/auth/authorizer/Require'

const userIdOrAdmissionUse = Require.permission('ADMISSION_USE').or().userId()

export const admissionAuth = {
    createTrial: Require.user().permission('ADMISSION_USE'),
    readTrial: userIdOrAdmissionUse,
    userCompletedTrials: userIdOrAdmissionUse,
} as const
