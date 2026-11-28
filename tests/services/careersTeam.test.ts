import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { careersTeamOperations } from '@/services/careers/team/operations'
import { careersTeamPersonOperations } from '@/services/careers/team/persons/operations'
import { frontpageOperations } from '@/services/frontpage/operations'
import { userOperations } from '@/services/users/operations'
import { withServiceContext } from '@/services/serviceOperation'
import { testSession } from 'tests/utils'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { AnySession } from '@/auth/session/Session'

const teamEditor = Session.fromJsObject({ user: null, permissions: ['JOBAD_ADMIN'], memberships: [] })

// Minimal valid PNG (1x1 red pixel)
const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x9c, 0xe3, 0xbf, 0x59, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
])

let departmentId: number

async function createPerson(name: string) {
    return await careersTeamPersonOperations.create({
        params: { departmentId },
        data: { name, title: 'Bedrift', email: '' },
        session: teamEditor,
    })
}

async function uploadPortrait(personId: number) {
    return await careersTeamPersonOperations.updateImage({
        params: { personId },
        data: { imageFile: new File([pngBuffer], 'portrett.png', { type: 'image/png' }) },
        session: teamEditor,
    })
}

async function readPersonNames() {
    const departments = await careersTeamOperations.readDepartments({ session: Session.empty() })
    return departments.find(department => department.id === departmentId)?.persons.map(person => person.name)
}

beforeAll(async () => {
    const department = await careersTeamOperations.createDepartment({
        data: { name: 'Bedrift' },
        session: teamEditor,
    })
    departmentId = department.id
})

describe('careers team', () => {
    test('anyone can read the team, but not change it', async () => {
        await expect(careersTeamOperations.readDepartments({ session: Session.empty() })).resolves.toBeDefined()
        await expect(careersTeamOperations.createDepartment({
            data: { name: 'PR' },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })

    test('a person starts without a portrait, and an empty email is stored as none', async () => {
        const person = await createPerson('Kari')
        expect(person.email).toBeNull()
        expect(person.image).toBeNull()
    })

    test('a portrait goes in the person images collection, and a new one replaces it', async () => {
        const person = await createPerson('Lise')

        const first = await uploadPortrait(person.id)
        const collection = await prisma.imageCollection.findUniqueOrThrow({ where: { id: first.collectionId } })
        expect(collection.special).toBe('CAREERTEAMIMAGES')

        const second = await uploadPortrait(person.id)
        const updated = await prisma.careerTeamPerson.findUniqueOrThrow({ where: { id: person.id } })
        expect(updated.imageId).toBe(second.id)
        expect(await prisma.image.count({ where: { id: first.id } })).toBe(0)
    })

    test('persons are listed in order and can be moved', async () => {
        const first = await createPerson('Ola')
        await createPerson('Per')
        expect(await readPersonNames()).toEqual(['Kari', 'Lise', 'Ola', 'Per'])

        await careersTeamPersonOperations.move({
            params: { personId: first.id },
            data: { direction: 'DOWN' },
            session: teamEditor,
        })
        expect(await readPersonNames()).toEqual(['Kari', 'Lise', 'Per', 'Ola'])
    })

    test('deleting a department removes its persons, their portraits and its paragraph', async () => {
        const department = await prisma.careerTeamDepartment.findUniqueOrThrow({
            where: { id: departmentId },
            include: { persons: true },
        })
        const imageIds = department.persons.flatMap(person => (person.imageId === null ? [] : [person.imageId]))
        expect(imageIds).toHaveLength(1)

        await careersTeamOperations.destroyDepartment({ params: { departmentId }, session: teamEditor })

        expect(await prisma.careerTeamPerson.count({ where: { departmentId } })).toBe(0)
        expect(await prisma.image.count({ where: { id: { in: imageIds } } })).toBe(0)
        expect(await prisma.cmsParagraph.count({ where: { id: department.paragraphId } })).toBe(0)
    })
})

describe('the rules of the careers team, from its contract', () => {
    const committeeAdmin = Session.fromJsObject({ user: null, permissions: ['COMMITTEE_ADMIN'], memberships: [] })
    let signedIn: AnySession
    let department: { id: number, paragraphId: number }

    beforeAll(async () => {
        const user = await userOperations.create({
            data: {
                email: 'careersteam@omega.ntnu.no',
                firstname: 'Test',
                lastname: 'Testesen',
                username: 'careersteam',
                emailVerified: new Date().toISOString(),
            },
            bypassAuth: true,
        })
        signedIn = testSession({ user, permissions: ['JOBAD_USE'] })
        department = await careersTeamOperations.createDepartment({ data: { name: 'Arrangement' }, session: teamEditor })
    })

    test('a job ad admin and a committee admin change a department and its paragraph', async () => {
        await careersTeamOperations.updateDepartment({
            params: { departmentId: department.id },
            data: { name: 'Arrangementer' },
            session: committeeAdmin,
        })

        await expect(careersTeamOperations.updateDepartmentParagraph({
            params: { paragraphId: department.paragraphId },
            data: { markdown: 'Vi lager *bedpres*' },
            session: teamEditor,
        })).resolves.toMatchObject({ contentMd: 'Vi lager *bedpres*' })
        await expect(careersTeamOperations.updateDepartmentParagraph({
            params: { paragraphId: department.paragraphId },
            data: { markdown: 'Vi lager bedpres' },
            session: committeeAdmin,
        })).resolves.toMatchObject({ contentMd: 'Vi lager bedpres' })
    })

    test('a user with neither permission changes nothing, and a visitor is asked to sign in', async () => {
        const params = { departmentId: department.id }
        const paragraphBefore = await prisma.cmsParagraph.findUniqueOrThrow({ where: { id: department.paragraphId } })
        for (const [session, errorCode] of [[signedIn, 'UNAUTHORIZED'], [Session.empty(), 'UNAUTHENTICATED']] as const) {
            await expect(careersTeamOperations.createDepartment({ data: { name: 'PR' }, session }))
                .rejects.toMatchObject({ errorCode })
            await expect(careersTeamOperations.updateDepartment({ params, data: { name: 'PR' }, session }))
                .rejects.toMatchObject({ errorCode })
            await expect(careersTeamOperations.moveDepartment({ params, data: { direction: 'UP' }, session }))
                .rejects.toMatchObject({ errorCode })
            await expect(careersTeamOperations.destroyDepartment({ params, session }))
                .rejects.toMatchObject({ errorCode })
            await expect(careersTeamOperations.updateDepartmentParagraph({
                params: { paragraphId: department.paragraphId },
                data: { markdown: 'Nei' },
                session,
            })).rejects.toMatchObject({ errorCode })
        }
        await expect(prisma.cmsParagraph.findUniqueOrThrow({ where: { id: department.paragraphId } }))
            .resolves.toMatchObject({ contentMd: paragraphBefore.contentMd })
    })

    test('a paragraph of another owner is refused by the ownership check, whoever asks', async () => {
        const frontpageParagraph = await frontpageOperations.cmsParagraphs.internal.read.internalCall({
            params: { special: 'FRONTPAGE_3' },
        })

        await expect(careersTeamOperations.updateDepartmentParagraph({
            params: { paragraphId: frontpageParagraph.id },
            data: { markdown: 'Ikke vårt' },
            session: teamEditor,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
        await expect(prisma.cmsParagraph.findUniqueOrThrow({ where: { id: frontpageParagraph.id } }))
            .resolves.toMatchObject({ contentMd: frontpageParagraph.contentMd })
    })

    test('a department is destroyed in a transaction of its own, so not inside another', async () => {
        await expect(prisma.$transaction(tx => withServiceContext({ prisma: tx }, 'NONE', () =>
            careersTeamOperations.destroyDepartment({ params: { departmentId: department.id }, session: teamEditor })
        ))).rejects.toMatchObject({ errorCode: 'SERVER ERROR' })
        expect(await prisma.careerTeamDepartment.count({ where: { id: department.id } })).toBe(1)
    })
})
