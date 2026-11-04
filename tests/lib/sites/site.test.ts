import { Site } from '@/lib/sites/site'
import { describe, expect, test } from '@jest/globals'

describe('Site', () => {
    test('is one of three instances, by name', () => {
        expect(Site.of('CAREERS')).toBe(Site.CAREERS)
        expect(Site.all).toEqual([Site.OMEGAWEB, Site.CAREERS, Site.REVUE])
        expect(Site.root).toBe(Site.OMEGAWEB)
        expect(Site.OMEGAWEB.isRoot).toBe(true)
        expect(Site.CAREERS.isRoot).toBe(false)
    })

    test('finds the site of an app path by its base path, the root site serving the rest', () => {
        expect(Site.ofPath('/career/job-ads')).toBe(Site.CAREERS)
        expect(Site.ofPath('/career')).toBe(Site.CAREERS)
        expect(Site.ofPath('/career?event-tags=x')).toBe(Site.CAREERS)
        expect(Site.ofPath('/careers-day')).toBe(Site.OMEGAWEB)
        expect(Site.ofPath('/revue/login')).toBe(Site.REVUE)
        expect(Site.ofPath('/')).toBe(Site.OMEGAWEB)
    })

    test('builds the app path of pages under it, and strips its base path for its own domain', () => {
        expect(Site.CAREERS.pagesPath('/job-ads')).toBe('/career/job-ads')
        expect(Site.OMEGAWEB.pagesPath('/events')).toBe('/events')
        expect(Site.CAREERS.pathOn('/career/job-ads')).toBe('/job-ads')
        expect(Site.CAREERS.pathOn('/career')).toBe('/')
        expect(Site.CAREERS.pathOn('/career?x=1')).toBe('/?x=1')
        expect(Site.OMEGAWEB.pathOn('/events')).toBe('/events')
    })
})
