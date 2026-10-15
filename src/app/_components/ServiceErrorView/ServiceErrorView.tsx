import StandardImageServer from '@/components/Image/StandardImageServer'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { errorCodes } from '@/services/error'
import type { Smorekopp } from '@/services/error'

/**
 * Renders a service error in place of a page or layout. Used by `serverPage` and `serverLayout`
 * when their operation throws a service error - unlike the error boundary in error.tsx, this is
 * rendered on the server and receives the actual error instance, so no information
 * has to be smuggled through an encoded native Error.
 */
export default function ServiceErrorView({ error }: { error: Smorekopp }) {
    const errorConfig = errorCodes.find((code) => code.name === error.errorCode)
    const message = error.errors.at(0)?.message ?? errorConfig?.defaultMessage ?? 'En ukjent feil har oppstått'

    return (
        <div className="bg-surface-base px-4 flex-1 flex flex-col justify-center items-center min-h-[50vh]">
            <PageTitleSetter title="Feil" />
            <div className="flex justify-center items-center max-mobile:min-h-[50vh] [&_h3]:text-text">
                <div className="border-r-2 border-solid border-surface-base pr-[20px] mr-[20px]">
                    <StandardImageServer
                        width={70}
                        standardImage="LOGO_SIMPLE"
                        tint="var(--text)"
                    />
                </div>
                <div>
                    <h3>{message}</h3>
                    <p className="text-text opacity-60 text-s">{error.httpCode} - {error.errorCode}</p>
                </div>
            </div>
        </div>
    )
}
