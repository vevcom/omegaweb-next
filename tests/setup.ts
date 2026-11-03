import { DomainConfig } from '@/lib/sites/domainConfig'
import { SiteContext } from '@/lib/sites/context'
import { jest } from '@jest/globals'

// React email rendering uses dynamic imports which are not supported in Jest by default.
// We mock the render function to avoid issues during tests.
jest.mock('@react-email/render', () => ({
    render: jest.fn().mockImplementation(() => 'Email rendering is disabled during tests.'),
}))

// Tests run without site domains, whatever sites.json at the repo root says.
SiteContext.configure(DomainConfig.parse({}))
