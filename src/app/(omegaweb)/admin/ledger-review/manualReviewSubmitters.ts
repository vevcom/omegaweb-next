'use client'
import { Form } from '@/components/Form/Declared/Form'
import { manualReviewCapabilities } from '@/capabilities/ledger/transactions/manualReviews/capabilities'

export const [ResolveManualReviewSubmitter, ResolveManualReviewField] = Form.Submitter({
    capability: manualReviewCapabilities.resolve,
})
