'use client'
import HighlightForm from './HighlightForm'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import { configureAction } from '@/services/configureAction'
import {
    destroyCareerFrontpageHighlightAction,
    updateCareerFrontpageHighlightAction,
} from '@/services/careers/frontpage/highlights/actions'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import type {
    CareerFrontpageHighlightTargets,
    ExpandedCareerFrontpageHighlight,
} from '@/services/careers/frontpage/highlights/types'

type PropTypes = {
    highlight: ExpandedCareerFrontpageHighlight,
    targets: CareerFrontpageHighlightTargets,
    name: string,
}

export default function EditHighlight({ highlight, targets, name }: PropTypes) {
    const popUpKey = `EditCareerFrontpageHighlight${highlight.id}`
    const params = { params: { id: highlight.id } }
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                grid place-items-center size-8 rounded-full border-none bg-base-300 text-base-content cursor-pointer
                hover:bg-base-300
            "
            showButtonContent={<FontAwesomeIcon icon={faPencil} />}
            ariaLabel={`Rediger ${name}`}
        >
            <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                <HighlightForm
                    title="Rediger fremheving"
                    action={configureAction(updateCareerFrontpageHighlightAction, params)}
                    submitText="Lagre"
                    closePopUpOnSuccess={popUpKey}
                    targets={targets}
                    highlight={highlight}
                />
                <Form
                    action={configureAction(destroyCareerFrontpageHighlightAction, params)}
                    submitText="Fjern fremheving"
                    submitColor="red"
                    refreshOnSuccess
                    closePopUpOnSuccess={popUpKey}
                    confirmation={{
                        confirm: true,
                        text: `Vil du fjerne fremhevingen av ${name}?`,
                    }}
                />
            </div>
        </PopUp>
    )
}
