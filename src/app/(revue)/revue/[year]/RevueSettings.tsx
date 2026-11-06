'use client'
import { revueLinks } from '@/app/(revue)/links'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { destroyRevueAction, updateRevueAction } from '@/services/revue/actions'
import { revueAuth } from '@/services/revue/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    revue: { id: number, year: number, name: string },
}

export default function RevueSettings({ revue }: PropTypes) {
    const editable = useEditMode({ authorizer: revueAuth.update })
    const popUpKey = `RevueSettings${revue.id}`
    const params = { params: { revueId: revue.id } }
    const updateRevue = configureAction(updateRevueAction, params)

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                p-2 text-text-muted bg-transparent border-none cursor-pointer
                hover:text-text
            "
            showButtonContent={<FontAwesomeIcon icon={faGear} />}
            ariaLabel={`Innstillinger for ${revue.name}`}
        >
            <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                <Form
                    title="Innstillinger"
                    action={updateRevue}
                    submitText="Lagre"
                    closePopUpOnSuccess={popUpKey}
                    navigateOnSuccess={updated => (updated ? revueLinks.revue(updated) : null)}
                >
                    <NumberInput name="year" label="År" defaultValue={revue.year} />
                    <TextInput name="name" label="Navn" defaultValue={revue.name} />
                </Form>
                <Form
                    action={configureAction(destroyRevueAction, params)}
                    submitText="Slett revy"
                    submitColor="red"
                    closePopUpOnSuccess={popUpKey}
                    navigateOnSuccess={revueLinks.frontpage()}
                    confirmation={{
                        confirm: true,
                        text: `Vil du slette ${revue.name} med alle undergruppene og medlemmene?`,
                    }}
                />
            </div>
        </PopUp>
    )
}
