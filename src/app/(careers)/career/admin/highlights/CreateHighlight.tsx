'use client'
import HighlightForm from './HighlightForm'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { createCareerFrontpageHighlightAction } from '@/services/careers/frontpage/highlights/actions'
import type { CareerFrontpageHighlightTargets } from '@/services/careers/frontpage/highlights/types'

const popUpKey = 'CreateCareerFrontpageHighlight'

export default function CreateHighlight({ targets }: { targets: CareerFrontpageHighlightTargets }) {
    return (
        <AddHeaderItemPopUp popUpKey={popUpKey}>
            <HighlightForm
                title="Ny fremheving"
                action={createCareerFrontpageHighlightAction}
                submitText="Lag"
                closePopUpOnSuccess={popUpKey}
                targets={targets}
            />
        </AddHeaderItemPopUp>
    )
}
