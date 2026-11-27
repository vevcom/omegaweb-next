import { creatorHoldsDraft, eventAuth, visibilitiesShowingEvent } from '@/services/events/auth'
import { canRegisterSelf } from '@/services/events/registration/auth'
import { Session } from '@/auth/session/Session'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { activeMembersOf } from 'tests/utils'
import { describe, expect, test } from '@jest/globals'
import type { SessionCompanyUser, SessionUser } from '@/auth/session/Session'
import type { EventAccess } from '@/services/events/types'
import type { VisibilityMatrix } from '@/services/visibility/types'

const inGroup = (groupId: number): VisibilityMatrix => ({ requirements: [{ conditions: [activeMembersOf(groupId)] }] })
const everyone: VisibilityMatrix = { requirements: [] }
const ARRKOM = 1
const MEMBERS = 2

const event = (changes: Partial<EventAccess>): EventAccess => ({
    published: true,
    canBeViewedBy: 'ALL',
    adminVisibility: inGroup(ARRKOM),
    creatorId: 7,
    quotaVisibilities: [everyone],
    companyId: null,
    ...changes,
})
const memberOf = (...groupIds: number[]) => Session.fromJsObject({
    user: { id: 3 } as SessionUser['user'],
    permissions: [],
    memberships: groupIds.map(groupId => ({ groupId, active: true, order: 105, admin: false })),
})

describe('visibilitiesShowingEvent', () => {
    test('a published event for all is shown to everyone', () => {
        expect(visibilitiesShowingEvent(event({}))).toEqual([everyone])
    })

    test('one only for those who can register is shown by its quotas and its administrators', () => {
        const access = event({ canBeViewedBy: 'CAN_REGISTER', quotaVisibilities: [inGroup(MEMBERS)] })
        expect(visibilitiesShowingEvent(access)).toEqual([inGroup(ARRKOM), inGroup(MEMBERS)])
    })

    test('a draft is shown by its administrators alone', () => {
        expect(visibilitiesShowingEvent(event({ published: false }))).toEqual([inGroup(ARRKOM)])
    })

    test.each([
        event({}),
        event({ canBeViewedBy: 'CAN_REGISTER', quotaVisibilities: [inGroup(MEMBERS)] }),
        event({ published: false }),
    ])('says the same as the rule for seeing the event', access => {
        const passesOne = (session: ReturnType<typeof memberOf>) => visibilitiesShowingEvent(access).some(
            visibility => checkVisibility(session.memberships, visibility)
        )
        const sessions = [memberOf(), memberOf(ARRKOM), memberOf(MEMBERS)]
        sessions.forEach(session => {
            expect(eventAuth.read.data(access).auth(session).authorized).toBe(passesOne(session))
        })
    })
})

describe('the users of the event\'s company', () => {
    const companyUserOf = (companyId: number) => Session.fromJsObject({
        user: null,
        companyUser: { id: 4, admin: false, company: { id: companyId } } as SessionCompanyUser['companyUser'],
        permissions: [],
        memberships: [],
    })

    test('see it, also as a draft, and do nothing else with it', () => {
        const draft = event({ published: false, canBeViewedBy: 'CAN_REGISTER', companyId: 5 })
        expect(eventAuth.read.data(draft).auth(companyUserOf(5)).authorized).toBe(true)
        expect(eventAuth.update.data({ ...draft, setsCompany: false }).auth(companyUserOf(5)).authorized).toBe(false)
        expect(canRegisterSelf.data({ ...draft, published: true }).auth(companyUserOf(5)).authorized).toBe(false)
    })

    test('are not those of another company, and an event without one has none', () => {
        const draft = event({ published: false, companyId: 5 })
        expect(eventAuth.read.data(draft).auth(companyUserOf(6)).authorized).toBe(false)
        expect(eventAuth.read.data({ ...draft, companyId: null }).auth(companyUserOf(5)).authorized).toBe(false)
    })
})

describe('creatorHoldsDraft', () => {
    const noAdministrators: VisibilityMatrix = { requirements: [{ conditions: [] }] }

    test('a draft no one administrates is its creator\'s, who then sees it', () => {
        const draft = event({ published: false, adminVisibility: noAdministrators, creatorId: 3 })
        expect(creatorHoldsDraft(draft)).toBe(true)
        expect(eventAuth.read.data(draft).auth(memberOf()).authorized).toBe(true)
    })

    test('a draft with administrators, or a published event, is not', () => {
        expect(creatorHoldsDraft(event({ published: false }))).toBe(false)
        expect(creatorHoldsDraft(event({ adminVisibility: noAdministrators }))).toBe(false)
    })
})

describe('canRegisterSelf', () => {
    test('sends a visitor who is not logged in to the login', () => {
        const result = canRegisterSelf.data(event({})).auth(Session.empty())
        expect(result.authorized).toBe(false)
        expect(result.status).toBe('UNAUTHENTICATED')
    })

    test('takes whoever passes a quota of a published event', () => {
        const access = event({ quotaVisibilities: [inGroup(MEMBERS)] })
        expect(canRegisterSelf.data(access).auth(memberOf(MEMBERS)).authorized).toBe(true)
        expect(canRegisterSelf.data(access).auth(memberOf()).authorized).toBe(false)
    })

    test('takes no one but its administrators for a draft', () => {
        const draft = event({ published: false })
        expect(canRegisterSelf.data(draft).auth(memberOf()).authorized).toBe(false)
        expect(canRegisterSelf.data(draft).auth(memberOf(ARRKOM)).authorized).toBe(true)
    })
})
