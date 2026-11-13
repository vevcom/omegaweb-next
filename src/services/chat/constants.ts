import '@pn-server-only'
import { CHAT_ADMIN_LOCALPART, CHAT_BOT_LOCALPART } from '@/lib/chatSync/constants'

/**
 * The service that signs users in to the chat, MAS in chat-infrastructure, as browsers reach it. It
 * signs them in through the provider on the auth domain, as a client named by its host, see
 * src/services/auth/oidc/clients.ts. Left unset, there is no chat to sign in to.
 */
export const chatAuth = originAndHostOf('CHAT_AUTH_URL')

/** The chat client, Element in chat-infrastructure, as browsers reach it. Left unset, nothing links to the chat. */
export const chatClientOrigin = originAndHostOf('CHAT_CLIENT_URL')?.origin ?? null

export type ChatAuth = { origin: string, host: string }

function originAndHostOf(envName: 'CHAT_AUTH_URL' | 'CHAT_CLIENT_URL'): ChatAuth | null {
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
