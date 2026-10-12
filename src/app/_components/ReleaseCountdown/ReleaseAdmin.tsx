'use client'
import styles from './ReleaseAdmin.module.scss'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import DateInput from '@/components/UI/DateInput'
import Checkbox from '@/components/UI/Checkbox'
import {
    unlockReleaseCountdownAction,
    updateReleaseCountdownGitGraphAction,
    updateReleaseCountdownSettingsAction,
} from '@/services/releaseCountdown/actions'
import { useState } from 'react'

type PropTypes = {
    releaseDate: number,
    openToAll: boolean,
    onGitGraphUpdated: () => void,
}

/**
 * The panel behind the space bar on the countdown. Every form on it sends the password, typed once
 * at the top, since the countdown has no session to tell an admin from anyone else.
 */
export default function ReleaseAdmin({ releaseDate, openToAll, onGitGraphUpdated }: PropTypes) {
    const [password, setPassword] = useState('')
    const [gitGraphCommits, setGitGraphCommits] = useState<number | null>(null)

    return (
        <div className={styles.ReleaseAdmin}>
            <h2>Slippet</h2>
            <TextInput
                type="password"
                name="adminPassword"
                label="Passord"
                autoFocus
                value={password}
                onChange={event => setPassword(event.target.value)}
            />
            <Form
                action={updateReleaseCountdownSettingsAction}
                submitText="Lagre"
                refreshOnSuccess
                className={styles.form}
            >
                <input type="hidden" name="password" value={password} />
                <DateInput includeTime name="releaseDate" label="Slippes" defaultValue={new Date(releaseDate)} />
                <Checkbox name="openToAll" label="Åpen for alle" defaultChecked={openToAll} />
            </Form>
            <Form
                action={updateReleaseCountdownGitGraphAction}
                submitText="Hent git-grafen fra GitHub"
                submitColor="secondary"
                successCallback={data => {
                    setGitGraphCommits(data?.commits ?? null)
                    onGitGraphUpdated()
                }}
                className={styles.form}
            >
                <input type="hidden" name="password" value={password} />
                {gitGraphCommits !== null && <p className={styles.note}>Hentet {gitGraphCommits} commits</p>}
            </Form>
            <Form
                action={unlockReleaseCountdownAction}
                submitText="Gå inn på nye veven"
                submitColor="green"
                refreshOnSuccess
                className={styles.form}
            >
                <input type="hidden" name="password" value={password} />
            </Form>
        </div>
    )
}
