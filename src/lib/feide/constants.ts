import '@pn-server-only'

export const feideScope = 'openid email groups-edu userid userinfo-mobile userinfo-name'

/**
 * A Feide login is only linked to an existing user with the same email when the Feide user studies at
 * one of these institutions. Any other organisation on the Feide client could assert any email.
 */
export const feideRealmsLinkableByEmail = ['ntnu.no']

/**
 * A user may take their Feide email as their email without a verification mail only when it is an NTNU
 * address. Anyone on the Feide client can log in, and an email from another organisation is not one we
 * trust to belong to the user.
 */
export const feideEmailDomainsTrustedAsVerified = ['ntnu.no', 'stud.ntnu.no']
