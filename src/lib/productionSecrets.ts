import '@pn-server-only'
import { readFileSync } from 'fs'
import { parseEnv } from 'util'

const secretNames = [
    'NEXTAUTH_SECRET',
    'JWT_SECRET',
    'PASSWORD_ENCRYPTION_KEY',
    'API_KEY_ENCRYPTION_KEY',
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
] as const

const secretsWithMinimumLength = ['NEXTAUTH_SECRET', 'JWT_SECRET'] as const
const minimumSecretLength = 32

/**
 * Refuses to let production start on the development secrets from .env.default, on secrets too
 * short to resist guessing, or with a secret not set at all. Anyone holding NEXTAUTH_SECRET can forge
 * a session, and anyone holding JWT_SECRET can forge a password reset link. A missing one is only
 * read when first used - signing a token, hashing a password - so without this check the server
 * would start and fail there instead.
 *
 * @param envDefaultPath - Where .env.default is. The production image ships it for this check.
 */
export function assertProductionSecrets(envDefaultPath = '.env.default') {
    const devValues = parseEnv(readFileSync(envDefaultPath, 'utf8'))

    const missing = secretNames.filter(name => !process.env[name])
    const devValuesInUse = secretNames.filter(name => process.env[name] && process.env[name] === devValues[name])
    const tooShort = secretsWithMinimumLength.filter(name => {
        const secret = process.env[name]
        return secret && secret.length < minimumSecretLength
    })

    const problems = [
        ...missing.map(name => `${name} is not set`),
        ...devValuesInUse.map(name => `${name} has the development value from .env.default`),
        ...tooShort.map(name => `${name} is shorter than ${minimumSecretLength} characters`),
    ]
    if (problems.length) {
        throw new Error(`Refusing to start in production:\n${problems.join('\n')}`)
    }
}
