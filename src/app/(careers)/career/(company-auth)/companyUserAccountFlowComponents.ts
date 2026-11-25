'use client'
import { signInAsCompanyUser } from '@/app/(careers)/career/(company-auth)/companyLogin'
import CompanyUserEmailVerified from '@/app/(careers)/career/(company-auth)/CompanyUserEmailVerified'
import { implementAccountFlowComponents } from '@/components/AccountFlows/AccountFlowComponents'
import { careerLinks } from '@/app/(careers)/links'
import {
    chooseCompanyUserPasswordAction,
    sendCompanyUserResetPasswordEmailAction,
    verifyCompanyUserEmailAction,
} from '@/services/careers/companies/users/auth/actions'

const companyUserAccountFlowComponents = implementAccountFlowComponents({
    actions: {
        sendResetPasswordEmail: sendCompanyUserResetPasswordEmailAction,
        resetPassword: chooseCompanyUserPasswordAction,
        verifyEmail: verifyCompanyUserEmailAction,
    },
    site: () => 'CAREERS',
    resetPasswordForm: { title: 'Velg passord', submitText: 'Lagre passord og logg inn' },
    afterPasswordChosen: {
        signIn: async (email, password) => await signInAsCompanyUser(email, password) === null,
        signedIn: careerLinks.frontpage(),
        // Signing in can only fail for a reason the login page explains better, such as someone
        // else being signed in on this browser.
        signInFailed: careerLinks.companyLogin(),
    },
    EmailVerified: CompanyUserEmailVerified,
})

export const SendResetPasswordEmailForm = companyUserAccountFlowComponents.SendResetPasswordEmailForm
export const ResetPasswordForm = companyUserAccountFlowComponents.ResetPasswordForm
export const VerifyEmail = companyUserAccountFlowComponents.VerifyEmail
