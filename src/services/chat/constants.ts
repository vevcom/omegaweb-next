/**
 * The localparts the application's own users on the homeserver have, see chat-infrastructure: the
 * bot it acts as, and the user it reaches Synapse's admin api as. No user is given one of them.
 */
export const RESERVED_CHAT_LOCALPARTS: readonly string[] = ['omegaweb', 'omegaweb-admin']
