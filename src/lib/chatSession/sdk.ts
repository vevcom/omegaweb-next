import type { ChatSessionBrowser } from './browser'
import type { ChatSessionConfig } from '@/services/chat/session/types'

/**
 * The chat's SDK, loaded when it is first asked for. It is large and for the browser alone, so no
 * module imports it at its top: that keeps it out of what the server renders and out of every page
 * that has no chat.
 */
export const loadChatSdk = () => import('matrix-js-sdk')

/** The chat pages as a client of the chat's sign in, which the homeserver says where is. */
export async function oauthOf(
    config: ChatSessionConfig,
    browser: ChatSessionBrowser,
    context: { deviceId?: string, codeVerifier?: string } = {},
) {
    const { createClient, OAuth2 } = await loadChatSdk()
    const metadata = await createClient({ baseUrl: config.homeserverUrl, fetchFn: browser.fetch }).getAuthMetadata()
    return new OAuth2(metadata, { clientId: config.clientId, ...context }, undefined, { fetchFn: browser.fetch })
}
