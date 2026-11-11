import { SSO_START_PATH } from './constants'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { appHref } from '@/lib/sites/href'
import type { AppHref } from '@/lib/sites/href'

/**
 * Where a site sends a visitor to sign in: the start route, which takes them to the auth domain
 * and back with a session for the domain they are on, landing on `callbackUrl`. App-wide, so it
 * runs on whichever domain the visitor is on, which is the domain that needs the session.
 */
export function ssoStartHref(callbackUrl: AppHref): AppHref {
    return appHref(`${SSO_START_PATH}?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`)
}
