import { Require } from '@/auth/authorizer/Require'

const isActiveMemberOf = (memberships: { groupId: number, active: boolean }[], groupId: number) =>
    memberships.some(membership => membership.groupId === groupId && membership.active)

const ownsAlias = { key: 'aliasVisibility', errorMessage: 'Du kan bare koble til et alias du eier' } as const
const ownsList = { key: 'listVisibility', errorMessage: 'Du kan bare koble til en e-postliste du eier' } as const

/**
 * A connection needs authority over both of its ends, and cutting one needs authority over either.
 * Over an alias or a list that is passing its owner visibility, over a group being its admin, over a
 * user being them. MAILSERVER_ADMIN has authority over everything, external addresses included.
 */
export const mailAuth = {
    createAliasMailingListRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility(ownsAlias)
        .visibility(ownsList),
    createMailingListExternalRelation: Require.permission('MAILSERVER_ADMIN').or().visibility(ownsList),
    createMailingListUserRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility(ownsList)
        .userId({ errorMessage: 'Du kan bare sette deg selv på listen' }),
    createMailingListGroupRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility(ownsList)
        .groupAdmin({ errorMessage: 'Du kan bare sette på en gruppe du er gruppeleder for' }),
    destroyAliasMailingListRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility({ key: 'aliasVisibility' })
        .or()
        .visibility({ key: 'listVisibility', errorMessage: 'Bare eierne av aliaset eller listen kan koble dem fra' }),
    destroyMailingListExternalRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility({ key: 'listVisibility', errorMessage: 'Bare eierne av listen kan ta adressen av den' }),
    destroyMailingListUserRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility({ key: 'listVisibility' })
        .or()
        .userId({ errorMessage: 'Bare eierne av listen og brukeren selv kan ta brukeren av den' }),
    destroyMailingListGroupRelation: Require.permission('MAILSERVER_ADMIN')
        .or()
        .visibility({ key: 'listVisibility' })
        .or()
        .groupAdmin({ errorMessage: 'Bare eierne av listen og gruppens ledere kan ta gruppen av den' }),
    readGroupTraversal: Require.permission('MAILSERVER_USE').or().custom<{ groupId: number }>(
        ({ session, groupId }) => isActiveMemberOf(session.memberships, groupId),
        { errorMessage: 'Bare medlemmer av gruppen ser hvor e-posten dens kommer fra' },
    ),
    readUserTraversal: Require.permission('MAILSERVER_USE').or().userId({
        errorMessage: 'Bare brukeren selv ser hvor e-posten deres kommer fra',
    }),
    readMailOptions: Require.permission('MAILSERVER_USE').or().user(),
} as const
