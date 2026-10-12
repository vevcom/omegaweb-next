import {
    BooleanQueryParam,
    EnumQueryParam,
    LocalPathQueryParam,
    NumberQueryParam,
    StringArrayQueryParam,
    StringQueryParam,
} from './QueryParam'
import type { QueryParam } from './QueryParam'
export const QueryParams = {
    eventTags: new StringArrayQueryParam('event-tags'),
    onlyActive: new BooleanQueryParam('only-active'),
    onlyAdministratedCollections: new BooleanQueryParam('only-administrated-collections'),
    userId: new NumberQueryParam('user-id'),
    companyName: new StringQueryParam('company-name'),
    token: new StringQueryParam('token'),
    callbackUrl: new LocalPathQueryParam('callbackUrl'),
    frontpageVersion: new EnumQueryParam('frontpage-version', ['logged-out', 'logged-in']),
} as const satisfies Record<string, QueryParam<string | string[] | number | number[] | boolean>>

export type QueryParamNames = typeof QueryParams[keyof typeof QueryParams]['name']
