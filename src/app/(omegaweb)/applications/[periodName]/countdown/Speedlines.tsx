import styles from './Speedlines.module.scss'
import type { CSSProperties } from 'react'

const generateLines = () =>
    Array.from({ length: 80 }).map(() => ({
        randomRotate: Math.random() * 360,
        randomDelay: Math.random() * 2,
        randomLength: Math.random() * 100 - 50,
    }))

const lines = generateLines()

export default function Speedlines() {
    return (
        <div className={styles.container}>
            {lines.map(({ randomRotate, randomDelay, randomLength }, index) =>
                (
                    <svg
                        key={index}
                        className={styles.speedline}
                        viewBox="0 0 100 100"
                        style={{
                            '--rotate': `${randomRotate}deg`,
                            '--delay': `${randomDelay}s`,
                        } as CSSProperties}
                    >
                        <line x1="50" y1="50" x2="50" y2={randomLength} />
                    </svg>
                )
            )}
        </div>
    )
}
