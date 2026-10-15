/** @jest-config-loader esbuild-register */

import nextJest from 'next/jest.js'
import type { Config } from 'jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
    coverageProvider: 'v8',
    globalSetup: './tests/globalSetup.ts',
    testEnvironment: './tests/PrismaTestEnvironment.ts',
    setupFilesAfterEnv: ['./tests/setup.ts', './tests/cleanup.ts'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}'],
    coverageReporters: ['text-summary'],
    moduleNameMapper: {
        // This is needed becaue jest doesn't handle the this code is inside node_modules
        '^@/prisma-dobbel-omega/(.*)$': '<rootDir>/node_modules/.prisma-dobbel-omega/$1',
    },
    globals: {
        'ts-jest': {
            useESM: true,
        },
    }
}

export default async function jestConfig() {
    const base = await createJestConfig(config)()
    return {
        ...base,
        transformIgnorePatterns: [], // This needed to transform node_module from es6 syntax, to a syntax jest can handle
    }
}
