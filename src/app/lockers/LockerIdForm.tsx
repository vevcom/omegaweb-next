'use client'
import styles from './LockerIdForm.module.scss'
import Button from '@/components/UI/Button'
import NumberInput from '@/components/UI/NumberInput'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FormEvent } from 'react'

/**
 * Goes to a locker by its number, for whoever stands in front of one without a working camera.
 */
export default function LockerIdForm() {
    const router = useRouter()
    const [lockerId, setLockerId] = useState('')

    const goToLocker = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (lockerId) router.push(`/lockers/${lockerId}`)
    }

    return (
        <form className={styles.LockerIdForm} onSubmit={goToLocker}>
            <NumberInput
                name="lockerId"
                label="Skapnummer"
                min="1"
                value={lockerId}
                onChange={event => setLockerId(event.target.value)}
            />
            <Button type="submit" color="secondary">Gå til skap</Button>
        </form>
    )
}
