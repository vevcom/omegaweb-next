import { owIdToPnId, type IdMapper, type MappedResource } from './IdMapper'
import manifest from './manifest'
import type { Prisma, PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Limits } from './migrationLimits'

type MoneyMigrationContext = {
    pnPrisma: PrismaClientPn
    owPrisma: PrismaClientOw
    userAccountIdMap: IdMapper
    drainAccountIdMap: IdMapper
    eventRegistrationIdMap: IdMapper
    legacySuspenseAccountId: number
    limits: Limits
}

/**
 * OW rows contain Date objects, which aren't valid Prisma Json input as-is.
 * Round-tripping through JSON turns them into ISO strings, matching what a real
 * rebuild would need to parse anyway.
 */
function toLegacyJson(row: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue
}

/**
 * Resolves an OW account id to its migrated LedgerAccount id, falling back to the shared
 * legacy suspense account (and logging it) whenever the real counterpart can't be resolved -
 * e.g. the OW row was deleted/orphaned, or its owning committee/user wasn't migrated.
 */
function resolveOrSuspend(
    mapper: IdMapper,
    owId: number | null,
    resource: MappedResource,
    legacySuspenseAccountId: number,
    context: string,
): number {
    const resolved = owIdToPnId(mapper, owId, resource)
    if (resolved) return resolved
    manifest.info(`${context}: could not resolve OW account id ${owId ?? 'null'} - routing to the legacy suspense account.`)
    return legacySuspenseAccountId
}

async function migrateManualDeposits(
    { pnPrisma, owPrisma, userAccountIdMap, legacySuspenseAccountId, limits }: MoneyMigrationContext
) {
    const deposits = await owPrisma.moneyManualDeposits.findMany({
        take: limits.moneyDeposits ? limits.moneyDeposits : undefined,
    })

    await Promise.all(deposits.map(async deposit => {
        const ledgerAccountId = resolveOrSuspend(
            userAccountIdMap, deposit.MoneySourceAccountId, 'user accounts', legacySuspenseAccountId,
            `MoneyManualDeposits ${deposit.id}`
        )

        await pnPrisma.ledgerTransaction.create({
            data: {
                purpose: 'DEPOSIT',
                state: 'SUCCEEDED',
                description: 'Migrert innskudd (OmegaWeb Basic)',
                createdAt: deposit.createdAt,
                updatedAt: deposit.updatedAt,
                ledgerEntries: {
                    create: [{
                        funds: deposit.amount,
                        fees: deposit.fees ?? 0,
                        ledgerAccountId,
                    }],
                },
                payment: {
                    create: {
                        funds: deposit.amount,
                        fees: deposit.fees ?? 0,
                        provider: 'MANUAL',
                        state: 'SUCCEEDED',
                        descriptionLong: 'Migrert innskudd (OmegaWeb Basic)',
                        createdAt: deposit.createdAt,
                        updatedAt: deposit.updatedAt,
                        manualPayment: {
                            create: {
                                createdAt: deposit.createdAt,
                                updatedAt: deposit.updatedAt,
                            },
                        },
                    },
                },
                legacy: {
                    create: {
                        source: 'MONEY_MANUAL_DEPOSIT',
                        originalId: deposit.id,
                        data: toLegacyJson(deposit),
                    },
                },
            },
        })
    }))
}

// OW's `authorizing` status has no direct PaymentState equivalent - treated as still processing.
// TODO: revisit if a real 'authorizing' payment shows up; currently unseen in migrated data.
const stripeStateMap = {
    processing: { payment: 'PROCESSING', transaction: 'PENDING' },
    authorizing: { payment: 'PROCESSING', transaction: 'PENDING' },
    successful: { payment: 'SUCCEEDED', transaction: 'SUCCEEDED' },
    failed: { payment: 'FAILED', transaction: 'FAILED' },
} as const

async function migrateStripeDeposits(
    { pnPrisma, owPrisma, userAccountIdMap, legacySuspenseAccountId, limits }: MoneyMigrationContext
) {
    const deposits = await owPrisma.moneyStripeDeposits.findMany({
        take: limits.moneyDeposits ? limits.moneyDeposits : undefined,
    })

    await Promise.all(deposits.map(async deposit => {
        const ledgerAccountId = resolveOrSuspend(
            userAccountIdMap, deposit.MoneySourceAccountId, 'user accounts', legacySuspenseAccountId,
            `MoneyStripeDeposits ${deposit.id}`
        )
        const states = stripeStateMap[deposit.status]

        await pnPrisma.ledgerTransaction.create({
            data: {
                purpose: 'DEPOSIT',
                state: states.transaction,
                reason: states.transaction === 'FAILED' ? (deposit.err ?? undefined) : undefined,
                description: 'Migrert Stripe-innskudd (OmegaWeb Basic)',
                createdAt: deposit.createdAt,
                updatedAt: deposit.updatedAt,
                ledgerEntries: {
                    create: [{
                        funds: deposit.amount,
                        fees: deposit.fees ?? 0,
                        ledgerAccountId,
                    }],
                },
                payment: {
                    create: {
                        funds: deposit.amount,
                        fees: deposit.fees ?? undefined,
                        provider: 'STRIPE',
                        state: states.payment,
                        createdAt: deposit.createdAt,
                        updatedAt: deposit.updatedAt,
                        stripePayment: {
                            create: {
                                // stripeChargeId has no native field on StripePayment - kept in legacy.data only.
                                paymentIntentId: deposit.stripeIntentId,
                                createdAt: deposit.createdAt,
                                updatedAt: deposit.updatedAt,
                            },
                        },
                    },
                },
                legacy: {
                    create: {
                        source: 'MONEY_STRIPE_DEPOSIT',
                        originalId: deposit.id,
                        data: toLegacyJson(deposit),
                    },
                },
            },
        })
    }))
}

async function migrateTransfers(
    { pnPrisma, owPrisma, drainAccountIdMap, legacySuspenseAccountId, limits }: MoneyMigrationContext
) {
    const transfers = await owPrisma.moneyTransfers.findMany({
        take: limits.moneyTransfers ? limits.moneyTransfers : undefined,
    })

    await Promise.all(transfers.map(async transfer => {
        const ledgerAccountId = resolveOrSuspend(
            drainAccountIdMap, transfer.MoneyDrainAccountId, 'drain accounts', legacySuspenseAccountId,
            `MoneyTransfers ${transfer.id}`
        )

        await pnPrisma.ledgerTransaction.create({
            data: {
                purpose: 'PAYOUT',
                state: 'SUCCEEDED',
                description: 'Migrert utbetaling (OmegaWeb Basic)',
                createdAt: transfer.createdAt,
                updatedAt: transfer.updatedAt,
                ledgerEntries: {
                    create: [{
                        funds: -transfer.amount,
                        fees: 0,
                        ledgerAccountId,
                    }],
                },
                payment: {
                    create: {
                        funds: -transfer.amount,
                        fees: 0,
                        provider: 'MANUAL',
                        state: 'SUCCEEDED',
                        descriptionLong: 'Migrert utbetaling (OmegaWeb Basic)',
                        createdAt: transfer.createdAt,
                        updatedAt: transfer.updatedAt,
                        manualPayment: {
                            create: {
                                createdAt: transfer.createdAt,
                                updatedAt: transfer.updatedAt,
                            },
                        },
                    },
                },
                legacy: {
                    create: {
                        source: 'MONEY_TRANSFER',
                        originalId: transfer.id,
                        data: toLegacyJson(transfer),
                    },
                },
            },
        })
    }))
}

async function migratePayments({
    pnPrisma, owPrisma, userAccountIdMap, drainAccountIdMap, eventRegistrationIdMap, legacySuspenseAccountId, limits
}: MoneyMigrationContext) {
    const payments = await owPrisma.moneyPayments.findMany({
        take: limits.moneyPayments ? limits.moneyPayments : undefined,
        include: {
            MoneyCommodities: true,
            EventRegistrations_EventRegistrations_MainPaymentIdToMoneyPayments: true,
            EventRegistrations_EventRegistrations_CompanyPaymentIdToMoneyPayments: true,
        },
    })

    await Promise.all(payments.map(async payment => {
        // MoneyPayments has no amount field of its own - the paid amount only exists as
        // MoneyCommodities.price (an approximation, since price could have changed since the
        // purchase). Without a commodity there is no funds figure to build a ledger entry from.
        const commodity = payment.MoneyCommodities
        if (!commodity) {
            manifest.error(`MoneyPayments ${payment.id} has no linked commodity - no amount could be derived, skipping.`)
            return
        }

        const registrationLinks = [
            ...payment.EventRegistrations_EventRegistrations_MainPaymentIdToMoneyPayments.map(
                registration => ({ registration, role: 'Hovedbetaling' })
            ),
            ...payment.EventRegistrations_EventRegistrations_CompanyPaymentIdToMoneyPayments.map(
                registration => ({ registration, role: 'Bedriftsbetaling' })
            ),
        ]
        if (registrationLinks.length > 1) {
            manifest.error(
                `MoneyPayments ${payment.id} is referenced by more than one event registration - only linking the first.`
            )
        }
        const link = registrationLinks[0] as typeof registrationLinks[number] | undefined

        const purpose = link || commodity.type === 'event' ? 'EVENT_PAYMENT' : 'SHOP_PURCHASE'
        let eventRegistrationId: number | undefined
        if (link) {
            const resolved = owIdToPnId(eventRegistrationIdMap, link.registration.id, 'event registrations')
            if (!resolved) {
                manifest.info(
                    `MoneyPayments ${payment.id}: could not resolve migrated event registration ` +
                    `for OW registration ${link.registration.id}.`
                )
            }
            eventRegistrationId = resolved ?? undefined
        }

        const debitAccountId = resolveOrSuspend(
            userAccountIdMap, payment.MoneySourceAccountId, 'user accounts', legacySuspenseAccountId,
            `MoneyPayments ${payment.id}`
        )
        const creditAccountId = resolveOrSuspend(
            drainAccountIdMap, commodity.MoneyDrainAccountId, 'drain accounts', legacySuspenseAccountId,
            `MoneyPayments ${payment.id} (commodity ${commodity.id})`
        )

        // Ledger entries are unique per (transaction, account): if both sides fell back to the
        // same suspense account, don't create entries at all - we genuinely don't know where the
        // money moved, and the legacy record below is still preserved for manual reconciliation.
        const canCreateEntries = debitAccountId !== creditAccountId
        if (!canCreateEntries) {
            manifest.error(
                `MoneyPayments ${payment.id}: neither the paying user's account nor the receiving group's ` +
                'account could be resolved - migrated without ledger entries, see legacy data.'
            )
        }

        const description = link
            ? `Migrert: ${commodity.description} (${link.role})`
            : `Migrert: ${commodity.description}`

        await pnPrisma.ledgerTransaction.create({
            data: {
                purpose,
                state: 'SUCCEEDED',
                description,
                eventRegistrationId,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                ledgerEntries: canCreateEntries ? {
                    create: [
                        {
                            funds: -commodity.price,
                            fees: 0,
                            ledgerAccountId: debitAccountId,
                        },
                        {
                            funds: commodity.price,
                            fees: payment.repaidFees ?? 0,
                            ledgerAccountId: creditAccountId,
                        },
                    ],
                } : undefined,
                legacy: {
                    create: {
                        source: 'MONEY_PAYMENT',
                        originalId: payment.id,
                        // MoneyPaymentConfirmations (a confirm-by-UUID flow) has no native equivalent
                        // yet; kept here only for audit/rebuild purposes.
                        // TODO: revisit if the confirmation flow gets a native equivalent.
                        data: toLegacyJson(payment),
                    },
                },
            },
        })
    }))
}

/**
 * Migrates OW money movements (deposits, payouts, commodity/event payments) into native
 * LedgerTransaction/LedgerEntry/Payment rows, plus a LegacyLedgerTransaction audit record per
 * transaction. Must run after migrateLedgerAccounts (account id maps) and migrateEvents
 * (event registration id map).
 */
export default async function migrateLedgerTransactions(context: MoneyMigrationContext) {
    await migrateManualDeposits(context)
    await migrateStripeDeposits(context)
    await migrateTransfers(context)
    await migratePayments(context)
}
