import { changeEventSetup } from 'tests/eventSetup'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { EventRegistrationType } from '@/prisma-generated-pn-types'

const HOUR = 60 * 60 * 1000
const open = { visibilityRequirements: [] }
const period = {
    registrationStart: new Date(Date.now() - HOUR),
    registrationEnd: new Date(Date.now() + 24 * HOUR),
    takesPayment: false,
}

let userIds: number[]

const refusedWith = (message: string) => ({ errors: [{ message }] })

beforeAll(async () => {
    const users = await Promise.all(['first', 'second'].map(name => userOperations.create({
        data: {
            email: `event-slots-${name}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username: `event-slots-${name}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    userIds = users.map(user => user.id)
})

async function createEventWithVariant(name: string, registrationType: EventRegistrationType) {
    const event = await eventOperations.create({
        data: {
            kind: 'ORDINARY',
            name,
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 48 * HOUR),
            eventEnd: new Date(Date.now() + 50 * HOUR),
            visibilityAdminRequirements: [{ conditions: [] }],
        },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id: event.id },
        data: {
            waitingList: true,
            variants: [{ name: 'Påmelding', registrationType, ...period, quotas: [{ name: 'Alle', places: 2, ...open }] }],
        },
        bypassAuth: true,
    })
    const variant = await prisma.eventVariant.findFirstOrThrow({ where: { eventId: event.id } })
    return { eventId: event.id, variant }
}

const registerAsAdmin = (eventId: number, userId: number) => eventRegistrationOperations.createAsAdmin({
    params: { eventId, userId },
    bypassAuth: true,
})

const typeOf = async (variantId: number) => (
    await prisma.eventVariant.findUniqueOrThrow({ where: { id: variantId } })
).registrationType

describe('the registration type of a variant', () => {
    test('is a list unless it is said otherwise', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Liste som før',
                takesRegistration: true,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })

        expect(await prisma.eventVariant.findMany({ where: { eventId: event.id } }))
            .toMatchObject([{ registrationType: 'LIST' }])
    })

    test('is kept through a save, and changed by one while no one is registered', async () => {
        const { eventId, variant } = await createEventWithVariant('Bytter type', 'SLOTTED')

        await changeEventSetup(eventId, variants => {
            variants[0].name = 'Nytt navn'
        })
        expect(await typeOf(variant.id)).toBe('SLOTTED')

        await changeEventSetup(eventId, variants => {
            variants[0].registrationType = 'LIST'
        })
        expect(await typeOf(variant.id)).toBe('LIST')
    })

    test('is not changed while someone is registered', async () => {
        const { eventId, variant } = await createEventWithVariant('Har påmeldte', 'LIST')
        await registerAsAdmin(eventId, userIds[0])

        await expect(changeEventSetup(eventId, variants => {
            variants[0].registrationType = 'SLOTTED'
        })).rejects.toMatchObject(refusedWith('Varianten har påmeldte, så påmeldingstypen kan ikke endres.'))
        expect(await typeOf(variant.id)).toBe('LIST')
    })

    test('is not changed while someone waits for a place', async () => {
        const { eventId, variant } = await createEventWithVariant('Har en som venter', 'LIST')
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: userIds[1] },
        })

        await expect(changeEventSetup(eventId, variants => {
            variants[0].registrationType = 'SLOTTED'
        })).rejects.toMatchObject(refusedWith('Varianten har påmeldte, så påmeldingstypen kan ikke endres.'))
        expect(await typeOf(variant.id)).toBe('LIST')
    })
})

describe('registering on a slotted variant', () => {
    const refusal = refusedWith('Påmelding til tidsluker er ikke mulig ennå.')

    test('is refused, for a user, by an administrator and for a guest', async () => {
        const { eventId, variant } = await createEventWithVariant('Ingen påmelding ennå', 'SLOTTED')

        await expect(eventRegistrationOperations.create({
            params: { eventId, userId: userIds[0] },
            bypassAuth: true,
        })).rejects.toMatchObject(refusal)
        await expect(registerAsAdmin(eventId, userIds[1])).rejects.toMatchObject(refusal)
        await expect(eventRegistrationOperations.createGuest({
            params: { eventId },
            data: { name: 'Gjest', note: '' },
            bypassAuth: true,
        })).rejects.toMatchObject(refusal)
        expect(await prisma.eventRegistration.count({
            where: { OR: [{ quota: { variantId: variant.id } }, { waitingListVariantId: variant.id }] },
        })).toBe(0)
    })

    test('on a list variant goes on as before', async () => {
        const { eventId } = await createEventWithVariant('Påmelding som før', 'LIST')

        expect(await registerAsAdmin(eventId, userIds[0])).toMatchObject({ state: 'IN_QUOTA' })
    })
})
