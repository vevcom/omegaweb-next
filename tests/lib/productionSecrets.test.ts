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

const devValues = parseEnv(readFileSync('.env.default', 'utf8'))

let original: Record<string, string | undefined>

beforeEach(() => {
    original = Object.fromEntries(names.map(name => [name, process.env[name]]))
    names.forEach(name => {
        process.env[name] = `a-production-value-for-${name}-that-is-long-enough`
    })
})

afterEach(() => {
    names.forEach(name => {
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
        expect(() => assertProductionSecrets()).toThrow(/NEXTAUTH_SECRET is shorter[\s\S]*JWT_SECRET is shorter/)
    })
})
