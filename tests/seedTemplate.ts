import { testDomainConfig } from './testDomains'
import seed from '@/prisma/seeder/src/seed'
import { prisma } from '@/prisma-pn-client-instance'
import { SiteContext } from '@/lib/sites/context'

// Run by globalSetup.ts in its own process, as the seeder imports through the path aliases. The
// standard aliases go on the test domains, like everything the tests create.
SiteContext.configure(testDomainConfig)
void seed({ devData: false, logging: false }).finally(() => prisma.$disconnect())
