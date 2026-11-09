'use client'
import Form from '@/components/Form/Form'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { configureAction } from '@/services/configureAction'
import type { UpdateVisibilityAction, VisibilityMatrix } from '@/services/visibility/types'

type PropTypes = {
    visibility: VisibilityMatrix,
    visibilityId: number,
    updateVisibilityAction: UpdateVisibilityAction,
}

export default function VisibilityAdmin({ visibility, visibilityId, updateVisibilityAction }: PropTypes) {
    return (
        <Form
            className="flex flex-col gap-[0.5em] min-w-[350px]"
            submitText="Lagre"
            submitColor="green"
            refreshOnSuccess
            action={configureAction(updateVisibilityAction, { params: { visibilityId } })}
        >
            <VisibilityMatrixEditor name="requirements" defaultValue={visibility.requirements} />
        </Form>
    )
}
