import { eventListFilterOf, kindsToRead, showsSeveralKinds } from '@/pageKits/events/filter'
import { eventLinks } from '@/pageKits/events/links'
import { eventHomePages } from '@/pageKits/events/homePages'
import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { speedInterviewPages } from '@/app/(careers)/career/speed-interviews/config'
import { describe, expect, test } from '@jest/globals'

describe('the filter of a list of events', () => {
    test('is narrowed to kinds only where the pages show several', () => {
        expect(showsSeveralKinds(omegaEventPages)).toBe(true)
        expect(showsSeveralKinds(companyPresentationPages)).toBe(false)
        expect(eventListFilterOf(omegaEventPages, { 'event-kinds': 'ORDINARY,SPEED_INTERVIEW' }).kinds)
            .toEqual(['ORDINARY', 'SPEED_INTERVIEW'])
    })

    test('reads every kind the pages show until one is picked', () => {
        const unfiltered = eventListFilterOf(omegaEventPages, {})
        expect(unfiltered).toEqual({ tagNames: null, kinds: [], search: '' })
        expect(kindsToRead(omegaEventPages, unfiltered)).toEqual(omegaEventPages.kindsToShow)

        const picked = eventListFilterOf(omegaEventPages, { 'event-kinds': 'COMPANY_PRESENTATION', 'event-tags': 'Fest' })
        expect(picked).toEqual({ tagNames: ['Fest'], kinds: ['COMPANY_PRESENTATION'], search: '' })
        expect(kindsToRead(omegaEventPages, picked)).toEqual(['COMPANY_PRESENTATION'])
    })

    test('ignores a kind the pages cannot be narrowed to', () => {
        expect(eventListFilterOf(omegaEventPages, { 'event-kinds': 'NONSENSE' }).kinds).toEqual([])

        const careers = eventListFilterOf(companyPresentationPages, { 'event-kinds': 'ORDINARY', 'event-tags': 'Fest' })
        expect(careers).toEqual({ tagNames: null, kinds: [], search: '' })
        expect(kindsToRead(companyPresentationPages, careers)).toEqual(['COMPANY_PRESENTATION'])
    })

    test('is carried by the links to the lists', () => {
        const links = eventLinks(omegaEventPages)
        expect(links.list()).toBe('/events')
        expect(links.archive({ tagNames: ['Fest'], kinds: ['COMPANY_PRESENTATION'], search: 'jul' }))
            .toBe('/events/archive?event-tags=Fest&event-kinds=COMPANY_PRESENTATION&search=jul')
    })
})

describe('the link to an event', () => {
    const presentation = { id: 7, name: 'Bedpres', kind: 'COMPANY_PRESENTATION' } as const
    const party = { id: 8, name: 'Fest', kind: 'ORDINARY' } as const

    test('stays on the pages it is made from when they show the kind of the event', () => {
        const omega = eventLinks(omegaEventPages)
        expect(omega.event(presentation)).toBe('/events/bedpres-7')
        expect(omega.event(party)).toBe('/events/fest-8')
        expect(eventLinks(companyPresentationPages).attendance(presentation))
            .toBe('/career/company-presentations/bedpres-7/attendance')
    })

    test('goes to the home pages of the kind when they do not', () => {
        const careers = eventLinks(companyPresentationPages)
        expect(careers.event(party)).toBe('/events/fest-8')
        expect(careers.attendance(party)).toBe('/events/fest-8/attendance')
    })

    test('keeps the kinds of the career site on the pages of each', () => {
        const speedInterview = { id: 9, name: 'Speed', kind: 'SPEED_INTERVIEW' } as const
        expect(eventLinks(speedInterviewPages).event(speedInterview)).toBe('/career/speed-interviews/speed-9')
        expect(eventLinks(companyPresentationPages).event(speedInterview)).toBe('/career/speed-interviews/speed-9')
        expect(eventLinks(speedInterviewPages).event(presentation)).toBe('/career/company-presentations/bedpres-7')
        expect(eventLinks(omegaEventPages).event(speedInterview)).toBe('/events/speed-9')
    })

    test('has home pages that show the kind they are the home of', () => {
        Object.entries(eventHomePages).forEach(([kind, pages]) => {
            expect(pages.kindsToShow).toContain(kind)
        })
    })
})
