'use client'
import Form from '@/components/Form/Form'
import Textarea from '@/components/UI/Textarea'
import { configureAction } from '@/services/configureAction'
import { resolveManualReviewAction } from '@/services/ledger/transactions/manualReviews/actions'
import { useRouter } from 'next/navigation'

export default function ResolveManualReviewForm({ reviewId }: { reviewId: number }) {
    const { refresh } = useRouter()

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
