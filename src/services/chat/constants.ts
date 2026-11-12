import '@pn-server-only'

/**
 * The service that signs users in to the chat, MAS in chat-infrastructure, as browsers reach it. It
 * signs them in through the provider on the auth domain, as a client named by its host, see
 * src/services/auth/oidc/clients.ts. Left unset, there is no chat to sign in to.
 */
export const chatAuth = chatAuthOf(process.env.CHAT_AUTH_URL)

export type ChatAuth = { origin: string, host: string }

function chatAuthOf(url: string | undefined): ChatAuth | null {
    if (!url) return null
    const parsed = URL.parse(url)
    if (!parsed) throw new Error(`CHAT_AUTH_URL is not a url: ${url}`)
    return { origin: parsed.origin, host: parsed.hostname.toLowerCase() }
}

/**
 * The localparts the application's own users on the homeserver have, see chat-infrastructure: the
 * bot it acts as, and the user it reaches Synapse's admin api as. No user is given one of them.
 */
export const RESERVED_CHAT_LOCALPARTS: readonly string[] = ['omegaweb', 'omegaweb-admin']
