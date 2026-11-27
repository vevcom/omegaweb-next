import { lockerLocationCapabilities } from '@/capabilities/lockers/locations/capabilities'
import { prisma } from '@/prisma-pn-client-instance'
import { lockerLocationOperations } from '@/services/lockers/locations/operations'
import { parseData } from '@/services/parseData'
import { userOperations } from '@/services/users/operations'
import { testSession } from 'tests/utils'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { AnySession } from '@/auth/session/Session'

const BUILDING = 'Lokasjonsblokka'

let admin: AnySession
let lockerUser: AnySession
const visitor = testSession({})

beforeAll(async () => {
    const user = await userOperations.create({
        data: {
            email: 'lockerlocations@omega.ntnu.no',
            firstname: 'Test',
            lastname: 'Testesen',
            username: 'lockerlocations',
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    admin = testSession({ user, permissions: ['LOCKER_ADMIN'] })
    lockerUser = testSession({ user, permissions: ['LOCKER_USE'] })
})

describe('the rules of the locker locations', () => {
    test('a locker admin creates, renames and deletes a location', async () => {
        const location = await lockerLocationOperations.create({ data: { building: BUILDING, floor: 1 }, session: admin })

        await expect(lockerLocationOperations.update({
            params: { id: location.id },
            data: { building: BUILDING, floor: 2 },
            session: admin,
        })).resolves.toMatchObject({ building: BUILDING, floor: 2 })

        await lockerLocationOperations.destroy({ params: { id: location.id }, session: admin })
        expect(await prisma.lockerLocation.count({ where: { id: location.id } })).toBe(0)
    })

    test('a user who is no locker admin does none of it', async () => {
        const location = await lockerLocationOperations.create({ data: { building: BUILDING, floor: 3 }, session: admin })

        await expect(lockerLocationOperations.create({ data: { building: BUILDING, floor: 4 }, session: lockerUser }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(lockerLocationOperations.update({
            params: { id: location.id },
            data: { building: BUILDING, floor: 4 },
            session: lockerUser,
        })).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(lockerLocationOperations.destroy({ params: { id: location.id }, session: lockerUser }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })

        expect(await prisma.lockerLocation.findUniqueOrThrow({ where: { id: location.id } }))
            .toMatchObject({ building: BUILDING, floor: 3 })
        expect(await prisma.lockerLocation.count({ where: { building: BUILDING, floor: 4 } })).toBe(0)
    })

    test('a visitor is told to sign in, and reads the locations all the same', async () => {
        await expect(lockerLocationOperations.create({ data: { building: BUILDING, floor: 5 }, session: visitor }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })

        await expect(lockerLocationOperations.readAll({ session: visitor })).resolves.toEqual(expect.any(Array))
    })
})

describe('the values a form of a locker location submits', () => {
    const { data: schema } = lockerLocationCapabilities.create

    test('are taken as they are typed', () => {
        expect(parseData(schema, { building: ' Realfagbygget ', floor: 2 }))
            .toEqual({ success: true, data: { building: 'Realfagbygget', floor: 2 } })
    })

    test.each([undefined, null, '', '2'])('a floor of %p is refused at the floor, and never read as a number', floor => {
        const parsed = parseData(schema, { building: 'Realfagbygget', floor })

        expect(parsed.error?.issues.map(issue => issue.path)).toEqual([['floor']])
    })

    test('a floor that is no whole number is refused at the floor, in words of its own', () => {
        const parsed = parseData(schema, { building: 'Realfagbygget', floor: 1.5 })

        expect(parsed.error?.issues).toMatchObject([{ path: ['floor'], message: 'Etasje må være et heltall' }])
    })
})
