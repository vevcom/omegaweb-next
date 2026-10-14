import styles from './ContactorWordmark.module.scss'

type PropTypes = {
    /** For dark surfaces (the footer). */
    light?: boolean,
}

export default function ContactorWordmark({ light = false }: PropTypes) {
    return (
        <span className={`${styles.wordmark} ${light ? styles.light : ''}`}>
            Contactor
            <span className={styles.sub}>NTNU</span>
        </span>
    )
}
