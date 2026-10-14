import seed from '@/prisma/seeder/src/seed'
import { beforeAll, jest } from '@jest/globals'

// React email rendering uses dynamic imports which are not supported in Jest by default.
// We mock the render function to avoid issues during tests.
jest.mock('@react-email/render', () => ({
    render: jest.fn().mockImplementation(() => 'Email rendering is disabled during tests.'),
}))

const timeout = 60 * 1000

beforeAll(
    async () => await seed({ devData: false, logging: false }),
    timeout,
)
