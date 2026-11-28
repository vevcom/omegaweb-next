import { ResolveManualReviewField, ResolveManualReviewSubmitter } from './manualReviewSubmitters'

export default function ResolveManualReviewForm({ reviewId }: { reviewId: number }) {
    return (
        <ResolveManualReviewSubmitter params={{ reviewId }} submitText="Løs" refreshOnSuccess>
            <ResolveManualReviewField kind="text" name="resolutionDescription" label="Hva ble gjort?" />
        </ResolveManualReviewSubmitter>
    )
}
