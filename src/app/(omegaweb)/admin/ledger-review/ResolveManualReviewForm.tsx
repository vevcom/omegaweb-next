'use client'
import Form from '@/components/Form/Form'
import Textarea from '@/components/UI/Textarea'
import { configureAction } from '@/services/configureAction'
import { resolveManualReviewAction } from '@/services/ledger/transactions/manualReviews/actions'
import useSiteRouter from '@/hooks/useSiteRouter'

export default function ResolveManualReviewForm({ reviewId }: { reviewId: number }) {
    const { refresh } = useSiteRouter()

    return (
        <Form
            submitText="Løs"
            action={configureAction(resolveManualReviewAction, { params: { reviewId } })}
            successCallback={refresh}
        >
            <Textarea label="Hva ble gjort?" name="resolutionDescription" required />
        </Form>
    )
}
