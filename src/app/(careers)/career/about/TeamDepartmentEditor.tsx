'use client'
import Form from '@/components/Form/Form'
import Button from '@/components/UI/Button'
import { buttonClassName } from '@/components/UI/buttonClassName'
import PopUp from '@/components/PopUp/PopUp'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { careersTeamCapabilities } from '@/capabilities/careers/team/capabilities'
import useSiteRouter from '@/hooks/useSiteRouter'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPencil } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    department: { id: number, name: string, personCount: number }
    canMoveUp: boolean
    canMoveDown: boolean
}

const controlClassName = 'bg-base-300! rounded-full!'

export default function TeamDepartmentEditor({ department, canMoveUp, canMoveDown }: PropTypes) {
    const editable = useEditMode({ authorizer: careersTeamCapabilities.updateDepartment.authorizer })
    const { refresh } = useSiteRouter()
    const popUpKey = `EditCareersTeamDepartment${department.id}`
    const params = { params: { departmentId: department.id } }

    const move = async (direction: 'UP' | 'DOWN') => {
        await careersTeamCapabilities.moveDepartment.action(params, { data: { direction } })
        refresh()
    }

    if (!editable) return null
    return (
        <div className="flex items-center gap-2 mt-4">
            <Button
                variant="icon"
                color="neutral"
                className={controlClassName}
                disabled={!canMoveUp}
                onClick={() => move('UP')}
                aria-label="Flytt avdelingen opp"
            >
                <FontAwesomeIcon icon={faArrowUp} />
            </Button>
            <Button
                variant="icon"
                color="neutral"
                className={controlClassName}
                disabled={!canMoveDown}
                onClick={() => move('DOWN')}
                aria-label="Flytt avdelingen ned"
            >
                <FontAwesomeIcon icon={faArrowDown} />
            </Button>
            <PopUp
                popUpKey={popUpKey}
                showButtonClass={buttonClassName({ variant: 'icon', color: 'neutral', className: controlClassName })}
                showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                ariaLabel={`Rediger ${department.name}`}
            >
                <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                    <Form
                        title="Rediger avdeling"
                        action={configureAction(careersTeamCapabilities.updateDepartment.action, params)}
                        submitText="Lagre"
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    >
                        <TextInput name="name" label="Navn" defaultValue={department.name} />
                    </Form>
                    <Form
                        action={configureAction(careersTeamCapabilities.destroyDepartment.action, params)}
                        submitText="Slett avdeling"
                        submitColor="error"
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
