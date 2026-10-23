import Date from '@/components/Date/Date'
import type { OmegaquoteFiltered } from '@/services/omegaquotes/types'

export type OmegaquoteQuotePropTypes = {
    quote: OmegaquoteFiltered
}

// The speech bubble: the ::after is the tail, tucked under the rounded text box.
const bubbleClassName = `
    relative
    after:absolute after:left-10 after:bottom-0 after:z-1 after:size-[20px] after:bg-surface-raised after:translate-y-1/2
    after:rotate-45
    [&>p]:relative [&>p]:z-2 [&>p]:block [&>p]:py-[2rem] [&>p]:px-[3rem] [&>p]:rounded-[25px] [&>p]:bg-surface-raised
    [&>p]:font-secondary [&>p]:text-xl [&>p]:[font-weight:lighter] [&>p]:italic [&>p]:text-left [&>p]:text-text
`

export default function OmegaquoteQuote({ quote }: OmegaquoteQuotePropTypes) {
    return <div className="
        relative my-[1.5rem]
        [&>h3]:ml-[1.5rem] [&>h3]:mt-[1.5rem]
    ">
        <div className={bubbleClassName}>
            <p>&quot;{ quote.quote }&quot;</p>
        </div>
        <h3>
            { quote.author }
        </h3>

        <span className="ml-[2rem]">
            <Date date={quote.timestamp} includeTime={false} />
        </span>
    </div>
}
