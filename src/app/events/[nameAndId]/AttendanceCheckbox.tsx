'use client'
import styles from './AttendanceCheckbox.module.scss'
import Checkbox from '@/components/UI/Checkbox'
import { setEventAttendanceAction } from '@/services/events/registration/actions'
import { useState } from 'react'

/**
 * The attendance box of one row of the registration table, for the ones a scan cannot reach: a
 * guest has no Omega-ID, and a scan of the wrong person has to be taken back.
 *
 * The rows come from a paging context that does not refetch, so what the box shows is kept here -
 * and only moved once the write came back, since a box that flipped on a failed write would claim
 * someone showed up who never did.
 */
export default function AttendanceCheckbox({
    registrationId,
    attended: initialAttended,
    name,
}: {
    registrationId: number,
    attended: boolean,
    name: string,
}) {
    const [attended, setAttended] = useState(initialAttended)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    return <div className={styles.AttendanceCheckbox}>
        <Checkbox
            name={`attended-${registrationId}`}
            checked={attended}
            disabled={pending}
            aria-label={`Møtt: ${name}`}
            onChange={async (changeEvent) => {
                const next = changeEvent.target.checked

                setPending(true)
                setError(null)

                const result = await setEventAttendanceAction(
                    { params: { registrationId } },
                    { data: { attended: next } }
                )

                setPending(false)

                if (!result.success) {
                    setError(result.error
                        ? result.error.map(issue => issue.message).join(' / ')
                        : 'Kunne ikke lagre oppmøte')
                    return
                }

                setAttended(Boolean(result.data.attendedAt))
            }}
        />
        {error && <span className={styles.error}>{error}</span>}
    </div>
}
