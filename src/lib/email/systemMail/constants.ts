

export const emailValidationExpiration = 8 * 60 * 60

export const userInvitationExpiration = 3 * 24 * 60 * 60

/** How long a password reset link is valid, in seconds. */
export const resetPasswordExpiration = 60 * 60

/**
 * How long the link a company user chooses a password by is valid, in seconds. Longer than a
 * user's reset link, since it is also the invitation: it is sent by someone else and read later.
 */
export const companyUserPasswordExpiration = 3 * 24 * 60 * 60
