import OmegaIdElement from './OmegaIdElement'
import { generateOmegaIdAction } from '@/services/omegaid/actions'
import { ServerSession } from '@/auth/session/ServerSession'

/**
 * Warining: this is a component meant for the server side
 */
export default async function OmegaId() {
    const user = (await ServerSession.fromNextAuth()).user
    if (!user) {
        return <p>Kunne ikke laste Omega-ID</p>
    }

    const results = await generateOmegaIdAction({ params: { userId: user.id } })

    if (!results.success) {
        return <p>Kunne ikke laste Omega-ID</p>
    }

    return <OmegaIdElement token={results.data} />
}
