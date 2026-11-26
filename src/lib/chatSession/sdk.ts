import type { ChatSessionBrowser } from './browser'
import type { ChatSessionConfig } from '@/services/chat/session/types'
import type * as sdk from 'matrix-js-sdk'
import type * as cryptoSdk from 'matrix-js-sdk/lib/crypto-api'

export type ChatSdk = typeof sdk
export type ChatCryptoSdk = typeof cryptoSdk

let loaded: ChatSdk | undefined
let loadedCrypto: ChatCryptoSdk | undefined

/**
 * The chat's SDK, loaded when it is first asked for. It is large and for the browser alone, so no
 * module imports it at its top: that keeps it out of what the server renders and out of every page
 * that has no chat.
 */
export const loadChatSdk = async (): Promise<ChatSdk> => (loaded ??= await import('matrix-js-sdk'))

/** The SDK where it has been loaded, which it has wherever there is a client. */
export function loadedChatSdk(): ChatSdk {
    if (!loaded) throw new Error('The chat SDK is asked for before it is loaded')
    return loaded
}

/** What the SDK has for encryption that it keeps apart from the rest, loaded with the encryption, see startEncryption. */
export const loadChatCryptoSdk = async (): Promise<ChatCryptoSdk> => (
    loadedCrypto ??= await import('matrix-js-sdk/lib/crypto-api')
)

/** That part of the SDK where it has been loaded, which it has wherever a client has encryption. */
export function loadedChatCryptoSdk(): ChatCryptoSdk {
    if (!loadedCrypto) throw new Error('The encryption of the chat SDK is asked for before it is loaded')
    return loadedCrypto
}

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
