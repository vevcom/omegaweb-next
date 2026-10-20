import '@pn-server-only'
import { z } from 'zod'

/**
 * The attributes returned by the extended user info endpoint.
 * All possible attributes are documented [here](https://docs.feide.no/reference/schema/attributes/index.html).
 * Only a small subset of these will be available based on the scopes of the access token.
 * Only the attributes we use should be listed in the schema; the rest are kept as `unknown`.
 */
const extendedUserInfoSchema = z.object({
    cn: z.array(z.string()).optional(), // Common name
    displayName: z.string().optional(),
    eduPersonAffiliation: z.array(z.string()).optional(),
    eduPersonPrimaryAffiliation: z.string().optional(),
    eduPersonScopedAffiliation: z.array(z.string()).optional(),
    givenName: z.array(z.string()).optional(), // Aka firstname
    mail: z.array(z.string()).optional(),
    norEduPersonLegalName: z.string().optional(),
    schacHomeOrganization: z.string().optional(),
    sn: z.array(z.string()).optional(), // Surname
}).passthrough()

type ExtendedUserInfo = z.infer<typeof extendedUserInfoSchema>

/**
 * Retrives extended user info from Feide API.
 *
 * @param accessToken - The access token of a Feide account.
 * @returns Extended user info object.
 */
export async function fetchExtendedUserInfoFromFeide(accessToken: string): Promise<ExtendedUserInfo> {
    const extendedUserInfoRequest = await fetch('https://api.dataporten.no/userinfo/v1/userinfo', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        }
    })

    if (!extendedUserInfoRequest.ok) {
        throw new Error(`Could not fetch extended user info from feide. Status: ${extendedUserInfoRequest.status}`)
    }

    const result = extendedUserInfoSchema.safeParse(await extendedUserInfoRequest.json())

    if (!result.success) {
        throw new Error(`Feide returned malformed extended user info: ${result.error.message}`)
    }

    return result.data
}

/**
 * A group as returned by the Feide groups API. Only the attributes we use are listed; the rest are
 * kept as `unknown`.
 */
const feideGroupsSchema = z.array(z.object({
    id: z.string(),
    displayName: z.string(),
    type: z.string().optional(),
    parent: z.string().optional(),
    membership: z.record(z.string(), z.unknown()).optional(),
}).passthrough())

type FeideGroup = z.infer<typeof feideGroupsSchema>[number]

/**
 * Retrives groups of a user from Feide API.
 *
 * @param accessToken - The access token of a Feide account.
 * @returns An array of groups.
 */
export async function fetchGroupsFromFeide(accessToken: string): Promise<FeideGroup[]> {
    const groupsRequest = await fetch('https://groups-api.dataporten.no/groups/me/groups', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        }
    })

    if (!groupsRequest.ok) {
        throw new Error(`Could not fetch groups from feide. Status: ${groupsRequest.status}`)
    }

    const result = feideGroupsSchema.safeParse(await groupsRequest.json())

    if (!result.success) {
        throw new Error(`Feide returned malformed groups: ${result.error.message}`)
    }

    return result.data
}

/**
 * The realms (institutions, e.g. `ntnu.no`) of the study programmes the user is in. Study programme
 * groups come from the student system of the user's own institution, so another institution cannot
 * put its users in them.
 *
 * @param accessToken - The access token of a Feide account.
 */
export async function fetchStudyProgrammeRealmsFromFeide(accessToken: string): Promise<string[]> {
    const realms = (await fetchGroupsFromFeide(accessToken))
        .filter(({ type }) => type === 'fc:fs:prg')
        .map(({ id }) => id.split(':')[4])
    return realms.filter((realm, index) => realms.indexOf(realm) === index)
}

/**
 * A wrapper for `fetchGroupsFromFeide` witch returns an array of studyprogrammes
 * that the user is currently part of.
 *
 * @param accessToken - The access token of a Feide account.
 */
export async function fetchStudyProgrammesFromFeide(accessToken: string): Promise<{ code: string, name: string}[]> {
    return (await fetchGroupsFromFeide(accessToken))
        // Filter out groups which are not study programmes (for example courses) and
        // also not part of ntnu.
        .filter(({ type, id }) => type === 'fc:fs:prg' && id.split(':')[4] === 'ntnu.no')
        // Map each study programme to an easily readable form
        .map(({ id, displayName }) => ({
            code: id.split(':')[5],
            name: displayName,
        }))
}
