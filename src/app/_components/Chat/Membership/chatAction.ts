import { refusalOf } from '@/lib/chatSession/membership'
import { createActionError } from '@/services/actionError'
import type { ChatRefusal } from '@/lib/chatSession/membership'
import type { ActionReturn } from '@/services/actionTypes'

/** What the user is told of each reason the homeserver did not do what it was asked. */
export const refusalWording: Record<ChatRefusal, string> = {
    UNREACHABLE: 'Får ikke kontakt med chatten.',
    LIMITED: 'Chatten tar ikke imot flere slike nå. Vent litt og prøv igjen.',
    REFUSED: 'Chatten godtok det ikke.',
}

/**
 * Something asked of the homeserver from the browser, as a `Form` takes its action: what it gives
 * is the data, and why it was not done is the error.
 */
export const chatAction = <Given>(ask: () => Promise<Given>) => async (): Promise<ActionReturn<Given>> => {
    try {
        return { success: true, data: await ask() }
    } catch (error) {
        return createActionError('SERVER ERROR', refusalWording[refusalOf(error)])
    }
}
