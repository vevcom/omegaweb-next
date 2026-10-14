import cliProgress from 'cli-progress'

/**
 * Creates and starts a console progress bar for a dobbelOmega migration step.
 * Returns a no-op-ish bar (total 0) when there is nothing to migrate, so callers
 * can unconditionally call .increment()/.stop() without checking the count themselves.
 */
export function createProgressBar(label: string, total: number) {
    const bar = new cliProgress.SingleBar({
        // cli-progress emits nothing at all on a non-TTY stream unless this is on, and
        // the import that most needs a progress signal - the one-shot tools container in
        // production - is exactly the non-TTY case. The schedule is deliberately coarse:
        // every redraw is its own log line there, so a TTY-like cadence would bury the
        // rest of the seeder's output.
        noTTYOutput: true,
        notTTYSchedule: 30_000,
        format: `${label.padEnd(28)} |{bar}| {value}/{total} ({percentage}%) | ETA: {eta}s`,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
    })
    bar.start(total, 0)
    return bar
}
