import StandardImageServer from '@/components/Image/StandardImageServer'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { getDefaultErrorMessage } from '@/services/error'
import type { Smorekopp } from '@/services/error'

/**
 * Renders a service error in place of a page or layout. Used by `serverPage` and `serverLayout`
 * when their operation throws a service error - unlike the error boundary in error.tsx, this is
 * rendered on the server and receives the actual error instance, so no information
 * has to be smuggled through an encoded native Error.
 */
export default function ServiceErrorView({ error }: { error: Smorekopp }) {
    const message = error.errors.at(0)?.message ?? getDefaultErrorMessage(error.errorCode)

    return (
        <div className="bg-base-100 px-4 flex-1 flex flex-col justify-center items-center min-h-[50vh]">
            <PageTitleSetter title="Feil" />
            <div className="
                flex justify-center items-center
                max-mobile:min-h-[50vh] max-mobile:flex-col max-mobile:text-center
                [&_h3]:text-base-content
            ">
                <div className="
                    border-r-2 border-solid border-base-100 pr-[20px] mr-[20px]
                    max-mobile:border-r-0 max-mobile:pr-0 max-mobile:mr-0 max-mobile:mb-[20px]
                ">
                    <StandardImageServer
                        width={70}
                        standardImage="LOGO_SIMPLE"
                        tint="var(--color-base-content)"
                    />
                </div>
                <div className="wrap-anywhere">
                    <h3>{message}</h3>
                    <p className="text-base-content opacity-60 text-s">{error.httpCode} - {error.errorCode}</p>
                </div>
            </div>
        </div>
    )
}
