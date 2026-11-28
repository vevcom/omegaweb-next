'use client'
import HighlightFields from './HighlightFields'
import { CreateHighlightField, CreateHighlightSubmitter } from './highlightSubmitters'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import type { CareerFrontpageHighlightTargets } from '@/services/careers/frontpage/highlights/types'

const popUpKey = 'CreateCareerFrontpageHighlight'

export default function CreateHighlight({ targets }: { targets: CareerFrontpageHighlightTargets }) {
    return (
        <AddHeaderItemPopUp popUpKey={popUpKey}>
            <CreateHighlightSubmitter
                defaultValues={{ eventId: null, jobAdId: null }}
                title="Ny fremheving"
                submitText="Lag"
                refreshOnSuccess
                closePopUpOnSuccess={popUpKey}
            >
                <HighlightFields Field={CreateHighlightField} targets={targets} />
            </CreateHighlightSubmitter>
        </AddHeaderItemPopUp>
    )
}
