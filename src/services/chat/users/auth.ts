import { Require } from '@/auth/authorizer/Require'

export const chatProfileImagesImagePanelAuth = Require.permission('USERS_ADMIN')

export const chatUserAuth = {
    /** Signing in to the chat is what gives a user their account there, so only they do it. */
    optIn: Require.userId({ errorMessage: 'Bare du selv kan opprette chatkontoen din' }),
    read: Require.userId({ errorMessage: 'Bare du selv ser chatkontoen din' }),
    readSpaces: Require.userId({ errorMessage: 'Bare du selv ser chatområdene dine' }),
    readPicture: Require.userId({ errorMessage: 'Bare du selv ser chatkontoen din' }),
    /** A chat picture is the user's own to choose, so not even a user admin sets it for them. */
    updatePicture: Require.userId({ errorMessage: 'Bare du selv velger chatbildet ditt' }),
    destroyPicture: Require.userId({ errorMessage: 'Bare du selv fjerner chatbildet ditt' }),
    /** The chat pages show the signed-in user their own chat, and a company user has none. */
    openPages: Require.user(),
    /** A user who sees the users may write to the ones on the chat. */
    readDirectMessage: Require.user().permission('USERS_USE'),
} as const
