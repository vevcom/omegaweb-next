import OmegaIdElement from './OmegaIdElement'
import { omegaIdOperations } from '@/services/omegaid/operations'
import { withFallback, withPageSession } from '@/app/ServerPage'

/**
 * Warining: this is a component meant for the server side
 */
export default async function OmegaId() {
    const token = await withPageSession(session => (session.user
        ? withFallback(omegaIdOperations.generate({ params: { userId: session.user.id } }), null)
        : null))

    if (!token) {
        return <p>Kunne ikke laste Omega-ID</p>
    }

    return <OmegaIdElement token={token} />
}
