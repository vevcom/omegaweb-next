import styles from './loading.module.scss'
import Loader from '@/components/Loader/Loader'

export default function loading() {
    return (
        <div className={styles.wrapper}>
            <Loader />
        </div>
    )
}
