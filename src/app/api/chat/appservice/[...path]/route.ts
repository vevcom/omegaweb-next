import { apiHandler } from '@/api/apiHandler'
import { chatAppserviceOperations } from '@/services/chat/appservice/operations'
import { Session } from '@/auth/session/Session'
import type { ApiError } from '@/api/apiHandler'

type RouteContext = { params: Promise<{ path: string[] }> }

const matrixError = (status: number, errcode: string, error: string) => Response.json({ errcode, error }, { status })

/** The homeserver sends the same again until it is answered 200, so only a wrong token is its fault. */
function matrixErrorResponse({ errorCode, errors }: ApiError): Response {
    const error = errors.map(({ message }) => message).join('. ')
    const isWrongToken = errorCode === 'UNAUTHENTICATED' || errorCode === 'UNAUTHORIZED'
    return isWrongToken ? matrixError(403, 'M_FORBIDDEN', error) : matrixError(500, 'M_UNKNOWN', error)
}

const receiveTransaction = apiHandler({
    serviceOperation: chatAppserviceOperations.receiveTransaction,
    session: () => Promise.resolve(Session.empty()),
    params: (routeParams: unknown, request) => ({
        homeserverToken: request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null,
    }),
    respond: () => Response.json({}),
    respondError: matrixErrorResponse,
})

/**
 * The application service api of Matrix, as far as the app answers it: transactions. The
 * homeserver asks under `_matrix/app/v1`, and without it when that is not found.
 */
export async function PUT(request: Request, context: RouteContext): Promise<Response> {
    const { path } = await context.params
    const isTransaction = path.at(-2) === 'transactions'
    return isTransaction ? receiveTransaction(request) : matrixError(404, 'M_UNRECOGNIZED', 'Unrecognized request')
}

/** The app makes no user and no room when the homeserver asks for one it lacks. */
export const GET = () => matrixError(404, 'M_NOT_FOUND', 'Not found')
