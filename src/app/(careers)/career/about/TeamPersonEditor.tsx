'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import FileInput from '@/components/UI/FileInput'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import {
    destroyCareersTeamPersonAction,
    moveCareersTeamPersonAction,
    updateCareersTeamPersonAction,
    updateCareersTeamPersonImageAction,
} from '@/services/careers/team/persons/actions'
import { careersTeamPersonAuth } from '@/services/careers/team/persons/auth'
import useSiteRouter from '@/hooks/useSiteRouter'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faPencil } from '@fortawesome/free-solid-svg-icons'
import type { ExpandedCareerTeamPerson } from '@/services/careers/team/persons/types'

type PropTypes = {
    person: ExpandedCareerTeamPerson
    canMoveBack: boolean
    canMoveForward: boolean
}

const controlClassName = `
    grid place-items-center size-8 rounded-full border-none bg-surface-hover text-text cursor-pointer transition-colors
    hover:bg-surface-subtle
    disabled:opacity-30 disabled:cursor-default
`

export default function TeamPersonEditor({ person, canMoveBack, canMoveForward }: PropTypes) {
    const editable = useEditMode({ authorizer: careersTeamPersonAuth.update })
    const { refresh } = useSiteRouter()
    const popUpKey = `EditCareersTeamPerson${person.id}`
    const params = { params: { personId: person.id } }

    const move = async (direction: 'UP' | 'DOWN') => {
        await moveCareersTeamPersonAction(params, { data: { direction } })
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
                ariaLabel={`Rediger ${person.name}`}
            >
                <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                    <Form
                        title="Rediger person"
                        action={configureAction(updateCareersTeamPersonAction, params)}
                        submitText="Lagre"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <TextInput name="name" label="Navn" defaultValue={person.name} />
                        <TextInput name="title" label="Tittel" defaultValue={person.title} />
                        <TextInput name="email" label="E-post" defaultValue={person.email ?? ''} />
                    </Form>
                    <Form
                        title="Bilde"
                        action={configureAction(updateCareersTeamPersonImageAction, params)}
                        submitText="Last opp bilde"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <FileInput name="imageFile" label="Portrett" color="primary" />
                    </Form>
                    <Form
                        action={configureAction(destroyCareersTeamPersonAction, params)}
                        submitText="Fjern person"
                        submitColor="red"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                        confirmation={{
                            confirm: true,
                            text: `Vil du fjerne ${person.name}?`,
                        }}
                    />
                </div>
            </PopUp>
        </div>
    )
}
