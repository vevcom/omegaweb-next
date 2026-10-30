import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { careersTeamOperations } from '@/services/careers/team/operations'
import { cmsPersonOperations } from '@/cms/persons/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import { File } from 'node:buffer'

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
    return await careersTeamOperations.createPerson({
        implementationParams: { departmentId },
        data: { name, title: 'Bedrift', email: '' },
        session: teamEditor,
    })
}

async function uploadPortrait(cmsPersonId: number) {
    return await careersTeamOperations.updatePersonImage({
        params: { cmsPersonId },
        data: { imageFile: new File([pngBuffer], 'portrett.png', { type: 'image/png' }) as globalThis.File },
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
        expect(collection.special).toBe('PERSONIMAGES')

        const second = await uploadPortrait(person.id)
        const updated = await prisma.cmsPerson.findUniqueOrThrow({ where: { id: person.id } })
        expect(updated.imageId).toBe(second.id)
        expect(await prisma.image.count({ where: { id: first.id } })).toBe(0)
    })

    test('persons are listed in order and can be moved', async () => {
        const first = await createPerson('Ola')
        await createPerson('Per')
        expect(await readPersonNames()).toEqual(['Kari', 'Lise', 'Ola', 'Per'])

        await careersTeamOperations.movePerson({
            params: { cmsPersonId: first.id },
            data: { direction: 'DOWN' },
            session: teamEditor,
        })
        expect(await readPersonNames()).toEqual(['Kari', 'Lise', 'Per', 'Ola'])
    })

    test('the team cannot change a person that is not on the team', async () => {
        const stranger = await prisma.cmsPerson.create({ data: { name: 'Fremmed', title: 'Ingen' } })
        await expect(careersTeamOperations.updatePerson({
            params: { cmsPersonId: stranger.id },
            data: { name: 'Endret' },
            session: teamEditor,
        })).rejects.toThrow(Smorekopp)
        await expect(uploadPortrait(stranger.id)).rejects.toThrow(Smorekopp)
        await cmsPersonOperations.destroy.internalCall({ params: { cmsPersonId: stranger.id } })
    })

    test('deleting a department removes its persons, their portraits and its paragraph', async () => {
        const department = await prisma.careerTeamDepartment.findUniqueOrThrow({
            where: { id: departmentId },
            include: { persons: true },
        })
        const imageIds = department.persons.flatMap(person => (person.imageId === null ? [] : [person.imageId]))
        expect(imageIds).toHaveLength(1)

        await careersTeamOperations.destroyDepartment({ params: { departmentId }, session: teamEditor })

        expect(await prisma.cmsPerson.count({ where: { careerTeamDepartmentId: departmentId } })).toBe(0)
        expect(await prisma.image.count({ where: { id: { in: imageIds } } })).toBe(0)
        expect(await prisma.cmsParagraph.count({ where: { id: department.paragraphId } })).toBe(0)
    })
})
