import '@pn-server-only'

// The .env.default placeholder for unfilled-in secrets, treated the same as unset.
const UNSET_PLACEHOLDER = '<INSERT>'

function envValue(name: string): string | undefined {
    const value = process.env[name]
    if (!value || value === UNSET_PLACEHOLDER) return undefined
    return value
}

/**
 * The homeserver of the chat and how the app acts on it, see chat-infrastructure. Synapse takes
 * the app as an application service by `asToken`. MAS takes it as a client of its admin api, by the
 * id below and `masClientSecret`. Left unset, nothing is synced.
 */
export const chatServer = {
    /** Synapse, as the app reaches it. */
    homeserverUrl: envValue('CHAT_HOMESERVER_URL'),
    /** The part after the colon in every Matrix id on the homeserver. */
    serverName: envValue('CHAT_SERVER_NAME'),
    asToken: envValue('CHAT_AS_TOKEN'),
    /** MAS's admin api and the token endpoint beside it, which no browser reaches. */
    masUrl: envValue('CHAT_MAS_URL'),
    masClientSecret: envValue('CHAT_MAS_CLIENT_SECRET'),
}

/** The id the app has as a client in MAS's config, which chat-infrastructure fixes. */
export const CHAT_MAS_CLIENT_ID = '0000000000000000000MEGAWEB'

/** The localpart of the bot the app acts as on the homeserver, which its registration there names. */
export const CHAT_BOT_LOCALPART = 'omegaweb'

/** The localpart of the user the app reaches Synapse's admin api as, which the app makes in MAS. */
export const CHAT_ADMIN_LOCALPART = 'omegaweb-admin'

/** Whether the homeserver's accounts and spaces are kept in step with the database. */
export const chatIsManaged = Object.values(chatServer).every(value => value !== undefined)

/** The level a space's admins have in the space, which adds and removes its rooms and nothing else. */
export const SPACE_ADMIN_LEVEL = 50

/**
 * The level a space's admins have in the rooms of the space. It is one below the bot's, so the bot
 * can take it back, and a level nobody gives by hand, so those who hold it are the ones the sync
 * gave it to.
 */
export const ROOM_ADMIN_LEVEL = 99
