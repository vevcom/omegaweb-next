import styles from './Loader.module.scss'
import StandardImageServer from '@/components/Image/StandardImageServer'

/**
 * WARNING: this component should only be rendered on the server
*/
function Loader() {
    return (
        <div className={styles.Loader}>
            <StandardImageServer
                standardImage="LOGO_SIMPLE"
                width={100}
                tint="var(--color-base-content)"
            />
        </div>
    )
}

export default Loader
