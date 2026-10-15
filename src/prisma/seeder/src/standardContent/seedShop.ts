import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

export const FRIDGE_NAME = 'Koigeskabet'

/**
 * Upserts the fridge shop, keyed on the unique shop name. An existing shop is left untouched -
 * its description, visibility and ledger account are edited through the admin pages.
 *
 * Everyone may buy from the fridge: its regular level has no requirements. It is administered
 * through SHOP_ADMIN rather than by any group until it is handed to one: a requirement with no
 * conditions can never be satisfied, so the admin level admits only those who bypass it.
 */
export const seedShop = defineSeedOperation(async (prisma: PrismaClient) => {
    await prisma.shop.upsert({
        where: { name: FRIDGE_NAME },
        update: {},
        create: {
            name: FRIDGE_NAME,
            description: 'Her kan du kjøpe snack og drikke fra kjøleskapet på Lophtet.',
            visibilityRegular: { create: {} },
            visibilityAdmin: { create: { requirements: { create: {} } } },
        }
    })
})
