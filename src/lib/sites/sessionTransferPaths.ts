import { QueryParams } from '@/lib/queryParams/queryParams'

/**
 * The hops that carry a login from one domain to another, see src/app/api/sso. Each is a top-level
 * navigation, since a domain only reads and sets its own cookies.
 */
export const sessionTransferPaths = {
    /** After a login on this domain: hands it to the hub, then goes on to the app path. */
    share: (callbackUrl: string) => `/api/sso/share?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`,
    /** On the domain that wants a login: asks `from` for its. */
    receive: (from: string, callbackUrl: string) => `/api/sso/receive?${new URLSearchParams({ from, callbackUrl })}`,
    /** On the domain that has a login: hands it to `to`. */
    give: (to: string, state: string, callbackUrl: string) =>
        `/api/sso/give?${new URLSearchParams({ to, state, callbackUrl })}`,
}
