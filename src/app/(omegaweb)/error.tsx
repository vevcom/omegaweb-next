'use client'
import styles from './error.module.scss'
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
        <div className={styles.wrapper}>
            <PageTitleSetter title={'Feil'} />
            <div className={styles.info}>
                <div className={styles.imageContainer}>
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
