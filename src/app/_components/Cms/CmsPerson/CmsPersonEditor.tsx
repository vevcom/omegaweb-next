'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faPencil } from '@fortawesome/free-solid-svg-icons'
import type {
    DestroyCmsPersonAction,
    ExpandedCmsPerson,
    MoveCmsPersonAction,
    UpdateCmsPersonAction,
} from '@/cms/persons/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    cmsPerson: ExpandedCmsPerson
    canMoveBack: boolean
    canMoveForward: boolean
    updateCmsPersonAction: UpdateCmsPersonAction
    moveCmsPersonAction: MoveCmsPersonAction
    destroyCmsPersonAction: DestroyCmsPersonAction
    capabilities: CapabilitiesJsObject<'canEdit'>
}

const controlClassName = `
    grid place-items-center size-8 rounded-full border-none bg-surface-hover text-text cursor-pointer transition-colors
    hover:bg-surface-subtle
    disabled:opacity-30 disabled:cursor-default
`

export default function CmsPersonEditor({
    cmsPerson,
    canMoveBack,
    canMoveForward,
    updateCmsPersonAction,
    moveCmsPersonAction,
    destroyCmsPersonAction,
    capabilities,
}: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const { refresh } = useRouter()
    const popUpKey = `EditCmsPerson${cmsPerson.id}`
    const params = { params: { cmsPersonId: cmsPerson.id } }

    const move = async (direction: 'UP' | 'DOWN') => {
        await moveCmsPersonAction(params, { data: { direction } })
        refresh()
    }

    if (!editable) return null
    return (
        <div className="flex items-center gap-2 mt-3">
            <button
                className={controlClassName}
                disabled={!canMoveBack}
                onClick={() => move('UP')}
                aria-label="Flytt bakover"
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <button
                className={controlClassName}
                disabled={!canMoveForward}
                onClick={() => move('DOWN')}
                aria-label="Flytt fremover"
            >
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <PopUp
                popUpKey={popUpKey}
                showButtonClass={controlClassName}
                showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                ariaLabel={`Rediger ${cmsPerson.name}`}
            >
                <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                    <Form
                        title="Rediger person"
                        action={configureAction(updateCmsPersonAction, params)}
                        submitText="Lagre"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <TextInput name="name" label="Navn" defaultValue={cmsPerson.name} />
                        <TextInput name="title" label="Tittel" defaultValue={cmsPerson.title} />
                        <TextInput name="email" label="E-post" defaultValue={cmsPerson.email ?? ''} />
                    </Form>
                    <Form
                        action={configureAction(destroyCmsPersonAction, params)}
                        submitText="Fjern person"
                        submitColor="red"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                        confirmation={{
                            confirm: true,
                            text: `Vil du fjerne ${cmsPerson.name}?`,
                        }}
                    />
                </div>
            </PopUp>
        </div>
    )
}
