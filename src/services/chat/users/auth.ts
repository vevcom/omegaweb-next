import { Require } from '@/auth/authorizer/Require'

export const chatUserAuth = {
    /** Signing in to the chat is what gives a user their account there, so only they do it. */
    optIn: Require.userId({ errorMessage: 'Bare du selv kan opprette chatkontoen din' }),
    read: Require.userId({ errorMessage: 'Bare du selv ser chatkontoen din' }),
    readSpaces: Require.userId({ errorMessage: 'Bare du selv ser chatområdene dine' }),
} as const
