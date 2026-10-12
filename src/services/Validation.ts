import { ServiceError } from './error'
import { z } from 'zod'
import { zfd } from 'zod-form-data'

//TODO: Delete all :(

/**
 * Type for the objects that is used to make sure the  two detailed and type schemas have the same keys
 */
type SameKeys<T, U> = {
    [K in keyof T | keyof U]: K extends keyof T & keyof U ? (T[K] | U[K]) : never;
}

/**
 * Type that zod returns after parse.
 */
type PureTsTypeOfSchema<
    T extends z.ZodRawShape,
    Partialized extends boolean = false
> = Partialized extends true ? Partial<z.infer<ReturnType<typeof z.object<T>>>> : z.infer<ReturnType<typeof z.object<T>>>

/**
 * Type for the Transformer to transfer between type and detailed types.
 */
type Tranformer<
    Type extends z.ZodRawShape,
    Detailed extends z.ZodRawShape,
    Partialized extends boolean = false
> = (data: PureTsTypeOfSchema<Type, Partialized>) => PureTsTypeOfSchema<Detailed, Partialized>

/**
 * Type for the refiner to refine the detailed schema
 */
type Refiner<
    Detailed extends z.ZodRawShape,
    Partialized extends boolean = false
> = {
    fcn: (data: PureTsTypeOfSchema<Detailed, Partialized>) => boolean
    message: string
}

/*
* A monadic type that is returned from the typeValidate method in Validation.
*/
export type SafeValidationReturn<T extends z.ZodRawShape, Partialized extends boolean> = {
    success: true, data: PureTsTypeOfSchema<T, Partialized>
} | {
    success: false, error: z.ZodError
}

/**
 * A validatiorBase is meant to create Validators that wrapps zod functionality.
 * A BaseValidatior consists of a type and a detailed schema. One is meant to check basic
 * types incoming from the client (run in action), and the other is meant to check the detailed types (run on server).
 * All keys in the one schema must be in the other schema.
 * @deprecated
 * @method createValidation creates a new validation with a subset of the keys and a tranformer
 * that should transform the type returned by parsing the type schema to the type detailed schema expects.
 * @method createValidationPartial Same as above but make all entries in type and detailed schema optional.
 */
export class ValidationBase<
    Type extends SameKeys<Type, Detailed> & z.ZodRawShape,
    Detailed extends SameKeys<Detailed, Type> & z.ZodRawShape,
> {
    private typeSchema: z.ZodObject<Type>
    private detailedSchema: z.ZodObject<Detailed>

    constructor({
        type,
        details
    }: {
        type: Type,
        details: Detailed
    }) {
        this.typeSchema = z.object(type)
        this.detailedSchema = z.object(details)
    }

    createValidation<T extends keyof Type & keyof Detailed>({
        keys,
        transformer,
        refiner,
    }: {
        keys: T[],
        transformer: Tranformer<{ [P in T]: Type[P] }, { [P in T]: Detailed[P] }>
        refiner?: Refiner<{ [P in T]: Detailed[P] }>
    }) {
        const typeSchema = pickKeys(this.typeSchema.shape, keys)
        const detailedSchema = pickKeys(this.detailedSchema.shape, keys)
        return new Validation<{ [P in T]: Type[P] }, { [P in T]: Detailed[P] }>({
            type: typeSchema,
            details: detailedSchema,
            transformer: transformer as Tranformer<{ [P in T]: Type[P] }, { [P in T]: Detailed[P] }>,
            refiner: refiner as Refiner<{ [P in T]: Detailed[P] }>,
        })
    }

    createValidationPartial<T extends keyof Type & keyof Detailed>({
        keys,
        transformer,
        refiner,
    }: {
        keys: T[],
        transformer: Tranformer<{ [P in T]: Type[P] }, { [P in T]: Detailed[P] }, true>
        refiner?: Refiner<{ [P in T]: Detailed[P] }, true>
    }) {
        const typeSchema = pickKeys(this.typeSchema.shape, keys)
        const detailedSchema = pickKeys(this.detailedSchema.shape, keys)
        return new ValidationPartial<{ [P in T]: Type[P] }, { [P in T]: Detailed[P] }>({
            type: typeSchema,
            details: detailedSchema,
            transformer: transformer as Tranformer<{ [P in T]: Type[P] }, { [P in T]: Detailed[P] }, true>,
            refiner: refiner as Refiner<{ [P in T]: Detailed[P] }, true>,
        })
    }
}

/**
 * A validation that wrapps zod functionality. It can be created fro a ValidationBase.
 * It has a type schema and a detailed schema. The type schema is meant to check basic
 * types incoming from the client (run in action), and the other is meant to check the detailed types (run on server).
 * @method typeValidate validates the type schema
 * @method detailedValidate validates the detailed schema
 * @deprecated
 */
export class Validation<
    Type extends z.ZodRawShape,
    Detailed extends z.ZodRawShape,
> {
    protected transformer: Tranformer<Type, Detailed>
    protected typeSchema: z.ZodObject<Type>
    protected detailedSchema: z.ZodObject<Detailed>
    protected refiner?: Refiner<Detailed>

    constructor({
        type,
        details,
        transformer,
        refiner,
    }: {
        type: Type,
        details: Detailed,
        transformer: Tranformer<Type, Detailed>
        refiner?: Refiner<Detailed>,
    }) {
        this.typeSchema = z.object(type)
        this.detailedSchema = z.object(details)
        this.transformer = transformer
        this.refiner = refiner
    }

    typeValidate(
        data: FormData | PureTsTypeOfSchema<Type> | unknown
    ): SafeValidationReturn<Detailed, false> {
        const parse = zfd.formData(this.typeSchema).safeParse(data)
        if (!parse.success) {
            return {
                success: false,
                error: parse.error
            }
        }
        return {
            success: true,
            data: this.transformer(parse.data)
        }
    }

    detailedValidate(data: PureTsTypeOfSchema<Detailed> | unknown) {
        const parse = this.detailedSchema.refine(
            this.refiner ? this.refiner.fcn : () => true, this.refiner ? this.refiner.message : 'Noe uforusett skjedde'
        ).safeParse(data)
        if (!parse.success) throw new ServiceError('BAD PARAMETERS', parse.error.issues)
        return parse.data
    }
}

/**
 * Same as Validation but all entries in type and detailed schema are optional.
 * @deprecated
 * @method typeValidate validates the type schema (in a partial way)
 * @method detailedValidate validates the detailed schema (in a partial way
 */
export class ValidationPartial<
    Type extends z.ZodRawShape,
    Detailed extends z.ZodRawShape,
> {
    protected transformer: Tranformer<Type, Detailed, true>
    protected typeSchema: z.ZodObject<Type>
    protected detailedSchema: z.ZodObject<Detailed>
    protected refiner?: Refiner<Detailed, true>

    constructor({
        type,
        details,
        transformer,
        refiner,
    }: {
        type: Type,
        details: Detailed,
        transformer: Tranformer<Type, Detailed, true>
        refiner?: Refiner<Detailed, true>
    }) {
        this.typeSchema = z.object(type)
        this.detailedSchema = z.object(details)
        this.transformer = transformer
        this.refiner = refiner
    }

    typeValidate(
        data: unknown | FormData | Partial<PureTsTypeOfSchema<Type, true>>
    ): SafeValidationReturn<Detailed, true> {
        const parse = zfd.formData(this.typeSchema.partial()).safeParse(data)
        if (!parse.success) {
            return {
                success: false,
                error: parse.error
            }
        }
        return {
            success: true,
            data: this.transformer(parse.data)
        }
    }

    detailedValidate(data: PureTsTypeOfSchema<Detailed, true> | unknown) {
        const parse = this.detailedSchema.partial().refine(
            this.refiner ? this.refiner.fcn : () => true, this.refiner ? this.refiner.message : 'Noe uforusett skjedde'
        ).safeParse(data)
        if (!parse.success) throw new ServiceError('BAD PARAMETERS', parse.error.issues)
        return parse.data
    }
}

function pickKeys<T, L extends(keyof T)[]>(obj: T, keys: L): { [P in L[number]]: T[P] } {
    return keys.reduce((result, key) => {
        result[key] = obj[key]
        return result
    }, {} as { [P in L[number]]: T[P] })
}

export type ValidationTypes<V> = V extends Validation<infer Type, infer Detailed>
    ? { Type: PureTsTypeOfSchema<Type>, Detailed: PureTsTypeOfSchema<Detailed> }
    : V extends ValidationPartial<infer Type, infer Detailed> ? {
        Type: PureTsTypeOfSchema<Type, true>,
        Detailed: PureTsTypeOfSchema<Detailed, true>
    } : never;

// The type of the Validation class
export type ValidationType<GeneralData, DetailedData> = {
    detailedValidate: (data: DetailedData | unknown) => DetailedData,
    typeValidate: (data: unknown | FormData | GeneralData) => TypeValidateReturn<DetailedData>,
}

// The return type of the typeValidate method in Validation
export type TypeValidateReturn<
    DetailedType
> = {
    success: true,
    data: DetailedType,
} | {
    success: false,
    error: z.ZodError,
}

// Extract the type of the detailed schema from a Validation
export type ExtractDetailedType<V extends ValidationType<unknown, unknown>> = ReturnType<V['detailedValidate']>

// Utility type for a generic Valdiation which can be extended
export type ValidationTypeUnknown = ValidationType<unknown, unknown>
