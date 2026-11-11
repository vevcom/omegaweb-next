import { assertProductionSecrets } from '@/lib/productionSecrets'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { readFileSync } from 'fs'
import { parseEnv } from 'util'

const names = [
    'NEXTAUTH_SECRET',
    'JWT_SECRET',
    'PASSWORD_ENCRYPTION_KEY',
    'API_KEY_ENCRYPTION_KEY',
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
] as const

// Secrets production may run without, since mail is optional. The test container has the development
// EMAIL_ADMIN_PASSWORD set, so they are cleared before each test.
const optionalNames = ['EMAIL_ADMIN_PASSWORD'] as const

const devValues = parseEnv(readFileSync('.env.default', 'utf8'))

let original: Record<string, string | undefined>

beforeEach(() => {
    original = Object.fromEntries([...names, ...optionalNames].map(name => [name, process.env[name]]))
    names.forEach(name => {
        process.env[name] = `a-production-value-for-${name}-that-is-long-enough`
    })
    optionalNames.forEach(name => Reflect.deleteProperty(process.env, name))
})

afterEach(() => {
    [...names, ...optionalNames].forEach(name => {
        if (original[name] === undefined) Reflect.deleteProperty(process.env, name)
        else process.env[name] = original[name]
    })
})

describe('production secrets', () => {
    test('accepts long values that are not the development ones', () => {
        expect(() => assertProductionSecrets()).not.toThrow()
    })

    test('refuses every development value from .env.default', () => {
        names.forEach(name => {
            process.env[name] = devValues[name]
        })
        expect(() => assertProductionSecrets()).toThrow(
            new RegExp(names.map(name => `${name} has the development value`).join('[\\s\\S]*'))
        )
    })

    test('refuses short and missing secrets', () => {
        process.env.JWT_SECRET = 'too-short'
        Reflect.deleteProperty(process.env, 'NEXTAUTH_SECRET')
        expect(() => assertProductionSecrets()).toThrow(/NEXTAUTH_SECRET is not set[\s\S]*JWT_SECRET is shorter/)
    })

    test('refuses the development mail admin password, but accepts it unset', () => {
        optionalNames.forEach(name => {
            process.env[name] = devValues[name]
        })
        expect(() => assertProductionSecrets()).toThrow(
            /EMAIL_ADMIN_PASSWORD has the development value/
        )

        optionalNames.forEach(name => Reflect.deleteProperty(process.env, name))
        expect(() => assertProductionSecrets()).not.toThrow()
    })

    test('refuses a missing key pair, which nothing else checks until a token is signed', () => {
        Reflect.deleteProperty(process.env, 'JWT_PRIVATE_KEY')
        Reflect.deleteProperty(process.env, 'JWT_PUBLIC_KEY')
        expect(() => assertProductionSecrets()).toThrow(/JWT_PRIVATE_KEY is not set[\s\S]*JWT_PUBLIC_KEY is not set/)
    })
})
