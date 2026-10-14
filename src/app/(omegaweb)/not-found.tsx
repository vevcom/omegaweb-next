import styles from './not-found.module.scss'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import StandardImageServer from '@/components/Image/StandardImageServer'

export default function Error404() {
    return (
        <div className={styles.wrapper}>
            <PageTitleSetter title={'Side ikke funnet'} />
            <div className={styles.info}>
                <div className={styles.imageContainer}>
                    <StandardImageServer
                        standardImage="LOGO_SIMPLE"
                        width={60}
                        tint="var(--text)"
                    />
                </div>
                <h3>404 - Side ikke funnet</h3>
            </div>
        </div>
    )
}
