import styles from './FinalCountdown.module.scss'
import useInterval from '@/hooks/useInterval'
import { readNumberOfApplicationsAction } from '@/services/applications/periods/actions'
import { useEffect, useRef, useState } from 'react'

type PropTypes = {
    periodName: string
}

export default function FinalCountdown({ periodName }: PropTypes) {
    const [timeLeft, setTimeLeft] = useState<number | null>(11)
    const ref = useRef<HTMLDivElement>(null)

    const [applicants, setApplicants] = useState(0)

    useEffect(() => {
        void readNumberOfApplicationsAction({ params: { name: periodName } }).then(res => {
            if (!res.success) return
            setApplicants(res.data)
        })
    }, [])

    useInterval(() => {
        if (timeLeft === null) return
        ref.current?.classList.remove(styles.animate)
        setTimeout(() => ref.current?.classList.add(styles.animate), 100)
        setTimeout(() => setTimeLeft(timeLeft - 1 >= 0 ? timeLeft - 1 : null), 50)
    }, 1000)

    return (
        <div ref={ref} className={[
            'fixed top-0 left-0 w-screen h-screen flex justify-center items-center scale-0',
            '[&_h1]:text-[10rem] [&_h1]:text-accent-red',
        ].join(' ')}>
            { timeLeft === null ? <h1 className="text-[8rem]! text-ink-strong! text-center">
                {applicants} <br /> søknader
            </h1> : <h1>{timeLeft}</h1> }

        </div>
    )
}
