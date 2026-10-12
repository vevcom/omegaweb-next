/**
 * Next.js runs this once when the server starts, in each runtime it starts.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    const { prepareReleaseCountdown } = await import('@/services/releaseCountdown/prepare')
    await prepareReleaseCountdown()
}
