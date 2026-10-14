'use client'
import styles from './CommitteeLogoRoll.module.scss'
import Image from '@/components/Image/Image'
import useInterval from '@/hooks/useInterval'
import { readNumberOfApplicationsAction } from '@/services/applications/periods/actions'
import { useRef, useState } from 'react'
import type { ExpandedImage } from '@/services/images/subservice/types'

type PropTypes = {
    committees: {
        shortName: string,
        logo: ExpandedImage
    }[],
    periodName: string
}


export default function CommitteeLogoRoll({ committees, periodName }: PropTypes) {
    // Dynamically set initial indexes based on committee count
    const initialIndexes = () => {
        const result: Record<string, number | 'applicantionCount' | null> = {}
        for (let i = 0; i < 3; i++) {
            result[`display${i + 1}`] = i < committees.length ? i : null
        }
        return result as {
            display1: number | 'applicantionCount' | null,
            display2: number | 'applicantionCount' | null,
            display3: number | 'applicantionCount' | null,
        }
    }
    const [currentCommitteeIndexes, setCurrentCommitteeIndexes] = useState(initialIndexes())

    const [applicationCount, setApplicationCount] = useState(0)

    useInterval(async () => {
        const res = await readNumberOfApplicationsAction({ params: { name: periodName } })
        if (!res.success) return
        setApplicationCount(res.data)
    }, 2000)

    const display1Ref = useRef<HTMLDivElement>(null)
    const display2Ref = useRef<HTMLDivElement>(null)
    const display3Ref = useRef<HTMLDivElement>(null)

    const currentIndex = useRef<number | 'applicantionCount'>(0)

    const [toggle, setToggle] = useState<1 | 2 | 3>(1)

    const dispays = ['display1', 'display2', 'display3'] as const

    useInterval(() => {
        if (!committees.length) return

        // Find how many displays are actually used
        const displayKeys = dispays.filter((_, i) => i < Math.max(1, committees.length))

        let nextIndex: number | 'applicantionCount' = 0
        if (typeof currentIndex.current === 'number' && currentIndex.current === committees.length - 1) {
            nextIndex = 'applicantionCount'
        } else if (currentIndex.current === 'applicantionCount') {
            nextIndex = 0
        } else if (typeof currentIndex.current === 'number') {
            nextIndex = currentIndex.current + 1
        }

        let display: keyof typeof currentCommitteeIndexes = `display${toggle}` as keyof typeof currentCommitteeIndexes
        let nextToggle = toggle
        switch (toggle) {
            case 1:
                display = 'display1'
                nextToggle = displayKeys.length >= 2 ? 2 : 1
                display1Ref.current?.classList.remove(styles.animate)
                setTimeout(() => display1Ref.current?.classList.add(styles.animate), 50)
                break
            case 2:
                display = 'display2'
                nextToggle = displayKeys.length === 3 ? 3 : 1
                display2Ref.current?.classList.remove(styles.animate)
                setTimeout(() => display2Ref.current?.classList.add(styles.animate), 50)
                break
            case 3:
                display = 'display3'
                nextToggle = 1
                display3Ref.current?.classList.remove(styles.animate)
                setTimeout(() => display3Ref.current?.classList.add(styles.animate), 50)
                break
            default:
                break
        }

        setCurrentCommitteeIndexes({
            ...currentCommitteeIndexes,
            [display]: nextIndex,
        })

        currentIndex.current = nextIndex
        setToggle(nextToggle)
    }, 2500)

    return (
        <div className={styles.CommitteeLogoRoll}>
            {dispays.map((displayKey) => {
                const idx = currentCommitteeIndexes[displayKey]
                if (idx === null) return null

                let content = null
                if (idx === 'applicantionCount') {
                    content = <>
                        <h1>Søknader Hittil</h1>
                        <h1>{applicationCount}</h1>
                    </>
                } else if (typeof idx === 'number' && committees[idx]) {
                    content = <Display image={committees[idx].logo} shortName={committees[idx].shortName} />
                }

                let refProp = null
                if (displayKey === 'display1') refProp = display1Ref
                else if (displayKey === 'display2') refProp = display2Ref
                else refProp = display3Ref

                return (
                    <div
                        key={displayKey}
                        ref={refProp}
                        className={styles.display}
                    >
                        {content}
                    </div>
                )
            })}
        </div>
    )
}


function Display({ image, shortName }: { image: ExpandedImage, shortName: string }) {
    return (
        <>
            <Image width={600} image={image} />
            <span>{shortName}</span>
        </>
    )
}
