import { owIdToPnId } from './IdMapper'
import { createProgressBar } from './progressBar'
import { createCmsParagraph } from './createCmsParagraph'
import { migratedOrder } from './migratedOrder'
import manifest from './manifest'
import logger from '@/lib/logger'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { UserMigrator } from './migrateUsers'
import type { IdMapper } from './IdMapper'

const fileName = fileURLToPath(import.meta.url)
const directoryName = dirname(fileName)

/**
 * Committees that are not migrated at all, by name or short name (trimmed, any case). Neither the
 * committee nor any of its memberships, current or former, come over, and the manifest lists each
 * one skipped. Later steps that point at a skipped committee (committee-only news, a locker held by
 * it, a drain account of it) treat it as a committee without a group.
 */
const COMMITTEES_NOT_MIGRATED = ['?']

/**
 * Omegaweb-basic records every membership of Omegarevyen one order too high, so each is brought
 * one order down on the way over - before the committee's own order is read off them.
 */
const COMMITTEE_WITH_ORDERS_ONE_TOO_HIGH = 'omegarevyen'

type OwCommitteeNames = { name: string, shortname: string }

function isCommitteeNamed(committee: OwCommitteeNames, name: string): boolean {
    return [committee.name, committee.shortname].some(committeeName => committeeName.trim().toLowerCase() === name)
}

function orderShiftOf(committee: OwCommitteeNames): number {
    return isCommitteeNamed(committee, COMMITTEE_WITH_ORDERS_ONE_TOO_HIGH) ? -1 : 0
}

function isNotMigrated(committee: OwCommitteeNames): boolean {
    return COMMITTEES_NOT_MIGRATED.some(name => isCommitteeNamed(committee, name.trim().toLowerCase()))
}

async function readCommitteMarkdown(filename: string): Promise<string> {
    const filepath = join(directoryName, '..', '..', 'cms_paragraphs', 'committees', filename)
    try {
        return await readFile(filepath, 'utf-8')
    } catch {
        return ''
    }
}

async function createCommitteArticleSection(
    pnPrisma: PrismaClientPn,
    filename: string
): Promise<{ create: Prisma.ArticleSectionCreateInput } | undefined> {
    const markdown = await readCommitteMarkdown(filename)
    if (!markdown) return undefined
    const cmsParagraph = await createCmsParagraph(pnPrisma, markdown)
    return {
        create: {
            cmsParagraph: {
                connect: { id: cmsParagraph.id },
            },
        },
    }
}

/**
 * Migrates Omegaweb-basic committees into PN committees with their own group, members and
 * member history.
 * @returns an IdMapper from Omegaweb-basic committee id to the PN group id of the migrated
 * committee, so later steps can hang committee-owned data (news visibility, locker
 * reservations) off the right group.
 */
export default async function migrateCommittees(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    userMigrator: UserMigrator,
    imageIdMap: IdMapper,
): Promise<IdMapper> {
    const committees = await owPrisma.committees.findMany({
        include: {
            CommitteeMembers: true,
            CommitteeMembersHist: true,
        }
    })

    // A committee with no memberships at all has nothing to tell which order it is in, and lands in
    // the order omega is in now rather than behind it.
    const { order: currentOrder } = await pnPrisma.omegaOrder.findFirstOrThrow({
        orderBy: { order: 'desc' },
    })

    // A skipped committee still gets an entry, mapped to no group, so that looking it up later reads
    // as left out on purpose rather than as a committee that went missing.
    const committeeGroupIdMap: IdMapper = committees.filter(isNotMigrated).map(committee => {
        manifest.info(
            `Committee "${committee.name}" (${committee.shortname}) is in COMMITTEES_NOT_MIGRATED: skipped with its ` +
            `${committee.CommitteeMembers.length} current and ${committee.CommitteeMembersHist.length} former memberships.`
        )
        return { owId: committee.id, pnId: null }
    })
    const committeesToMigrate = committees.filter(committee => !isNotMigrated(committee))

    const bar = createProgressBar('Migrating committees', committeesToMigrate.length)
    await Promise.all(committeesToMigrate.map(async committee => {
        // Omegaweb-basic's inactive committees are what we now call pensioned.
        const pensioned = !committee.active
        const committeeParagraph = await createCmsParagraph(
            pnPrisma, await readCommitteMarkdown(`${committee.shortname}_p.md`)
        )
        const committeArticle = await createCommitteArticleSection(pnPrisma, `${committee.shortname}_a.md`)
        const logoImageId = owIdToPnId(imageIdMap, committee.ImageId, 'images')

        // The orders are settled before anything is written, since the committee's own order is
        // read off its memberships: a committee is in the newest order it has a membership of.
        // Omegaweb-basic did not move every committee along with omega, so a committee may well be
        // behind, and arrives behind here too - to be migrated from the admin page like any other.
        const orderShift = orderShiftOf(committee)
        const members = committee.CommitteeMembers.map(member => ({
            member,
            order: migratedOrder(member.order + orderShift, `${committee.shortname} member ${member.UserId}`),
        }))
        const formerMembers = committee.CommitteeMembersHist.map(member => ({
            member,
            order: migratedOrder(
                member.order + orderShift, `${committee.shortname} former member ${member.UserId}`
            ),
        }))
        const committeeOrder = Math.max(
            ...members.map(({ order }) => order),
            ...formerMembers.map(({ order }) => order),
        )
        const groupOrder = Number.isFinite(committeeOrder) ? committeeOrder : currentOrder

        const newCommittee = await pnPrisma.committee.create({
            data: {
                name: committee.name,
                shortName: committee.shortname,
                pensioned,
                logoImage: logoImageId ? {
                    connect: {
                        id: logoImageId
                    }
                } : undefined,
                paragraph: {
                    connect: { id: committeeParagraph.id }
                },
                committeeArticle: {
                    create: {
                        name: committee.name,
                        coverImage: {
                            create: {
                                name: `${committee.shortname}'s bilde`
                            }
                        },
                        articleSections: committeArticle
                    }
                },
                group: {
                    create: {
                        groupType: 'COMMITTEE',
                        order: groupOrder,
                    },
                }
            }
        })

        await Promise.all(members.map(async ({ member, order }) => {
            if (member.UserId === null) {
                logger.warn(`${committee.shortname} has a member that is not connected to a user!`, { committee, member })
                return
            }
            const pnUserId = await userMigrator.getPnUserId(member.UserId)
            await pnPrisma.membership.create({
                data: {
                    groupId: newCommittee.groupId,
                    userId: pnUserId,
                    // A pensioned committee holds no active memberships, whatever basic said.
                    active: !pensioned,
                    admin: member.admin,
                    order,
                    title: member.position || undefined,
                }
            })
        }))

        await Promise.all(formerMembers.map(async ({ member, order }) => {
            const pnUserId = await userMigrator.getPnUserId(member.UserId)
            await pnPrisma.membership.create({
                data: {
                    groupId: newCommittee.groupId,
                    userId: pnUserId,
                    active: false,
                    admin: member.admin,
                    order,
                    title: member.position || undefined,
                }
            })
        }))

        committeeGroupIdMap.push({ owId: committee.id, pnId: newCommittee.groupId })

        bar.increment()
    }))
    bar.stop()

    return committeeGroupIdMap
}
