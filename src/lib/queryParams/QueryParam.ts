import type { SearchParamsServerSide } from './types'

export abstract class QueryParam<Type> {
    public name: string

    constructor(name: string) {
        this.name = name
    }

    abstract encode(value: Type): string
    public encodeUrl(value: Type): string {
        return `${this.name}=${encodeURIComponent(this.encode(value))}`
    }
    abstract decodeValue(value: string | string[] | undefined): Type | null
    public decode(searchParams: Awaited<SearchParamsServerSide['searchParams']>): Type | null {
        if (!searchParams) {
            return null
        }
        if (!searchParams[this.name]) {
            return null
        }
        return this.decodeValue(searchParams[this.name])
    }
}

export class StringQueryParam extends QueryParam<string> {
    encode(value: string): string {
        return value
    }

    decodeValue(value: string | string[] | undefined): string | null {
        if (typeof value === 'string') {
            return value
        }

        return null
    }
}

/**
 * A path on this site to send the user on to, like a callbackUrl. Anything else decodes to null -
 * a full URL, a protocol-relative one (`//evil.example`) or one a browser would read as such - so
 * a link cannot be crafted to make the site redirect its visitor somewhere else.
 */
export class LocalPathQueryParam extends StringQueryParam {
    decodeValue(value: string | string[] | undefined): string | null {
        const path = super.decodeValue(value)
        if (path === null || !path.startsWith('/')) return null

        // Resolved against a stand-in origin the way a browser would resolve it, which also reads
        // `/\` and `/<tab>/` as `//`. A path that stays on the site keeps that origin.
        const origin = 'http://local.invalid'
        try {
            return new URL(path, origin).origin === origin ? path : null
        } catch {
            return null
        }
    }
}

export class StringArrayQueryParam extends QueryParam<string[]> {
    encode(value: string[]): string {
        return value.join(',')
    }

    decodeValue(value: string | string[] | undefined): string[] | null {
        if (Array.isArray(value)) {
            return value
        }
        if (typeof value === 'string') {
            return value.split(',')
        }
        return null
    }
}

export class BooleanQueryParam extends QueryParam<boolean> {
    encode(value: boolean): string {
        return value ? 'true' : 'false'
    }

    decodeValue(value: string | string[] | undefined): boolean | null {
        if (typeof value === 'string') {
            return value === 'true'
        }
        return null
    }
}

export class NumberQueryParam extends QueryParam<number> {
    encode(value: number): string {
        return value.toString()
    }

    decodeValue(value: string | string[] | undefined): number | null {
        if (typeof value === 'string') {
            return parseInt(value, 10)
        }
        return null
    }
}

export class EnumQueryParam<const T extends string> extends QueryParam<T> {
    private enumValues: T[]

    constructor(name: string, enumValues: T[]) {
        super(name)
        this.enumValues = enumValues
    }

    encode(value: T): string {
        if (!this.enumValues.includes(value)) {
            throw new Error(`Value ${value} is not a valid enum value for ${this.name}`)
        }
        return value
    }

    decodeValue(value: string | string[] | undefined): T | null {
        if (typeof value === 'string' && this.enumValues.includes(value as T)) {
            return value as T
        }
        return null
    }
}
