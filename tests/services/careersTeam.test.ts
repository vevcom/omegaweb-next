import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { careersTeamOperations } from '@/services/careers/team/operations'
import { cmsPersonOperations } from '@/cms/persons/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'

const teamEditor = Session.fromJsObject({ user: null, permissions: ['JOBAD_ADMIN'], memberships: [] })

let departmentId: number

async function createPerson(name: string) {
    return await careersTeamOperations.createPerson({
        implementationParams: { departmentId },
        data: { name, title: 'Bedrift', email: '' },
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

    test('a person gets their own portrait, and an empty email is stored as none', async () => {
        const person = await createPerson('Kari')
        expect(person.email).toBeNull()
        expect(person.cmsImage.id).toBe(person.cmsImageId)
    })

    test('persons are listed in order and can be moved', async () => {
        const first = await createPerson('Ola')
        await createPerson('Per')
        expect(await readPersonNames()).toEqual(['Kari', 'Ola', 'Per'])

        await careersTeamOperations.movePerson({
            params: { cmsPersonId: first.id },
            data: { direction: 'DOWN' },
            session: teamEditor,
        })
        expect(await readPersonNames()).toEqual(['Kari', 'Per', 'Ola'])
    })

    test('the team cannot change a person that is not on the team', async () => {
        const stranger = await prisma.cmsPerson.create({
            data: { name: 'Fremmed', title: 'Ingen', cmsImage: { create: {} } },
        })
        await expect(careersTeamOperations.updatePerson({
            params: { cmsPersonId: stranger.id },
            data: { name: 'Endret' },
            session: teamEditor,
        })).rejects.toThrow(Smorekopp)
        await cmsPersonOperations.destroy.internalCall({ params: { cmsPersonId: stranger.id } })
    })

    test('deleting a department removes its persons, their portraits and its paragraph', async () => {
        const department = await prisma.careerTeamDepartment.findUniqueOrThrow({
            where: { id: departmentId },
            include: { persons: true },
        })
        const cmsImageIds = department.persons.map(person => person.cmsImageId)

        await careersTeamOperations.destroyDepartment({ params: { departmentId }, session: teamEditor })

        expect(await prisma.cmsPerson.count({ where: { careerTeamDepartmentId: departmentId } })).toBe(0)
        expect(await prisma.cmsImage.count({ where: { id: { in: cmsImageIds } } })).toBe(0)
        expect(await prisma.cmsParagraph.count({ where: { id: department.paragraphId } })).toBe(0)
    })
})
