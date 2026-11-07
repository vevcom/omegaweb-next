'use client'
import { revueLinks } from '@/app/(revue)/links'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { createRevueAction } from '@/services/revue/actions'
import { revueAuth } from '@/services/revue/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

const popUpKey = 'CreateRevue'

export default function CreateRevue() {
    const editable = useEditMode({ authorizer: revueAuth.create })

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                flex items-center justify-center gap-2 w-full p-4 mt-4 border border-dashed border-surface-subtle
                bg-transparent text-text-muted cursor-pointer transition-colors
                hover:bg-surface-hover
            "
            showButtonContent={<>
                <FontAwesomeIcon icon={faPlus} />
                Legg til revy
            </>}
        >
            <Form
                title="Ny revy"
                action={createRevueAction}
                submitText="Legg til"
                closePopUpOnSuccess={popUpKey}
                navigateOnSuccess={revue => (revue ? revueLinks.revue(revue) : null)}
            >
                <NumberInput name="year" label="År" defaultValue={new Date().getUTCFullYear()} />
                <TextInput name="name" label="Navn" />
            </Form>
        </PopUp>
    )
}
