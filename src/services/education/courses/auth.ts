import { Require } from '@/auth/authorizer/Require'

export const courseAuth = {
    create: Require.permission('COURSES_ADMIN'),
    read: Require.permission('COURSES_USE'),
    readMany: Require.permission('COURSES_USE'),
    update: Require.permission('COURSES_ADMIN'),
    destroy: Require.permission('COURSES_ADMIN'),
} as const
