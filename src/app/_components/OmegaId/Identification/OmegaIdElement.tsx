'use client'
import styles from './OmegaIdElement.module.scss'
import { generateOmegaIdAction } from '@/services/omegaid/actions'
import { readJWTPayload } from '@/jwt/jwtReadUnsecure'
import { compressOmegaId } from '@/services/omegaid/compress'
import { useSession } from '@/auth/session/useSession'
import { useQRCode } from 'next-qrcode'
import { useEffect, useState } from 'react'

const EXPIRY_THRESHOLD = 60

export default function OmegaIdElement({ token }: {
    token: string,
}) {
    const [tokenState, setTokenState] = useState(token)

    const session = useSession()

    const { SVG } = useQRCode()

    const JWTPayload = readJWTPayload(tokenState)

    const [expiryTime, setExpiryTime] = useState(new Date((JWTPayload.exp - EXPIRY_THRESHOLD) * 1000))

    useEffect(() => {
        const interval = setInterval(async () => {
            if (expiryTime < new Date()) {
                if (session.loading || !session.session.user) return
                const results = await generateOmegaIdAction({ params: { userId: session.session.user.id } })
                if (!results.success) {
                    console.error(results)
                    throw new Error('Kunne ikke laste QR-koden på nytt')
                }

                setTokenState(results.data)

                const pld = readJWTPayload(results.data)

                setExpiryTime(new Date((pld.exp - EXPIRY_THRESHOLD) * 1000))
            }
        }, 15 * 1000)

        return () => clearInterval(interval)
    })

    if (session.loading) return <p>Loading...</p>
    if (!session.session.user) return <p>Could not load Omega-ID, since the user is not loggedin.</p>
    const user = session.session.user

    return <div className={styles.OmegaIdElement}>
        <h2>Omega-ID</h2>
        <SVG
            text={compressOmegaId(tokenState)}
        />
        <h2>{user.firstname} {user.lastname}</h2>
        <h4>{user.username}</h4>
        <h4>{user.id}</h4>
    </div>
}
