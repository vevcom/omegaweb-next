'use client'
import Button from '@/components/UI/Button'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import StandardImageClient from '@/components/Image/StandardImageClient'

/**
 * The boundary for errors thrown during rendering. Expected service errors never reach it -
 * serverPage and serverLayout render ServiceErrorView for those - so what lands here are genuine
 * bugs, which only carry a plain Error message.
*/
export default function ErrorBoundary({ error, reset }: {error: unknown, reset: () => void}) {
    return (
        <div className={[
            'bg-surface-base px-4 flex-1 flex flex-col justify-center items-center min-h-[50vh]',
            '[&>button]:absolute [&>button]:top-[calc(64px+20px+var(--gap))] [&>button]:right-[20px] [&>button]:w-auto',
        ].join(' ')}>
            <PageTitleSetter title={'Feil'} />
            <div className="flex justify-center items-center max-mobile:min-h-[50vh] [&_h3]:text-text">
                <div className="border-r-2 border-solid border-surface-base pr-[20px] mr-[20px]">
                    <StandardImageClient
                        width={70}
                        standardImage="LOGO_SIMPLE"
                        tint="var(--text)"
                    />
                </div>
                {
                    error instanceof Error ? (
                        <h3>{error.message}</h3>
                    ) : (
                        <h3>Ukjent feil</h3>
                    )
                }
            </div>
            <Button onClick={reset}>Prøv igjen</Button>
        </div>
    )
}
