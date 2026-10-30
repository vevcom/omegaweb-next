'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import {
    destroyCareersTeamDepartmentAction,
    moveCareersTeamDepartmentAction,
    updateCareersTeamDepartmentAction,
} from '@/services/careers/team/actions'
import { careersTeamAuth } from '@/services/careers/team/auth'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPencil } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    department: { id: number, name: string, personCount: number }
    canMoveUp: boolean
    canMoveDown: boolean
}

const controlClassName = `
    grid place-items-center size-8 rounded-full border-none bg-surface-hover text-text cursor-pointer transition-colors
    hover:bg-surface-subtle
    disabled:opacity-30 disabled:cursor-default
`

export default function TeamDepartmentEditor({ department, canMoveUp, canMoveDown }: PropTypes) {
    const editable = useEditMode({ authorizer: careersTeamAuth.updateDepartment })
    const { refresh } = useRouter()
    const popUpKey = `EditCareersTeamDepartment${department.id}`
    const params = { params: { departmentId: department.id } }

    const move = async (direction: 'UP' | 'DOWN') => {
        await moveCareersTeamDepartmentAction(params, { data: { direction } })
        refresh()
    }

    if (!editable) return null
    return (
        <div className="flex items-center gap-2 mt-4">
            <button
                className={controlClassName}
                disabled={!canMoveUp}
                onClick={() => move('UP')}
                aria-label="Flytt avdelingen opp"
            >
                <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button
                className={controlClassName}
                disabled={!canMoveDown}
                onClick={() => move('DOWN')}
                aria-label="Flytt avdelingen ned"
            >
                <FontAwesomeIcon icon={faArrowDown} />
            </button>
            <PopUp
                popUpKey={popUpKey}
                showButtonClass={controlClassName}
                showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                ariaLabel={`Rediger ${department.name}`}
            >
                <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                    <Form
                        title="Rediger avdeling"
                        action={updateCareersTeamDepartmentAction.bind(null, params)}
                        submitText="Lagre"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <TextInput name="name" label="Navn" defaultValue={department.name} />
                    </Form>
                    <Form
                        action={destroyCareersTeamDepartmentAction.bind(null, params)}
                        submitText="Slett avdeling"
                        submitColor="red"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                        confirmation={{
                            confirm: true,
                            text: department.personCount > 0
                                ? `Dette sletter ${department.name} og de ${department.personCount} personene i den.`
                                : `Vil du slette ${department.name}?`,
                        }}
                    />
                </div>
            </PopUp>
        </div>
    )
}
