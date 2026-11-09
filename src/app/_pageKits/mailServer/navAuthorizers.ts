import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { readAliasOwnerMatrices, readMailingListOwnerMatrices } from '@/services/mail/owned'
import type { NavAuthorizer, NavAuthorizerContext } from '@/lib/navDef/navDef'

/**
 * What an admin nav offers the mail server pages on: the rules of listing the parts, so whoever may
 * list anything in the mail server, by permission or by owning an alias or a list, finds it.
 */
export async function mailServerNavAuthorizers({ prisma }: NavAuthorizerContext): Promise<NavAuthorizer[]> {
    const [aliasOwnerVisibilities, mailingListOwnerVisibilities] = await Promise.all([
        readAliasOwnerMatrices({ prisma }),
        readMailingListOwnerMatrices({ prisma }),
    ])
    return [
        mailAliasAuth.readMany.data({ aliasOwnerVisibilities }),
        mailingListAuth.readMany.data({ mailingListOwnerVisibilities }),
        mailAddressExternalAuth.readMany.data({ mailingListOwnerVisibilities }),
    ]
}
