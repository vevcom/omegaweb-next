import styles from './PromoBar.module.scss'
import Image from '@/components/Image/Image'
import Link from 'next/link'
import type { PromoWithImage } from '@/services/promo/types'

// Its own island, same as LoggedInSection, but a single fixed-height banner
// (14 * $gap = 112px) for the promo an admin has manually scheduled.
export default function PromoBar({ promo }: { promo: PromoWithImage }) {
    return (
        <Link href={promo.link} className={styles.PromoBar}>
            <div className={styles.thumb}>
                <Image width={1200} image={promo.image} hideCredit hideCopyRight />
            </div>
            <div className={styles.content}>
                <h3 className={styles.title}>{promo.title}</h3>
                <p className={styles.text}>{promo.text}</p>
            </div>
        </Link>
    )
}
