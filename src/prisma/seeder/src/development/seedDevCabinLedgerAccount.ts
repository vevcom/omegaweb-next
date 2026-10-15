import { DEV_COMMITTEE_SHORT_NAME } from './seedDevGroups'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Marks the dev committee's account (see seedDevGroups) as the one cabin bookings are paid into,
 * so bookings can be paid for in dev without first linking an account on the booking page. An
 * account that already holds the role keeps it, since it may have been chosen on the page.
 */
export const seedDevCabinLedgerAccount = defineSeedOperation(async (prisma: PrismaClient) => {
    const existing = await prisma.ledgerAccount.findUnique({ where: { special: 'CABIN' }, select: { id: true } })
    if (existing) return

    const committee = await prisma.committee.findUniqueOrThrow({
        where: { shortName: DEV_COMMITTEE_SHORT_NAME },
        select: { group: { select: { ledgerAccounts: { select: { ledgerAccountId: true }, take: 1 } } } },
    })
    const [committeeAccount] = committee.group.ledgerAccounts
    if (!committeeAccount) throw new Error(`The dev committee ${DEV_COMMITTEE_SHORT_NAME} has no ledger account.`)

    await prisma.ledgerAccount.update({
        where: { id: committeeAccount.ledgerAccountId },
        data: { special: 'CABIN' },
    })
})
