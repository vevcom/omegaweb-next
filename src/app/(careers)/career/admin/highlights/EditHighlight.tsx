'use client'
import HighlightFields from './HighlightFields'
import { DestroyHighlightSubmitter, UpdateHighlightField, UpdateHighlightSubmitter } from './highlightSubmitters'
import { buttonClassName } from '@/components/UI/buttonClassName'
import PopUp from '@/components/PopUp/PopUp'
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
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass={buttonClassName({
                variant: 'icon',
                color: 'neutral',
                className: 'bg-base-300! rounded-full!',
            })}
            showButtonContent={<FontAwesomeIcon icon={faPencil} />}
            ariaLabel={`Rediger ${name}`}
        >
            <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
                <UpdateHighlightSubmitter
                    params={{ id: highlight.id }}
                    defaultValues={{
                        eventId: highlight.event?.id ?? null,
                        jobAdId: highlight.jobAd?.id ?? null,
                        start: highlight.start,
                        end: highlight.end,
                    }}
                    title="Rediger fremheving"
                    submitText="Lagre"
                    refreshOnSuccess
                    closePopUpOnSuccess={popUpKey}
                >
                    <HighlightFields Field={UpdateHighlightField} targets={targets} highlight={highlight} />
                </UpdateHighlightSubmitter>
                <DestroyHighlightSubmitter
                    params={{ id: highlight.id }}
                    submitText="Fjern fremheving"
                    submitColor="error"
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
