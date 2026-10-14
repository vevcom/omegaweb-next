import styles from './layout.module.scss'
import StandardImageServer from '@/components/Image/StandardImageServer'
import React from 'react'

type PropTypes = {
    children: React.ReactNode
}

export default function AuthLayout({ children }: PropTypes) {
    return (
        <div className={styles.wrapper}>
            <div className={styles.card}>
                <div className={styles.input}>
                    <div className={styles.crest}>
                        <StandardImageServer
                            standardImage="MAGISK_HATT"
                            alt="en kappemann sin hatt"
                            width={120}
                        />
                    </div>
                    {children}
                </div>
                <div className={styles.image} />
            </div>
        </div>
    )
}
