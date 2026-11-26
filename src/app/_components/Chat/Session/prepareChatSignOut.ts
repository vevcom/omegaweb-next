import { chatSessionBrowser } from '@/lib/chatSession/browser'
import { forgetSession, readStoredSession, requestSignOut } from '@/lib/chatSession/storage'
import { readChatSessionAction } from '@/services/chat/session/actions'
import type { ChatSessionBrowser } from '@/lib/chatSession/browser'

type Dependencies = {
    openBrowser?: () => ChatSessionBrowser,
    readChatSession?: typeof readChatSessionAction,
}

/**
 * Prepares for the browser to be signed out of the chat as the user logs out here, and says whether
 * it is to go by the chat's sign-out page for it. That is where a session with the chat is ended:
 * it is asked for in this tab, which that page requires. A browser holds a session only on the
 * domain that serves the chat pages.
 *
 * That page reads what this asks the app for, and shows an error and sends the browser nowhere
 * when it cannot. So the browser goes by it only when the app answered here. With no user signed in
 * here, no sign in on the chat pages, or an app that fails, the session is forgotten in the browser
 * and that is all. It never throws, and a browser whose storage cannot be read has no session to
 * end: logging out here does not depend on the chat.
 */
export async function prepareChatSignOut(
    userId: number | null,
    { openBrowser = chatSessionBrowser, readChatSession = readChatSessionAction }: Dependencies = {},
): Promise<boolean> {
    try {
        const browser = openBrowser()
        if (!readStoredSession(browser)) return false
        const answer = userId === null ? null : await readChatSession({ params: { userId } }).catch(() => null)
        if (!answer?.success) {
            await forgetSession(browser)
            return false
        }
        requestSignOut(browser)
        return true
    } catch {
        return false
    }
}
