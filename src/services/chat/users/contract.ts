import { chatUserParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

const ofUser = chatUserParamsFieldSchemas.pick({
    userId: true,
})

export const chatUserContract = defineContract({
    /** Signing in to the chat is what gives a user their account there, so only they do it. */
    optIn: {
        params: ofUser,
        authorizer: Require.userId({ errorMessage: 'Bare du selv kan opprette chatkontoen din' }),
    },
    read: {
        params: ofUser,
        authorizer: Require.userId({ errorMessage: 'Bare du selv ser chatkontoen din' }),
    },
    readSpaces: {
        params: ofUser,
        authorizer: Require.userId({ errorMessage: 'Bare du selv ser chatområdene dine' }),
    },
    /** Whoever sees the users may write to the ones on the chat. */
    readDirectMessage: {
        params: ofUser,
        authorizer: Require.permission('USERS_USE'),
    },
})
