import '@ow-server-only'
import { CHAT_ADMIN_LOCALPART, CHAT_BOT_LOCALPART, chatServer } from '@/lib/chatSync/constants'

/**
 * The service that signs users in to the chat, MAS in chat-infrastructure, as browsers reach it. It
 * signs them in through the provider on the auth domain, as a client named by its host, see
 * src/services/auth/oidc/clients.ts. Left unset, there is no chat to sign in to.
 */
export const chatAuth = originAndHostOf('CHAT_AUTH_URL')

/** The chat client, Element in chat-infrastructure, as browsers reach it. Left unset, nothing links to the chat. */
export const chatClientOrigin = originAndHostOf('CHAT_CLIENT_URL')?.origin ?? null

const homeserverPublicOrigin = originAndHostOf('CHAT_HOMESERVER_PUBLIC_URL')?.origin

/**
 * What the chat pages sign the user's browser in to the chat by: the homeserver as browsers reach
 * it, its sign in, and the server name the Matrix ids end in. The homeserver is Synapse in
 * chat-infrastructure, which the app itself reaches by CHAT_HOMESERVER_URL. Null with any of the
 * three left unset, and then the chat pages sign nobody in.
 */
export const chatSignIn = chatAuth && homeserverPublicOrigin && chatServer.serverName ? {
    homeserverOrigin: homeserverPublicOrigin,
    authOrigin: chatAuth.origin,
    serverName: chatServer.serverName,
} : null

/**
 * The id the chat pages have as a client in MAS's config, which chat-infrastructure fixes. It signs
 * a user's browser in, see src/services/chat/session, and has no secret.
 */
export const CHAT_SESSION_CLIENT_ID = '000000000000000000MEGACHAT'

/**
 * The id the provider on the auth domain has in MAS's config, which chat-infrastructure fixes too.
 * MAS's addresses for what concerns the provider end in it.
 */
export const CHAT_AUTH_PROVIDER_ID = '000000000000000000000VEVEN'

export type ChatAuth = { origin: string, host: string }

function originAndHostOf(envName: 'CHAT_AUTH_URL' | 'CHAT_CLIENT_URL' | 'CHAT_HOMESERVER_PUBLIC_URL'): ChatAuth | null {
    const url = process.env[envName]
    if (!url) return null
    const parsed = URL.parse(url)
    if (!parsed) throw new Error(`${envName} is not a url: ${url}`)
    return { origin: parsed.origin, host: parsed.hostname.toLowerCase() }
}

/**
 * The localparts the application's own users on the homeserver have, see src/lib/chatSync. No user
 * is given one of them.
 */
export const RESERVED_CHAT_LOCALPARTS: readonly string[] = [CHAT_BOT_LOCALPART, CHAT_ADMIN_LOCALPART]
