import '@pn-server-only'

export const feideScope = 'openid email groups-edu userid userinfo-mobile userinfo-name'

/**
 * A Feide login is only linked to an existing user with the same email when the Feide user studies at
 * one of these institutions. Any other organisation on the Feide client could assert any email.
 */
export const feideRealmsLinkableByEmail = ['ntnu.no']
