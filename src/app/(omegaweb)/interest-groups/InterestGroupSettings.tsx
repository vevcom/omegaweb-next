'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { updateInterestGroupAction, destroyInterestGroupAction } from '@/services/groups/interestGroups/actions'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { Require } from '@/auth/authorizer/Require'

type PropTypes = {
    interestGroupId: number
    interestGroupName: string
    groupId: number
    pensioned: boolean
}

/**
 * Same gate as the CMS editors: only surfaces once edit mode is on, instead
 * of an always-visible settings icon.
 */
export default function InterestGroupSettings({
    interestGroupId,
    interestGroupName,
    groupId,
    pensioned,
}: PropTypes) {
    // A pensioned group is history: the service refuses every change to it.
    const notPensioned = Require.custom(() => !pensioned, { errorMessage: 'Gruppen er pensjonert' })
    const editableUpdate = useEditMode({
        authorizer: Require.allOf(interestGroupAuth.update.data({ groupId }), notPensioned),
    })
    const editableDestroy = useEditMode({ authorizer: Require.allOf(interestGroupAuth.destroy, notPensioned) })

    if (!editableUpdate && !editableDestroy) return null

    const popUpKey = `Update interest group ${interestGroupName}`

    return (
        <SettingsHeaderItemPopUp title="Oppdater interessegruppe" scale={40} popUpKey={popUpKey}>
            {
                editableUpdate && (
                    <>
                        <Form
                            refreshOnSuccess
                            closePopUpOnSuccess={popUpKey}
                            action={configureAction(updateInterestGroupAction, { params: { id: interestGroupId } })}
                            submitText="Endre"
                        >
                            <TextInput
                                defaultValue={interestGroupName}
                                name="name"
                                label="Navn"
                            />
                        </Form>
                    </>
                )
            }
            {
                editableDestroy && (
                    <Form
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                        action={configureAction(destroyInterestGroupAction, { params: { id: interestGroupId } })}
                        submitText="Slett"
                        submitColor="red"
                        confirmation={{
                            confirm: true,
                            text: `Er du sikker på at du vil slette ${interestGroupName}?`
                        }}
                    />
                )
            }
        </SettingsHeaderItemPopUp>
    )
}
