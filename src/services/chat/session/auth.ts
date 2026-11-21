import { Require } from '@/auth/authorizer/Require'

export const chatSessionAuth = {
    /** A browser is signed in to the chat as the user signed in here, so only they read how. */
    read: Require.userId({ errorMessage: 'Bare du selv logger inn på chatten din' }),
} as const
