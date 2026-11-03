/**
 * Next.js runs this once when the server starts, in each runtime it starts.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    // First, so production refuses to start on the development secrets before doing anything else.
    if (process.env.NODE_ENV === 'production') {
        const { assertProductionSecrets } = await import('@/lib/productionSecrets')
        assertProductionSecrets()
    }
}
