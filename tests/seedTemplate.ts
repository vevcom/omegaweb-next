import seed from '@/prisma/seeder/src/seed'
import { prisma } from '@/prisma-pn-client-instance'

// Run by globalSetup.ts in its own process, as the seeder imports through the path aliases.
seed({ devData: false, logging: false }).finally(() => prisma.$disconnect())
