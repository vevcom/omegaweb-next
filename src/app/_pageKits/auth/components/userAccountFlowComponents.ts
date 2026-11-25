'use client'
import UserEmailVerified from './UserEmailVerified'
import { implementAccountFlowComponents } from '@/components/AccountFlows/AccountFlowComponents'
import { resetPasswordAction, sendResetPasswordEmailAction, verifyEmailAction } from '@/services/auth/actions'
import { authLinks } from '@/pageKits/auth/links'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

const userAccountFlowComponents = implementAccountFlowComponents({
    actions: {
        sendResetPasswordEmail: sendResetPasswordEmailAction,
        resetPassword: resetPasswordAction,
        verifyEmail: verifyEmailAction,
    },
    site: ({ config }: { config: AuthPagesConfig }) => config.site,
    resetPasswordForm: { title: 'Nullstill passord', submitText: 'Endre passord' },
    afterPasswordChosen: { navigate: ({ config }) => authLinks(config).login() },
    EmailVerified: UserEmailVerified,
})

export const SendResetPasswordEmailForm = userAccountFlowComponents.SendResetPasswordEmailForm
export const ResetPasswordForm = userAccountFlowComponents.ResetPasswordForm
export const VerifyEmail = userAccountFlowComponents.VerifyEmail
