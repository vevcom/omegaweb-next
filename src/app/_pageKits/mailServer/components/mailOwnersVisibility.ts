'use client'
import { implementVisibilityComponents } from '@/components/Visibility/VisibilityComponents'
import { configureAction } from '@/services/configureAction'
import { updateMailAliasVisibilityAction } from '@/services/mail/alias/actions'
import { updateMailingListVisibilityAction } from '@/services/mail/list/actions'

const verb = 'ser og kobler dette'
const pickedGroupStartsAs = 'ACTIVE'

/** A new alias or mailing list may be left without owners, which leaves it to the mail server admins. */
export const newMailOwners = implementVisibilityComponents({
    verb,
    everyone: 'Bare e-posttjeneradministratorene',
    pickedGroupStartsAs,
})

// The owners of one that exists are not emptied, so these offer no one in their place.
export const mailAliasOwners = implementVisibilityComponents<{ id: number }>({
    verb,
    pickedGroupStartsAs,
    update: implementationParams => configureAction(updateMailAliasVisibilityAction, { implementationParams }),
})

export const mailingListOwners = implementVisibilityComponents<{ id: number }>({
    verb,
    pickedGroupStartsAs,
    update: implementationParams => configureAction(updateMailingListVisibilityAction, { implementationParams }),
})
