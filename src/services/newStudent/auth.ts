import { Require } from '@/auth/authorizer/Require'

export const newStudentAuth = {
    read: Require.nothing(),
    update: Require.permission('NEW_STUDENT_ADMIN')
} as const
