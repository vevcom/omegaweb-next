import { Require } from '@/auth/authorizer/Require'
import { secretsMatch } from '@/lib/secretsMatch'

type Tokens = {
    /** What the request carried. */
    provided: string | null,
    /** What the homeserver signs with. Undefined when the app is told of none, and then nothing is let in. */
    expected: string | undefined,
}

export const chatAppserviceAuth = {
    receiveTransaction: Require.custom<Tokens>(
        ({ provided, expected }) => provided !== null && expected !== undefined && secretsMatch(provided, expected),
        { errorMessage: 'Bare chattens homeserver sender hit' },
    ),
} as const
