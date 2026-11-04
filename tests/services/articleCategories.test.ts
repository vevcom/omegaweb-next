import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { articleCategoryOperations } from '@/services/articleCategories/operations'
import { seedDevArticleCategories } from '@/prisma/seeder/src/development/seedDevArticleCategories'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { MembershipFiltered } from '@/services/groups/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

/**
 * Every operation on an article category is gated on the category's own double level visibility
 * (regular to see the category and read its articles, admin to change them), with
 * ARTICLE_CATEGORY_ADMIN as a global bypass and the only way to create a category.
 */

let currentOrder: number
let groupOne: number
let groupTwo: number
let categoryCounter = 0

/** A session that is an active member of the given groups, holding no permissions at all. */
function sessionInGroups(...groupIds: number[]) {
    const memberships: MembershipFiltered[] = groupIds.map(groupId => ({
        groupId,
        order: currentOrder,
        active: true,
        admin: false,
    }))
    return Session.fromJsObject({ user: null, permissions: [], memberships })
}

function sessionWithPermissions(...permissions: Parameters<typeof Session.fromDefaultPermissions>[0]) {
    return Session.fromJsObject({ user: null, permissions, memberships: [] })
}

function activeIn(groupId: number): VisibilityMatrix {
    return { requirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }] }
}

/** One requirement satisfied by being active in any one of the given groups. */
function activeInAnyOf(...groupIds: number[]): VisibilityMatrix {
    return { requirements: [{ conditions: groupIds.map(groupId => ({ type: 'ACTIVE', groupId })) }] }
}

async function createManualGroup(shortName: string) {
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: shortName, shortName } },
        },
    })
    return group.id
}

/**
 * Creates a category through the service. Unless a test asks otherwise, it is administrated by
 * groupOne and readable by anyone.
 */
async function createCategory({
    regularLevel = { requirements: [] },
    adminLevel = activeIn(groupOne),
}: {
    regularLevel?: VisibilityMatrix,
    adminLevel?: VisibilityMatrix,
} = {}) {
    categoryCounter++
    return articleCategoryOperations.create({
        data: {
            name: `Testkategori ${categoryCounter}`,
            description: 'Laget av testene',
            visibilityRegularRequirements: regularLevel.requirements,
            visibilityAdminRequirements: adminLevel.requirements,
        },
        session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
    })
}

async function addArticle(categoryId: number) {
    return articleCategoryOperations.addArticleToCategory({
        params: { id: categoryId },
        session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
    })
}

beforeAll(async () => {
    const order = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
    currentOrder = order.order

    groupOne = await createManualGroup('article-category-test-group-one')
    groupTwo = await createManualGroup('article-category-test-group-two')
})

describe('creating a category', () => {
    test('requires the ARTICLE_CATEGORY_ADMIN permission', async () => {
        await expect(articleCategoryOperations.create({
            data: {
                name: 'Ulovlig',
                description: 'Skal ikke lages',
                visibilityAdminRequirements: activeIn(groupOne).requirements,
            },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.create({
            data: {
                name: 'Ulovlig',
                description: 'Skal ikke lages',
                visibilityAdminRequirements: activeIn(groupOne).requirements,
            },
            session: sessionWithPermissions('NEWS_ADMIN'),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await prisma.articleCategory.count({ where: { name: 'Ulovlig' } })).toBe(0)
    })

    test('refuses an empty admin level, which would authorize everyone', async () => {
        await expect(articleCategoryOperations.create({
            data: {
                name: 'Åpen',
                description: 'Skal ikke lages',
                visibilityAdminRequirements: [],
            },
            session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
        })).rejects.toThrow(Smorekopp)

        expect(await prisma.articleCategory.count({ where: { name: 'Åpen' } })).toBe(0)
    })

    test('an admin level outside the regular level is allowed, and its administrators read the category', async () => {
        const category = await createCategory({
            regularLevel: activeIn(groupOne),
            adminLevel: activeIn(groupTwo),
        })

        await expect(articleCategoryOperations.read({
            params: { name: category.name },
            session: sessionInGroups(groupTwo),
        })).resolves.toMatchObject({ id: category.id })
    })

    test('starts out with the given levels', async () => {
        const category = await createCategory({
            regularLevel: activeInAnyOf(groupOne, groupTwo),
            adminLevel: activeIn(groupOne),
        })

        const matrix = await articleCategoryOperations.visibility.readDoubleLevelMatrix({
            params: { id: category.id },
            session: sessionInGroups(groupTwo),
        })

        expect(matrix.regularLevel).toEqual(activeInAnyOf(groupOne, groupTwo))
        expect(matrix.adminLevel).toEqual(activeIn(groupOne))
    })
})

describe('reading', () => {
    test('a category with an empty regular level, and its articles, are readable by anyone', async () => {
        const category = await createCategory()
        const article = await addArticle(category.id)

        await expect(articleCategoryOperations.read({
            params: { name: category.name },
            session: Session.empty(),
        })).resolves.toMatchObject({ id: category.id })

        await expect(articleCategoryOperations.readArticleInCategory({
            implementationParams: { articleCategoryName: category.name },
            params: { articleId: article.id },
            session: Session.empty(),
        })).resolves.toMatchObject({ id: article.id })
    })

    test('the regular level gates the category and its articles', async () => {
        const category = await createCategory({ regularLevel: activeIn(groupOne) })
        const article = await addArticle(category.id)

        await expect(articleCategoryOperations.read({
            params: { name: category.name },
            session: sessionInGroups(groupOne),
        })).resolves.toMatchObject({ id: category.id })

        await expect(articleCategoryOperations.read({
            params: { name: category.name },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.readArticleInCategory({
            implementationParams: { articleCategoryName: category.name },
            params: { articleId: article.id },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.readArticleInCategory({
            implementationParams: { articleCategoryName: category.name },
            params: { articleId: article.id },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('read returns both levels, for the pages to authorize their editing controls with', async () => {
        const category = await createCategory()

        const read = await articleCategoryOperations.read({
            params: { name: category.name },
            session: Session.empty(),
        })

        expect(read.visibility).toEqual({
            regularLevel: { requirements: [] },
            adminLevel: activeIn(groupOne),
        })
    })

    test('a category is read with the cover image of its newest article', async () => {
        const category = await createCategory()
        await addArticle(category.id)

        const read = await articleCategoryOperations.read({
            params: { name: category.name },
            session: Session.empty(),
        })
        expect(read.articles).toHaveLength(1)
        expect(read.coverImage).toBeNull()

        const all = await articleCategoryOperations.readAll({ session: Session.empty() })
        expect(all.find(candidate => candidate.id === category.id)?.coverImage).toBeNull()
    })

    test('ARTICLE_CATEGORY_ADMIN bypasses the regular level', async () => {
        const category = await createCategory({ regularLevel: activeIn(groupOne) })

        await expect(articleCategoryOperations.read({
            params: { name: category.name },
            session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
        })).resolves.toMatchObject({ id: category.id })
    })

    test('listing leaves out the categories the session may not see', async () => {
        const open = await createCategory()
        const restricted = await createCategory({ regularLevel: activeIn(groupOne) })

        const namesFor = async (session: SessionMaybeUser) => (
            await articleCategoryOperations.readAll({ session })
        ).map(category => category.name)

        const loggedOut = await namesFor(Session.empty())
        expect(loggedOut).toContain(open.name)
        expect(loggedOut).not.toContain(restricted.name)

        expect(await namesFor(sessionInGroups(groupOne))).toEqual(
            expect.arrayContaining([open.name, restricted.name])
        )
        expect(await namesFor(sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'))).toEqual(
            expect.arrayContaining([open.name, restricted.name])
        )
    })
})

describe('changing a category and its articles', () => {
    test('a logged out session can change nothing', async () => {
        const category = await createCategory()
        const article = await addArticle(category.id)
        const session = Session.empty()

        await expect(articleCategoryOperations.update({
            params: { id: category.id },
            data: { name: 'Kapret' },
            session,
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.addArticleToCategory({
            params: { id: category.id },
            session,
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.updateArticle.update({
            implementationParams: { articleCategoryId: category.id },
            params: { articleId: article.id },
            data: { name: 'Kapret' },
            session,
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.removeArticleFromCategory({
            implementationParams: { articleCategoryId: category.id },
            params: { articleId: article.id },
            session,
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.destroy({
            params: { id: category.id },
            session,
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        expect(await prisma.articleCategory.findUniqueOrThrow({
            where: { id: category.id },
            include: { articles: true },
        })).toMatchObject({ name: category.name, articles: [{ id: article.id, name: article.name }] })
    })

    test('editing articles requires the admin level, not the regular level', async () => {
        const category = await createCategory({
            regularLevel: activeInAnyOf(groupOne, groupTwo),
            adminLevel: activeIn(groupOne),
        })
        const article = await addArticle(category.id)

        // groupTwo may read the articles, but may not change them.
        await expect(articleCategoryOperations.updateArticle.update({
            implementationParams: { articleCategoryId: category.id },
            params: { articleId: article.id },
            data: { name: 'Endret' },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await expect(articleCategoryOperations.addArticleToCategory({
            params: { id: category.id },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await articleCategoryOperations.updateArticle.update({
            implementationParams: { articleCategoryId: category.id },
            params: { articleId: article.id },
            data: { name: 'Endret' },
            session: sessionInGroups(groupOne),
        })

        expect(await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).toMatchObject({ name: 'Endret' })

        const added = await articleCategoryOperations.addArticleToCategory({
            params: { id: category.id },
            session: sessionInGroups(groupOne),
        })
        expect(await prisma.article.findUniqueOrThrow({ where: { id: added.id } })).toMatchObject({
            articleCategoryId: category.id
        })
    })

    test('the admin level of one category does not reach the articles of another', async () => {
        const administrated = await createCategory({ adminLevel: activeIn(groupOne) })
        const other = await createCategory({ adminLevel: activeIn(groupTwo) })
        const article = await addArticle(other.id)

        await expect(articleCategoryOperations.updateArticle.update({
            implementationParams: { articleCategoryId: administrated.id },
            params: { articleId: article.id },
            data: { name: 'Endret' },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(Smorekopp)

        await expect(articleCategoryOperations.removeArticleFromCategory({
            implementationParams: { articleCategoryId: administrated.id },
            params: { articleId: article.id },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('DISSALLOWED'))

        expect(await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).toMatchObject({
            name: article.name
        })
    })

    test('ARTICLE_CATEGORY_ADMIN bypasses the admin level', async () => {
        const category = await createCategory({ adminLevel: activeIn(groupOne) })

        await articleCategoryOperations.update({
            params: { id: category.id },
            data: { description: 'Endret av artikkeladmin' },
            session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
        })

        expect(await prisma.articleCategory.findUniqueOrThrow({
            where: { id: category.id },
        })).toMatchObject({ description: 'Endret av artikkeladmin' })
    })

    test('the admin level may update both levels, the regular level may not', async () => {
        const category = await createCategory({
            regularLevel: activeInAnyOf(groupOne, groupTwo),
            adminLevel: activeIn(groupOne),
        })

        await expect(articleCategoryOperations.visibility.updateRegularLevel({
            implementationParams: { id: category.id },
            params: { visibilityId: category.visibilityRegularId },
            data: { requirements: [] },
            session: sessionInGroups(groupTwo),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await articleCategoryOperations.visibility.updateRegularLevel({
            implementationParams: { id: category.id },
            params: { visibilityId: category.visibilityRegularId },
            data: { requirements: [] },
            session: sessionInGroups(groupOne),
        })

        await articleCategoryOperations.visibility.updateAdminLevel({
            implementationParams: { id: category.id },
            params: { visibilityId: category.visibilityAdminId },
            data: activeIn(groupTwo),
            session: sessionInGroups(groupOne),
        })

        // groupOne handed the category to groupTwo, so it may no longer change it.
        await expect(articleCategoryOperations.update({
            params: { id: category.id },
            data: { description: 'Endret' },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('destroying requires ARTICLE_CATEGORY_ADMIN, and removes the articles and both levels', async () => {
        const category = await createCategory({ adminLevel: activeIn(groupOne) })
        const article = await addArticle(category.id)

        // Satisfying the admin level is not enough: destroying takes every article along.
        await expect(articleCategoryOperations.destroy({
            params: { id: category.id },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await articleCategoryOperations.destroy({
            params: { id: category.id },
            session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
        })

        expect(await prisma.articleCategory.count({ where: { id: category.id } })).toBe(0)
        expect(await prisma.article.count({ where: { id: article.id } })).toBe(0)
        // The cover image hangs off the article, so the cascade alone would leave it behind.
        expect(await prisma.cmsImage.count({ where: { id: article.coverImageId } })).toBe(0)
        expect(await prisma.visibility.count({
            where: { id: { in: [category.visibilityRegularId, category.visibilityAdminId] } },
        })).toBe(0)
    })
})

describe('development seeded categories', () => {
    beforeAll(async () => {
        // Twice, since a re-seed must find the categories it made rather than make them again.
        await seedDevArticleCategories()
        await seedDevArticleCategories()
    }, 120 * 1000)

    test('are seeded once', async () => {
        expect(await prisma.articleCategory.count({ where: { name: 'om omega' } })).toBe(1)
    })

    test('are readable by anyone, but editable only through ARTICLE_CATEGORY_ADMIN', async () => {
        const seeded = await articleCategoryOperations.read({
            params: { name: 'om omega' },
            session: Session.empty(),
        })

        await expect(articleCategoryOperations.update({
            params: { id: seeded.id },
            data: { description: 'Kapret' },
            session: sessionInGroups(groupOne),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))

        await articleCategoryOperations.update({
            params: { id: seeded.id },
            data: { description: seeded.description ?? '' },
            session: sessionWithPermissions('ARTICLE_CATEGORY_ADMIN'),
        })
    })
})
