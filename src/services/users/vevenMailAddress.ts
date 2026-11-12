import '@pn-server-only'
import { userAuth } from './auth'
import { userSchemas } from './schemas'
import { userPartitions } from './constants'
import { implementMailAddressOperations } from '@/services/mail/address/implement'
import { MAIL_ADDRESS_LOCAL_PART, MAIL_ADDRESS_LOCAL_PART_MAX_LENGTH } from '@/services/mail/address/schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { DomainContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { Site } from '@/lib/sites/site'

/**
 * The veven mail address of a user: the address they have on our mail domains, see
 * services/mail/address, where the mail in their own mailbox on the mail server arrives. It is
 * not `User.email`, their private email, which is where they are reached and where the mail to
 * their veven address is sent on to.
 */

/** The letters outside a to z that usernames here most often hold, as an address spells them. */
const SPELLINGS: [letter: RegExp, spelling: string][] = [[/æ/g, 'ae'], [/ø/g, 'oe'], [/å/g, 'aa']]

/** Room for the number that tells an address from one that is taken. */
const NUMBER_LENGTH = 4

/**
 * What stands before the @ of the address a user is given: their username, as far as an address
 * takes it. Letters with marks lose them, what an address does not take is left out, and a user
 * whose username leaves nothing is named by their id.
 */
export function defaultVevenMailAddressLocalPart(user: { id: number, username: string }): string {
    const spelled = SPELLINGS
        .reduce((name, [letter, spelling]) => name.replace(letter, spelling), user.username.toLowerCase())
        .normalize('NFKD')
        .replace(/[^a-z0-9._+-]/g, '')
        // An address takes one of . _ + - at a time, and none first or last.
        .replace(/[._+-]{2,}/g, separators => separators[0])
        .slice(0, MAIL_ADDRESS_LOCAL_PART_MAX_LENGTH - NUMBER_LENGTH)
        .replace(/^[._+-]|[._+-]$/g, '')
    return MAIL_ADDRESS_LOCAL_PART.test(spelled) ? spelled : `bruker${user.id}`
}

/** How many addresses are tried for a user before giving up. */
export const DEFAULT_VEVEN_MAIL_ADDRESS_ATTEMPTS = 10 ** NUMBER_LENGTH - 1

/**
 * The addresses a user may be given by default, in the order they are tried: their username, and
 * then with a number after it, from 2, for a user whose username is another's address or an
 * alias's.
 */
export function defaultVevenMailAddressLocalPartAt(user: { id: number, username: string }, attempt: number): string {
    const localPart = defaultVevenMailAddressLocalPart(user)
    return attempt === 0 ? localPart : `${localPart}${attempt + 1}`
}

const implemented = implementMailAddressOperations({
    implementationParamsSchema: userSchemas.params.vevenMailAddress,
    authorizers: {
        read: ({ implementationParams }) => userAuth.readVevenMailAddress.data({ userId: implementationParams.userId }),
        update: () => userAuth.updateVevenMailAddress,
        updateForwarding: ({ implementationParams }) =>
            userAuth.updateVevenMailAddressForwarding.data({ userId: implementationParams.userId }),
    },
    readMailAddress: async ({ prisma, implementationParams }) => (await prisma.user.findUniqueOrThrow({
        where: { id: implementationParams.userId, ...userPartitions.unarchived },
        select: { mailAddress: true },
    })).mailAddress,
})

/**
 * Gives a user the address they have by default: their username on the main domain of Omega's
 * site, with a number after it when that is another user's or an alias's. A user who has an
 * address keeps it. Nobody asks for it: a user is given theirs when they are created, and the
 * mail worker gives it to those without one.
 *
 * @returns the user's address.
 */
const createDefault = defineSubOperation({
    paramsSchema: () => userSchemas.params.createDefaultVevenMailAddress,
    transaction: 'RUNS_IN',
    operation: () => async ({ prisma, params }): Promise<string> => {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: params.id },
            select: { id: true, username: true, vevenMailAddress: true },
        })
        if (user.vevenMailAddress !== null) return user.vevenMailAddress

        loadDomainConfig()
        const domain = DomainContext.mailDomainOf(Site.root)
        for (let attempt = 0; attempt < DEFAULT_VEVEN_MAIL_ADDRESS_ATTEMPTS; attempt++) {
            const localPart = defaultVevenMailAddressLocalPartAt(user, attempt)
            const taken = await prisma.mailAddress.findUnique({
                where: { address: `${localPart}@${domain}` },
                select: { id: true },
            })
            if (taken) continue
            const { address } = await implemented.internal.create.internalCall({ prisma, data: { localPart, domain } })
            await prisma.user.update({ where: { id: user.id }, data: { vevenMailAddress: address } })
            return address
        }
        throw new ServiceError('SERVER ERROR', `Fant ingen ledig e-postadresse til ${user.username}`)
    },
})

export const vevenMailAddressOperations = {
    ...implemented,
    internal: {
        ...implemented.internal,
        createDefault,
    },
} as const
