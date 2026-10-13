import { owIdToPnId, type IdMapper } from './IdMapper'
import { createProgressBar } from './progressBar'
import { resyncIdSequence } from './resyncIdSequence'
import { ombulStore } from '@/services/ombul/operations'
import logger from '@/lib/logger'
import { File } from 'node:buffer'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { Limits } from './migrationLimits'

/**
 * Ombul is the only thing DobbelOmega migrates that nothing else ever creates, so the
 * Omegaweb-basic id carries straight over as the PN id. That is what makes the step
 * re-runnable: a second run recognises what it already imported instead of downloading
 * every pdf again and creating a duplicate set of ombuls.
 */
async function alreadyMigrated(pnPrisma: PrismaClientPn, owOmbulId: number): Promise<boolean> {
    const existing = await pnPrisma.ombul.findUnique({
        where: { id: owOmbulId },
        select: { id: true },
    })
    return Boolean(existing)
}

/**
 * PN constrains ombul by both (year, name) and (year, issueNumber), neither of which
 * Omegaweb-basic enforced - the same title can appear twice in a year, and so can the
 * same issue number. Rather than let the import die on a unique violation halfway
 * through, a clashing ombul is nudged onto the next free value: the name picks up a
 * "(2)" suffix, the issue number counts up. The alternative - dropping the duplicate -
 * loses an actual ombul, which is worse than an imperfect issue number.
 */
async function findFreeYearName(pnPrisma: PrismaClientPn, year: number, title: string): Promise<string> {
    let name = title
    let attempt = 1
    while (await pnPrisma.ombul.findUnique({ where: { year_name: { year, name } }, select: { id: true } })) {
        attempt++
        name = `${title} (${attempt})`
    }
    return name
}

async function findFreeIssueNumber(pnPrisma: PrismaClientPn, year: number, number: number): Promise<number> {
    let issueNumber = number
    while (await pnPrisma.ombul.findUnique({
        where: { year_issueNumber: { year, issueNumber } },
        select: { id: true },
    })) {
        issueNumber++
    }
    return issueNumber
}

/**
 * This function migrates ombul from OW to PN, by creating a new ombul in PN for
 * each ombul in OW, connecting it to its cover image (already migrated by migrateImages,
 * which places any OW image with an Ombul relation into the OMBULCOVERS collection), and
 * fetching the pdf from the old location and storing it via the ombul store.
 *
 * An ombul whose cover image did not come across is skipped: PN requires a cover and
 * holds it through a unique relation, so there is no shared placeholder to fall back on.
 * With image limits on that is most of them, which is expected rather than a failure.
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param imageIdMap - IdMapper - A map of the old and new id's of the images to
 * be used to create correct relations
 */
export default async function migrateOmbul(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    imageIdMap: IdMapper,
    limits: Limits,
) {
    const allOmbuls = await owPrisma.ombul.findMany({
        take: limits.ombul ? limits.ombul : undefined,
    })

    const ombuls = (await Promise.all(allOmbuls.map(async ombul => {
        if (await alreadyMigrated(pnPrisma, ombul.id)) return []

        const coverImageId = owIdToPnId(imageIdMap, ombul.ImageId, 'images')
        if (!coverImageId) {
            logger.warn(`Ombul "${ombul.title}" (${ombul.year}) has no resolvable cover image, skipping.`)
            return []
        }
        return [{ ...ombul, coverImageId }]
    }))).flat()

    //First fetch pdfs and write them to the store concurrently for speed
    const fetchBar = createProgressBar('Fetching ombul pdfs', ombuls.length)
    const fsLocations = await Promise.all(ombuls.map(async (ombul): Promise<string | null> => {
        const fsLocationOldVev = `${process.env.OW_STORE_URL}/ombul/${ombul.fileName}.pdf/${ombul.originalName}`

        // Get pdf served at old location
        const res = await fetch(fsLocationOldVev, {
            method: 'GET',
        }).catch(() => null)
        if (!res || !res.ok) {
            logger.error(`Failed to fetch ombul pdf from ${fsLocationOldVev}`)
            fetchBar.increment()
            return null
        }

        const pdfBuffer = Buffer.from(await res.arrayBuffer())
        const pdfFile = new File([new Uint8Array(pdfBuffer)], ombul.originalName, { type: 'application/pdf' })

        const { fsLocation } = await ombulStore.createFile(pdfFile)
        fetchBar.increment()
        return fsLocation
    }))
    fetchBar.stop()

    const createBar = createProgressBar('Creating ombuls', ombuls.length)
    for (let ombulIdx = 0; ombulIdx < ombuls.length; ombulIdx++) {
        const ombul = ombuls[ombulIdx]
        const fsLocation = fsLocations[ombulIdx]
        if (!fsLocation) {
            createBar.increment()
            continue
        }

        const year = ombul.year || 1919
        const name = await findFreeYearName(pnPrisma, year, ombul.title)
        const issueNumber = await findFreeIssueNumber(pnPrisma, year, ombul.number)

        if (name !== ombul.title || issueNumber !== ombul.number) {
            logger.warn(
                `Ombul "${ombul.title}" (${year}, nr. ${ombul.number}) collided with an already `
                + `migrated ombul and was stored as "${name}" (nr. ${issueNumber}).`
            )
        }

        // Writing the id explicitly puts prisma on its unchecked create input, where
        // relations are plain foreign keys rather than nested writes - so the ombul's
        // (empty) paragraph has to exist before the ombul itself does. Both go in one
        // transaction: the ombul insert can still fail on its side (Ombul.coverImageId is
        // unique while the old relation was not, so two ombuls sharing a cover collide),
        // and a committed paragraph with no ombul pointing at it is an orphan no later run
        // ever finds - alreadyMigrated keys off the ombul, so a retry just makes another.
        await pnPrisma.$transaction(async tx => {
            const paragraph = await tx.cmsParagraph.create({ data: {} })

            await tx.ombul.create({
                data: {
                    id: ombul.id,
                    coverImageId: ombul.coverImageId,
                    paragraphId: paragraph.id,
                    name,
                    description: ombul.lead,
                    createdAt: ombul.createdAt,
                    updatedAt: ombul.updatedAt,
                    year,
                    issueNumber,
                    fsLocation,
                }
            })
        })
        createBar.increment()
    }
    createBar.stop()

    await resyncIdSequence(pnPrisma, 'Ombul')
}
