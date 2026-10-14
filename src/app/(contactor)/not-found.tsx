import styles from './not-found.module.scss'
import Link from 'next/link'

export default function ContactorNotFound() {
    return (
        <div className={styles.wrapper}>
            <h1>404</h1>
            <p>Fant ikke siden du lette etter.</p>
            <Link href="/career">Til forsiden</Link>
        </div>
    )
}
