import { chatUserAuth } from '@/services/chat/users/auth'
import { chatAuth } from '@/services/chat/constants'
import { notFound } from 'next/navigation'
import type { ServerPageSession } from '@/app/ServerPage'

/**
 * Guards a chat page and gives the signed-in user, whose chat it shows. It is meant to be called
 * from the page's serverPage operation. Without a chat the page is not found.
 */
export function authorizeChatPage(session: ServerPageSession) {
    if (!chatAuth) notFound()
    return chatUserAuth.openPages.auth(session).requireAuthorized().session.user
}
