import { chatAuth } from '@/services/chat/constants'
import { Smorekopp } from '@/services/error'
import { notFound } from 'next/navigation'
import type { ServerPageSession } from '@/app/ServerPage'

/**
 * Gives a chat page the signed-in user, whose chat it shows. The page reads with their id, and
 * what it reads with is what guards it. It is meant to be called from the page's serverPage
 * operation. Without a chat the page is not found. A visitor is sent to sign in, and a company
 * user, who has no chat, is turned away.
 */
export function authorizeChatPage(session: ServerPageSession) {
    if (!chatAuth) notFound()
    if (!session.user) throw new Smorekopp(session.companyUser ? 'UNAUTHORIZED' : 'UNAUTHENTICATED')
    return session.user
}
