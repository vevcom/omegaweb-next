import Date from '@/components/Date/Date'
import type { BulshitFiltered } from '@/services/bulshit/types'

export type BulshitPropTypes = {
    quote: BulshitFiltered
}

// The speech bubble: the ::after is the tail, tucked under the rounded text box.
const bubble = 'relative after:absolute after:left-10 after:bottom-0 after:z-1 after:size-[20px] after:bg-surface-raised after:translate-y-1/2 after:rotate-45 [&>p]:relative [&>p]:z-2 [&>p]:block [&>p]:py-[2rem] [&>p]:px-[3rem] [&>p]:rounded-[25px] [&>p]:bg-surface-raised [&>p]:font-secondary [&>p]:text-xl [&>p]:font-[lighter] [&>p]:italic [&>p]:text-left [&>p]:text-text'

export default function Bulshit({ quote }: BulshitPropTypes) {
    return <div className="relative my-[1.5rem]">
        <div className={bubble}>
            <p>&quot; Ryktes at { quote.quote }&quot;</p>
        </div>

        <span className="ml-[2rem]">
            <Date date={quote.timestamp} includeTime={false} />
        </span>
    </div>
}
