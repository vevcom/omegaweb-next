import styles from './ServiceErrorView.module.scss'
import StandardImageServer from '@/components/Image/StandardImageServer'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { errorCodes } from '@/services/error'
import type { ErrorCode, Smorekopp } from '@/services/error'
import type { AuthStatus } from '@/auth/authorizer/AuthResult'

/**
 * Renders a service error in place of a page or layout. Used by `serverPage` and `serverLayout`
 * when their operation throws a service error - unlike the error boundary in error.tsx, this is
 * rendered on the server and receives the actual error instance, so no information
 * has to be smuggled through an encoded native Error.
 */
export default function ServiceErrorView({ error }: { error: Smorekopp<ErrorCode | AuthStatus> }) {
    const errorConfig = errorCodes.find((code) => code.name === error.errorCode)
    const message = error.errors.at(0)?.message ?? errorConfig?.defaultMessage ?? 'En ukjent feil har oppstått'

    return (
        <div className={styles.wrapper}>
            <PageTitleSetter title="Feil" />
            <div className={styles.info}>
                <div className={styles.imageContainer}>
                    <StandardImageServer
                        width={70}
                        standardImage="LOGO_SIMPLE"
                        tint="var(--text)"
                    />
                </div>
                <div>
                    <h3>{message}</h3>
                    <p className={styles.code}>{error.httpCode} - {error.errorCode}</p>
                </div>
            </div>
        </div>
    )
}
