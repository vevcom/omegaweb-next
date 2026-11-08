'use client'
import { revueLinks } from '@/app/(revue)/links'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { createRevueGroupAction } from '@/services/revue/groups/actions'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    revue: { id: number, year: number },
}

export default function CreateRevueGroup({ revue }: PropTypes) {
    const editable = useEditMode({ authorizer: revueGroupAuth.create })
    const popUpKey = `CreateRevueGroup${revue.id}`
    const createGroup = configureAction(createRevueGroupAction, { params: { revueId: revue.id } })

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                flex items-center justify-center gap-2 w-full h-full p-4 border border-dashed border-base-300
                bg-transparent text-base-content/80 cursor-pointer transition-colors
                hover:bg-base-300
            "
            showButtonContent={<>
                <FontAwesomeIcon icon={faPlus} />
                Legg til undergruppe
            </>}
        >
            <Form
                title="Ny undergruppe"
                action={createGroup}
                submitText="Legg til"
                closePopUpOnSuccess={popUpKey}
                navigateOnSuccess={group => (group ? revueLinks.revueGroup(revue, group) : null)}
            >
                <TextInput name="name" label="Navn" />
            </Form>
        </PopUp>
    )
}
