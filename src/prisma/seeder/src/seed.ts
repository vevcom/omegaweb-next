import { seedDevUsers } from './development/seedDevUsers'
import { seedDevPermissions } from './development/seedDevPermissions'
import { seedDevImages } from './development/seedDevImages'
import { seedDevNews } from './development/seedDevNews'
import { seedDevLockers } from './development/seedDevLockers'
import { seedDevOmegaquotes } from './development/seedDevOmegaquotes'
import { seedOrders } from './standardContent/seedOrders'
import dobbelOmega from './dobbelOmega/dobbelOmega'
import { seedNotificationChannels } from './standardContent/seedNotificationChannels'
import { seedDevGroups } from './development/seedDevGroups'
import { seedClasses } from './standardContent/seedClasses'
import { seedMail } from './standardContent/seedMail'
import { seedStudyProgrammes } from './standardContent/seedStudyProgrammes'
import { seedOmegaMembershipGroups } from './standardContent/seedOmegaMembershipGroups'
import { seedDevSchools } from './development/seedDevSchools'
import { seedDevCompanies } from './development/seedDevCompanies'
import { seedShop } from './standardContent/seedShop'
import { seedDevShop } from './development/seedDevShop'
import { seedDevJobAds } from './development/seedDevJobAds'
import { seedDevEvents } from './development/seedDevEvents'
import { seedEventTags } from './standardContent/seedEventTags'
import { seedCabin } from './standardContent/seedCabin'
import { seedAdmin } from './standardContent/seedAdmin'
import { seedDevApplicationsAndPeriods } from './development/seedDevApplicationsAndPeriods'
import { seedArticleCategories } from './standardContent/seedArticleCategories'
import { seedImages } from './standardContent/seedImages'
import { seedSpecialCms } from './standardContent/seedSpecialCms'
import { seedFlairs } from './standardContent/seedFlairs'
import { seedNews } from './standardContent/seedNews'
import { seedCompanies } from './standardContent/seedCompanies'
import { seedInterestGroups } from './standardContent/seedInterestGroups'
import { seedDevBullshit } from './development/seedDevBullshit'
import { createTimedStep } from './timedStep'
import { withServiceContext } from '@/services/serviceOperation'
import { Session } from '@/auth/session/Session'

export default async function seed(
    shouldMigrate: boolean,
    seedDevData: boolean,
    logging?: boolean,
) {
    const { step, finish } = createTimedStep(logging ?? true)

    await step('Upserting standard data', async () => {
        await step('Upserting standard orders', () => seedOrders())
        await step('Upserting standard images', () => seedImages())
        await step('Upserting standard special CMS', () => seedSpecialCms())
        await step('Upserting standard article categories', () => seedArticleCategories())
        await step('Upserting standard news', () => seedNews())
        await step('Upserting standard companies', () => seedCompanies())
        await step('Upserting standard mail', () => seedMail())
        await step('Upserting standard notification channels', () => seedNotificationChannels())
        await step('Upserting standard study programmes', () => seedStudyProgrammes())
        await step('Upserting standard omega membership groups', () => seedOmegaMembershipGroups())
        await step('Upserting standard classes', () => seedClasses())
        await step('Upserting standard cabins', () => seedCabin())
        await step('Upserting standard shops', () => seedShop())
        await step('Upserting standard event tags', () => seedEventTags())
        await step('Upserting admin user', () => seedAdmin())
        await step('Upserting standard flairs', () => seedFlairs())
        await step('Upserting standard interest groups', () => seedInterestGroups())
    })

    if (shouldMigrate) {
        await step('Migrating from Veven', () => withServiceContext({
            bypassAuth: true,
            session: Session.empty(),
        }, true, async ({ prisma }) => dobbelOmega(prisma)))
    }

    if (!seedDevData || shouldMigrate) {
        finish()
        return
    }

    await step('Seeding development data', async () => {
        await step('Seeding development images', () => seedDevImages())
        await step('Seeding development groups', () => seedDevGroups())
        await step('Seeding development users', () => seedDevUsers())
        await step('Seeding development permissions', () => seedDevPermissions())
        await step('Seeding development omega quotes', () => seedDevOmegaquotes())
        await step('Seeding development news', () => seedDevNews())
        await step('Seeding development lockers', () => seedDevLockers())
        await step('Seeding development schools', () => seedDevSchools())
        await step('Seeding development companies', () => seedDevCompanies())
        await step('Seeding development job ads', () => seedDevJobAds())
        await step('Seeding development shops', () => seedDevShop())
        await step('Seeding development events', () => seedDevEvents())
        await step('Seeding development applications and periods', () => seedDevApplicationsAndPeriods())
        await step('Seeding development bullshit', () => seedDevBullshit())
    })

    finish()
}
