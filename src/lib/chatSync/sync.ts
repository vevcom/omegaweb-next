import '@pn-server-only'
import { ChatClient } from './client'
import { chatServer } from './constants'
import { SyncReport } from './report'
import { deactivateAccountsOfDeletedUsers, syncNames } from './accounts'
import { syncSpaces } from './spaces'
import logger from '@/lib/logger'
import type { Homeserver } from './client'

/**
 * Brings the chat's homeserver in step with the database: the accounts, and then the spaces, which
 * are made of them. What users make themselves, the rooms and their messages, is left alone. Run
 * by the chat worker (src/workers/definitions.ts).
 *
 * @throws once the run is through, when the homeserver refused any change.
 */
export async function syncChat(homeserver: Homeserver = chatClientFromEnv()): Promise<void> {
    const report = new SyncReport()

    await homeserver.registerBot()
    await deactivateAccountsOfDeletedUsers(homeserver, report)
    await syncNames(homeserver, report)
    await syncSpaces(homeserver, report)

    if (report.carriedOut > 0) logger.info(`Chat sync made ${report.carriedOut} changes`)
    if (report.refused.length > 0) {
        throw new Error(`Chat sync did the rest, and the homeserver refused to ${report.refused.join('; ')}`)
    }
}

let clientFromEnv: ChatClient | null = null

/** One client for the life of the process, since it keeps its tokens between runs. */
function chatClientFromEnv(): ChatClient {
    const { homeserverUrl, serverName, asToken, masUrl, masClientSecret } = chatServer
    if (!homeserverUrl || !serverName || !asToken || !masUrl || !masClientSecret) {
        throw new Error('The chat sync needs CHAT_HOMESERVER_URL, CHAT_SERVER_NAME, CHAT_AS_TOKEN, CHAT_MAS_URL and '
            + 'CHAT_MAS_CLIENT_SECRET')
    }
    clientFromEnv ??= new ChatClient({ homeserverUrl, serverName, asToken, masUrl, masClientSecret })
    return clientFromEnv
}
