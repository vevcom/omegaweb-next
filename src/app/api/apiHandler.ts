import '@pn-server-only'
import { getHttpErrorCode, ParseError, ServiceError, Smorekopp } from '@/services/error'
import { ServerSession } from '@/auth/session/ServerSession'
import logger from '@/lib/logger'
import type { ServiceOperation } from '@/services/serviceOperation'
import type { ErrorCode, ErrorMessage } from '@/services/error'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Awaitable } from '@/lib/awaitable'
import type { z } from 'zod'

/** A failure as a route answers it: the code and the messages, which a route shapes as its protocol has it. */
export type ApiError = {
    errorCode: ErrorCode,
    errors: ErrorMessage[],
}

type Input<ParamsSchema extends z.ZodTypeAny | undefined> = Awaitable<z.input<NonNullable<ParamsSchema>>>

type APIHandler<
    RawParams,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
> = {
    serviceOperation: ServiceOperation<boolean, Return, ParamsSchema, DataSchema>,
    /** How the body is read for the operation's data: as JSON unless given, or as a form. */
    body?: 'json' | 'form',
    /** The operation's data from the body as read, which is the data itself unless given. */
    data?: (body: unknown, request: Request) => unknown,
    /** The session the operation runs as: the one the Authorization header's API key gives unless given. */
    session?: (request: Request) => Promise<SessionMaybeUser>,
    /** The response to a result: the result as JSON unless given. */
    respond?: (result: Return, request: Request) => Response,
    /** The response to a failure: the code and the messages as JSON, with the code's status, unless given. */
    respondError?: (error: ApiError, request: Request) => Response,
} & (ParamsSchema extends undefined ? {
    params?: undefined,
    query?: undefined,
} : {
    /** The operation's params from the route's, such as `[username]`. */
    params: (rawParams: RawParams, request: Request) => Input<ParamsSchema>,
    query?: undefined,
} | {
    params?: undefined,
    /** The operation's params from the query string. */
    query: (searchParams: URLSearchParams, request: Request) => Input<ParamsSchema>,
})

type RouteContext<RawParams> = { params: Promise<RawParams> }

const passThrough = (body: unknown) => body

const sessionFromApiKey = (request: Request) => ServerSession.fromApiKey(request.headers.get('authorization'))

/**
 * A route handler that is a service operation: the request is turned into the operation's params,
 * data and session, and the result or the failure into the response. The defaults are the JSON
 * API's; a protocol with a shape of its own, such as OAuth, gives the hooks it needs.
 */
export function apiHandler<
    RawParams,
    Return,
    ParamsSchema extends z.ZodTypeAny | undefined = undefined,
    DataSchema extends z.ZodTypeAny | undefined = undefined,
>({
    serviceOperation,
    params,
    query,
    body = 'json',
    data = passThrough,
    session = sessionFromApiKey,
    respond = respondJson,
    respondError = respondErrorJson,
}: APIHandler<RawParams, Return, ParamsSchema, DataSchema>) {
    return async (request: Request, context?: RouteContext<RawParams>): Promise<Response> => {
        try {
            const currentSession = await session(request)
            const rawBody = serviceOperation.dataSchema ? await readBody(request, body) : undefined
            let parsedParams: unknown
            if (query) {
                parsedParams = await query(new URL(request.url).searchParams, request)
            } else if (params) {
                parsedParams = await params(await (context?.params ?? Promise.resolve(undefined as RawParams)), request)
            }
            const result = await serviceOperation<'UNSAFE'>({
                params: parsedParams,
                data: rawBody === undefined ? undefined : data(rawBody, request),
                session: currentSession,
            })
            return respond(result, request)
        } catch (error: unknown) {
            return respondError(apiErrorOf(error), request)
        }
    }
}

/** The body as the operation's data is read from it. A body that is not what it should be is BAD DATA. */
async function readBody(request: Request, body: 'json' | 'form'): Promise<unknown> {
    try {
        return body === 'form' ? await request.formData() : await request.json()
    } catch (error) {
        if (error instanceof SyntaxError || error instanceof TypeError) {
            throw new ServiceError('BAD DATA', body === 'form'
                ? 'The body is application/x-www-form-urlencoded'
                : 'The API only accepts valid json data.')
        }
        throw error
    }
}

/** What a failure says. Anything but a service error is a bug or a failing dependency, whose message is for the log only. */
function apiErrorOf(error: unknown): ApiError {
    // The body is the only input the client writes, so it gets each field's issue.
    if (error instanceof ParseError) {
        return {
            errorCode: 'BAD DATA',
            errors: error.parseError.error.issues.map(issue => ({ path: issue.path, message: issue.message })),
        }
    }
    if (error instanceof Smorekopp) return { errorCode: error.errorCode, errors: error.errors }
    logger.error('API request failed with an unexpected error:', error)
    return { errorCode: 'UNKNOWN ERROR', errors: [{ message: 'Noe uventet skjedde' }] }
}

function respondErrorJson({ errorCode, errors }: ApiError): Response {
    return new Response(JSON.stringify({ errorCode, errors }), { status: getHttpErrorCode(errorCode) })
}

function respondJson<Return>(result: Return): Response {
    // Response.json encodes it - an operation returning nothing answers null.
    return Response.json(result ?? null, { status: 200 })
}
