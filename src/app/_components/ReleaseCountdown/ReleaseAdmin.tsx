'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import DateInput from '@/components/UI/DateInput'
import Checkbox from '@/components/UI/Checkbox'
import {
    mockReleaseCountdownGitGraphAction,
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
    const [mockGitGraphCommits, setMockGitGraphCommits] = useState<number | null>(null)

    return (
        <div className={[
            'flex flex-col gap-2 w-[min(28rem,calc(100vw-2*var(--gap)))] max-h-[calc(100vh-2*var(--gap))] overflow-y-auto',
            'p-6 border border-[hsl(0,0%,20%)] rounded-[calc(3*var(--rounding))] bg-surface-base [&_h2]:m-0',
            '[&_h2]:font-secondary',
        ].join(' ')}>
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
                className="pt-2 border-t border-[hsl(0,0%,20%)]"
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
                className="pt-2 border-t border-[hsl(0,0%,20%)]"
            >
                <input type="hidden" name="password" value={password} />
                {gitGraphCommits !== null && <p className="m-0 text-text-muted text-s">Hentet {gitGraphCommits} commits</p>}
            </Form>
            <Form
                action={mockReleaseCountdownGitGraphAction}
                submitText="Bruk en testgraf"
                submitColor="secondary"
                successCallback={data => {
                    setMockGitGraphCommits(data?.commits ?? null)
                    onGitGraphUpdated()
                }}
                className={styles.form}
            >
                <input type="hidden" name="password" value={password} />
                {mockGitGraphCommits !== null && (
                    <p className={styles.note}>Lagret en testgraf med {mockGitGraphCommits} commits</p>
                )}
            </Form>
            <Form
                action={unlockReleaseCountdownAction}
                submitText="Gå inn på nye veven"
                submitColor="green"
                refreshOnSuccess
                className="pt-2 border-t border-[hsl(0,0%,20%)]"
            >
                <input type="hidden" name="password" value={password} />
            </Form>
        </div>
    )
}
