'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { createCareersTeamPersonAction } from '@/services/careers/team/actions'
import { careersTeamAuth } from '@/services/careers/team/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

export default function AddTeamPerson({ departmentId }: { departmentId: number }) {
    const editable = useEditMode({ authorizer: careersTeamAuth.createPerson })
    const popUpKey = `AddCareersTeamPerson${departmentId}`

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                flex flex-col items-center justify-center gap-2 aspect-4/5 w-full border border-dashed
                border-surface-subtle bg-transparent text-text-muted cursor-pointer transition-colors
                hover:bg-surface-hover
            "
            showButtonContent={<>
                <FontAwesomeIcon icon={faPlus} />
                Legg til person
            </>}
        >
            <Form
                title="Ny person"
                action={createCareersTeamPersonAction.bind(
                    null,
                    { implementationParams: { departmentId } },
                    { params: undefined },
                )}
                submitText="Legg til"
                refreshOnSuccess
                closePopUpOnSuccess={popUpKey}
            >
                <TextInput name="name" label="Navn" />
                <TextInput name="title" label="Tittel" />
                <TextInput name="email" label="E-post (valgfri)" />
            </Form>
        </PopUp>
    )
}
