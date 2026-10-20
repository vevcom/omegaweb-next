'use client'
import GitGraphPlayer from './GitGraphPlayer'
import WhiteSun from './WhiteSun'
import FinalCountdown from './FinalCountdown'
import ReleaseAdmin from './ReleaseAdmin'
import Button from '@/components/UI/Button'
import useKeyPress from '@/hooks/useKeyPress'
import { enterReleaseCountdownAction } from '@/services/releaseCountdown/actions'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

const releaseDateFormat = new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Oslo',
})

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// The last minute is counted down in big numbers. Before it, the git graph rushes through the
// whole history towards a white sun, which leaves the screen white as the last minute begins.
const FINAL_COUNTDOWN_DURATION = MINUTE
const RUSH_DURATION = 10 * SECOND

function phaseOf(remaining: number | null) {
    if (remaining === null || remaining > FINAL_COUNTDOWN_DURATION + RUSH_DURATION) return 'countdown'
    if (remaining > FINAL_COUNTDOWN_DURATION) return 'rush'
    return 'final'
}

const subscribeToClock = (onTick: () => void) => {
    const interval = setInterval(onTick, SECOND / 4)
    return () => clearInterval(interval)
}
// Rounded to whole seconds so repeated reads within the same second return the same snapshot.
const readClock = () => Math.floor(Date.now() / SECOND) * SECOND
// The server renders placeholders, and the client fills in the time right after hydration.
const readServerClock = () => null

type PropTypes = {
    releaseDate: number,
    openToAll: boolean,
}

/**
 * Shown instead of the website until it is released, ending with a rush through the git history
 * and a final countdown of the last minute.
 * Pressing space opens the admin panel, where the password lets you in early, change the release
 * date, open the website to all and update the git graph. The button to go in is shown until the
 * rush, and lets the visitor in once the website is open to all.
 */
export default function ReleaseCountdown({ releaseDate, openToAll }: PropTypes) {
    const now = useSyncExternalStore(subscribeToClock, readClock, readServerClock)
    const [showAdmin, setShowAdmin] = useState(false)
    // Bumped when the graph is updated from the admin panel, so the player loads it anew.
    const [graphVersion, setGraphVersion] = useState(0)
    const [enterError, setEnterError] = useState<string | null>(null)
    const hasRefreshed = useRef(false)
    const { refresh } = useRouter()

    const remaining = now === null ? null : Math.max(0, releaseDate - now)
    const phase = phaseOf(remaining)

    useEffect(() => {
        if (remaining !== 0 || hasRefreshed.current) return
        // The server stops showing the countdown once the release date has passed.
        hasRefreshed.current = true
        refresh()
    }, [remaining, refresh])

    useKeyPress(' ', useCallback((event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
        setShowAdmin(true)
    }, []))
    useKeyPress('Escape', useCallback(() => setShowAdmin(false), []))

    const enter = async () => {
        const result = await enterReleaseCountdownAction()
        if (!result.success) {
            setEnterError(result.error?.[0]?.message ?? 'Noe gikk galt. Prøv igjen.')
            return
        }
        refresh()
    }

    const units = [
        { label: 'dager', unitLength: DAY, cycle: Infinity },
        { label: 'timer', unitLength: HOUR, cycle: DAY },
        { label: 'minutter', unitLength: MINUTE, cycle: HOUR },
        { label: 'sekunder', unitLength: SECOND, cycle: MINUTE },
    ].map(({ label, unitLength, cycle }) => ({
        label,
        value: remaining === null ? '--' : String(Math.floor(remaining % cycle / unitLength)).padStart(2, '0'),
    }))

    return (
        <div className="[--text:hsl(0,0%,90%)] [--text-muted:hsl(0,0%,55%)] [--surface-base:hsl(0,0%,6%)] [--surface-raised:hsl(0,0%,10%)] fixed inset-0 overflow-hidden bg-black text-text">
            {phase === 'final' && remaining !== null ? (
                <FinalCountdown remaining={remaining} duration={FINAL_COUNTDOWN_DURATION} />
            ) : (
                <>
                    <div className={[
                        'relative z-1 flex flex-col items-center gap-4 pt-8 px-2 pb-4 text-center [&_h1]:font-secondary [&_h1]:text-xxl [&_h1]:m-0 transition-[opacity,translate] duration-[1.5s] ease-in',
                        phase === 'rush' ? 'opacity-0 -translate-y-4 pointer-events-none' : '',
                    ].join(' ')}>
                        <h1>Project Next</h1>
                        <div className="flex justify-center gap-4 max-mobile:w-full max-mobile:max-w-[30rem] max-mobile:gap-2">
                            {units.map(unit => (
                                <div key={unit.label} className="flex flex-col items-center min-w-[6rem] p-4 border border-[hsl(0,0%,20%)] rounded-[calc(3*var(--rounding))] bg-[rgb(0_0_0/60%)] backdrop-blur-[4px] max-mobile:flex-[1_1_0] max-mobile:min-w-0 max-mobile:py-2 max-mobile:px-1">
                                    <span className="text-[length:clamp(2.5rem,8vw,5rem)] font-bold tabular-nums leading-none text-accent-blue max-mobile:text-[length:clamp(1.75rem,10vw,3rem)]">{unit.value}</span>
                                    <span className="text-s text-text-muted uppercase tracking-[0.1em] max-mobile:text-[length:clamp(8px,2.5vw,12px)] max-mobile:tracking-[0.05em]">{unit.label}</span>
                                </div>
                            ))}
                        </div>
                        <p className="m-0 text-text-muted text-m">{releaseDateFormat.format(new Date(releaseDate))}</p>
                        <div className="flex flex-col items-center gap-2 transition-[opacity,translate] duration-[1.5s] ease-out starting:opacity-0 starting:translate-y-[0.5rem]">
                            <Button onClick={enter}>Se nye veven</Button>
                            {enterError && <p className="m-0 text-accent-red text-s">{enterError}</p>}
                        </div>
                    </div>
                    <GitGraphPlayer
                        key={graphVersion}
                        rushStartsAt={releaseDate - FINAL_COUNTDOWN_DURATION - RUSH_DURATION}
                        rushDuration={RUSH_DURATION}
                    />
                    {phase === 'rush' && remaining !== null && (
                        <WhiteSun
                            elapsed={FINAL_COUNTDOWN_DURATION + RUSH_DURATION - remaining}
                            duration={RUSH_DURATION}
                        />
                    )}
                </>
            )}
            {showAdmin && (
                <div className="fixed inset-0 flex items-center justify-center bg-[rgb(0_0_0/70%)] backdrop-blur-[6px] z-10" onClick={() => setShowAdmin(false)}>
                    <div onClick={event => event.stopPropagation()}>
                        <ReleaseAdmin
                            releaseDate={releaseDate}
                            openToAll={openToAll}
                            onGitGraphUpdated={() => setGraphVersion(version => version + 1)}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
