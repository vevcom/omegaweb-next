import type { SafeParseError } from 'zod'
import type { AuthStatus } from '@/auth/authorizer/AuthResult'

export const errorCodes = [
    {
        name: 'DUPLICATE',
        httpCode: 409,
        defaultMessage: 'En ressurs med samme navn eksisterer allerede',
    },
    {
        name: 'NOT FOUND',
        httpCode: 404,
        defaultMessage: 'Fant ikke ressursen',
    },
    {
        name: 'BAD PARAMETERS',
        httpCode: 400,
        defaultMessage: 'Feil i parametrene',
    },
    {
        name: 'BAD DATA',
        httpCode: 400,
        defaultMessage: 'Feil i dataen',
    },
    {
        name: 'UNKNOWN ERROR',
        httpCode: 500,
        defaultMessage: 'En ukjent feil har oppstått',
    },
    {
        name: 'JWT EXPIRED',
        httpCode: 401,
        defaultMessage: 'Din innlogging har utløpt',
    },
    {
        name: 'JWT INVALID',
        httpCode: 401,
        defaultMessage: 'Din innlogging er ugyldig',
    },
    {
        name: 'SERVER ERROR',
        httpCode: 500,
        defaultMessage: 'En serverfeil har oppstått',
    },
    {
        name: 'INVALID CONFIGURATION',
        httpCode: 500,
        defaultMessage: 'Konfigurasjonen er ugyldig',
    },
    {
        name: 'NOT IMPLEMENTED',
        httpCode: 501,
        defaultMessage: 'Funksjonen er ikke implementert',
    },
    {
        name: 'INVALID API KEY',
        httpCode: 401,
        defaultMessage: 'API-nøkkelen er ugyldig',
    },
    {
        name: 'UNAUTHORIZED',
        httpCode: 403,
        defaultMessage: 'Du har ikke tilgang til denne ressursen',
    },
    {
        name: 'UNAUTHENTICATED',
        httpCode: 401,
        defaultMessage: 'Du er ikke innlogget',
    },
    {
        name: 'UNPERMITTED CASCADE',
        httpCode: 400,
        defaultMessage: 'Du kan ikke slette denne ressursen fordi den er tilknyttet andre ressurser',
    },
    {
        name: 'DISSALLOWED',
        httpCode: 403,
        defaultMessage: 'Du har ikke lov til å gjøre dette',
    }
] as const satisfies {
    name: string
    httpCode: number
    defaultMessage: string
}[]

export type ErrorCode = typeof errorCodes[number]['name']

export type ErrorMessage = {
    path?: (number | string)[],
    message: string,
}

export class Smorekopp<ValidCodes extends ErrorCode | AuthStatus> extends Error {
    errorCode: ValidCodes
    errors: ErrorMessage[]

    constructor(errorCode: ValidCodes, errors?: string | ErrorMessage[]) {
        const parsedErrors = typeof errors === 'string'
            ? [{ message: errors }]
            : errors

        super(errorCode)

        this.errorCode = errorCode
        this.errors = parsedErrors ?? []
        this.name = 'ServiceError'
    }

    get httpCode() {
        return errorCodes.find((code) => code.name === this.errorCode)?.httpCode ?? 500
    }
}

//TODO: Actually start to use the serviceCausedError field.
export type ServiceErrorCode = Exclude<ErrorCode, 'UNAUTHENTICATED' | 'UNAUTHORIZED'>
export class ServiceError extends Smorekopp<ServiceErrorCode> {
    public serviceCausedError: string | undefined
    constructor(errorCode: ServiceErrorCode, errors: string | ErrorMessage[], serviceCausedError?: string) {
        super(errorCode, errors)
        this.serviceCausedError = serviceCausedError
    }
}

export class ParseError<Input> extends Smorekopp<'BAD PARAMETERS'> {
    public parseError: SafeParseError<Input>
    constructor(parseError: SafeParseError<Input>) {
        super('BAD PARAMETERS', 'Bad parameters')
        this.parseError = parseError
    }
}

export function getHttpErrorCode(errorType: ErrorCode): number {
    for (const error of errorCodes) {
        if (error.name === errorType) return error.httpCode
    }
    return 500
}
