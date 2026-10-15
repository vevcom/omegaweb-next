'use client'
import Form from '@/components/Form/Form'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type {
    UpdateVisibilityAction,
    VisibilityMatrix,
    VisibilityRequirement
} from '@/services/visibility/types'

type PropTypes = {
    visibility: VisibilityMatrix,
    visibilityId: number,
    updateVisibilityAction: UpdateVisibilityAction,
}

export default function VisibilityAdmin({ visibility, visibilityId, updateVisibilityAction }: PropTypes) {
    const [requirements, setRequirements] = useState<VisibilityRequirement[]>(visibility.requirements)

    const saveVisibility = configureAction(updateVisibilityAction, { params: { visibilityId } })

    async function handleSave() {
        return saveVisibility({ data: { requirements } })
    }

    return (
        <div className="flex flex-col gap-[0.5em] min-w-[350px]">
            <VisibilityMatrixEditor requirements={requirements} onChange={setRequirements} />
            <Form submitText="Lagre" submitColor="green" refreshOnSuccess action={handleSave} />
        </div>
    )
}
