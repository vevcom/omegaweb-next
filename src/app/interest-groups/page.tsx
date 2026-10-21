import CreateInterestGroupForm from './CreateInterestGroupForm'
import InterestGroup from './InterestGroup'
import SpecialCmsParagraph from '@/cms/CmsParagraph/SpecialCmsParagraph'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import {
    readSpecialCmsParagraphGeneralInfoAction,
    updateSpecialCmsParagraphContentGeneralInfoAction
} from '@/services/groups/interestGroups/actions'
import { interestGroupOperations } from '@/services/groups/interestGroups/operations'
import { serverPage } from '@/app/ServerPage'
import { Require } from '@/auth/authorizer/Require'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import type { ExpandedInterestGroup } from '@/services/groups/interestGroups/types'

/**
 * What may be done with one interest group. A pensioned group is history: nothing about it may be
 * changed, so none of that is offered for one - except to whoever may pension it, who still gets
 * the link to its page, as bringing it back is reached from there. Administering a group is for
 * its own admins too, not just holders of the interest group permission.
 */
const interestGroupAuthorizers = (interestGroup: ExpandedInterestGroup) => {
    const groupId = interestGroup.groupId
    const notPensioned = Require.custom(() => !interestGroup.group.pensioned, { errorMessage: 'Gruppen er pensjonert' })
    return {
        canEditArticleSection: Require.allOf(interestGroupAuth.updateArticleSection.data({ groupId }), notPensioned),
        canAdministrate: Require.anyOf(
            Require.allOf(notPensioned, Require.anyOf(
                interestGroupAuth.addMembers,
                interestGroupAuth.removeMembers,
                interestGroupAuth.setMemberAdmin,
                interestGroupAuth.setMemberTitle,
                interestGroupAuth.migrateGroup,
            ).data({ groupId })),
            interestGroupAuth.pension,
        ),
    }
}

const { page, generateMetadata } = serverPage({
    operation: async () => interestGroupOperations.readMany({}),
    capabilities: () => ({
        canCreate: interestGroupAuth.create,
        canEditGeneralInfo: interestGroupAuth.updateSpecialCmsParagraphContentGeneralInfo,
    }),
    metadata: () => ({ title: 'Interessegrupper' }),
    render: ({ data: interestGroups, capabilities, session }) => (
        <PageWrapper transparent>
            <div>
                <div className="bg-surface-base rounded-round p-4">
                    {capabilities.canCreate.authorized && (
                        <AddHeaderItemPopUp popUpKey="Create interest group">
                            <CreateInterestGroupForm/>
                        </AddHeaderItemPopUp>
                    )}
                    <SpecialCmsParagraph
                        capabilities={{ canEdit: capabilities.canEditGeneralInfo }}
                        special="INTEREST_GROUP_GENERAL_INFO"
                        readSpecialCmsParagraphAction={readSpecialCmsParagraphGeneralInfoAction}
                        updateCmsParagraphAction={updateSpecialCmsParagraphContentGeneralInfoAction}
                    />
                </div>
                <main className="flex flex-col gap-2 mt-2">
                    {
                        // Pensioned groups are part of the history rather than something to join, so
                        // they are listed after the ones that still run.
                        [...interestGroups]
                            .sort((one, two) => Number(one.group.pensioned) - Number(two.group.pensioned))
                            .map(interestGroup => (
                                <InterestGroup
                                    key={interestGroup.id}
                                    interestGroup={interestGroup}
                                    capabilities={runCapabilities(session, interestGroupAuthorizers(interestGroup))}
                                />
                            ))
                    }
                </main>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
