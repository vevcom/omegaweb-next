import { eventListFilterOf, filterableKinds, kindsToRead } from '@/pageKits/events/filter'
import { eventLinks } from '@/pageKits/events/links'
import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { describe, expect, test } from '@jest/globals'

describe('the filter of a list of events', () => {
    test('offers the kinds marked by a tag where the pages show several kinds', () => {
        expect(filterableKinds(omegaEventPages)).toEqual(['COMPANY_PRESENTATION'])
        expect(filterableKinds(companyPresentationPages)).toEqual([])
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
        expect(eventListFilterOf(omegaEventPages, { 'event-kinds': 'ORDINARY,NONSENSE' }).kinds).toEqual([])

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
