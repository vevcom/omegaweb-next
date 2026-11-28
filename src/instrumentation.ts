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

    const { loadDomainConfig } = await import('@/lib/sites/loadDomainConfig')
    loadDomainConfig()

    const { MapSharedCache } = await import('@/services/sharedCache')
    const { RedisSharedCache, redisUrl } = await import('@/services/redisSharedCache')
    if (!redisUrl) {
        MapSharedCache.beginForProcess()
        return
    }
    // An answer is given only to the build that read it.
    const { buildId } = await import('@/lib/buildId')
    RedisSharedCache.beginForProcess(redisUrl, buildId())
}
