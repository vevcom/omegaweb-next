import logger from '@/lib/logger'

/**
 * @returns Limits for the migration process to test without going crazy
 * null means no limit and happens if the env variable MIGRATION_WITH_LIMITS is set to "false"
 */
export function getLimits() {
    const limits = {
        ombul: 5,
        numberOffFullImageCollections: 0,
        omegaquotes: 10,
        articles: 10,
        mailaliases: 0,
        events: 10,
        users: 100,
        images: 10,
        prikks: 50,
        lockers: 20,
        moneyPayments: 100,
        moneyDeposits: 100,
        moneyTransfers: 100,
    }
    const nullObj: { [key in keyof typeof limits]: null } = {
        ombul: null,
        numberOffFullImageCollections: null,
        omegaquotes: null,
        articles: null,
        mailaliases: null,
        events: null,
        users: null,
        images: null,
        prikks: null,
        lockers: null,
        moneyPayments: null,
        moneyDeposits: null,
        moneyTransfers: null,
    }

    const limitsOn = process.env.MIGRATION_WITH_LIMITS !== 'false'
    // JSON, not interpolation: a template literal renders the object as [object Object],
    // which is exactly the line an operator reads to check what a production import is
    // about to skip.
    logger.info(limitsOn ? `Limits on. Set to: ${JSON.stringify(limits)}` : 'Limits off!!!')

    return limitsOn ? limits : nullObj
}

export type Limits = ReturnType<typeof getLimits>
