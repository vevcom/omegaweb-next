'use client'
import styles from './AttendanceScanner.module.scss'
import { useAttendanceCounts } from './AttendanceCounts'
import OmegaIdReader from '@/components/OmegaId/Reader/OmegaIdReader'
import { registerEventAttendanceAction } from '@/services/events/registration/actions'

export default function AttendanceScanner({
    eventId,
    omegaIdPublicKey,
    registeredById,
}: {
    eventId: number,
    omegaIdPublicKey: string,
    registeredById: number,
}) {
    const { setCounts } = useAttendanceCounts()

    return <div className={styles.AttendanceScanner}>
        <OmegaIdReader
            publicKey={omegaIdPublicKey}
            qrboxSize={300}
            successCallback={async (userId) => {
                const result = await registerEventAttendanceAction({ params: { eventId, userId, registeredById } })

                if (!result.success) {
                    return {
                        success: false,
                        text: result.error
                            ? result.error.map(issue => issue.message).join('\n')
                            : 'Kunne ikke registrere oppmøte grunnet en ukjent feil.',
                    }
                }

                setCounts(result.data.counts)

                const { user, contact } = result.data.registration
                const name = user ? `${user.firstname} ${user.lastname}` : contact?.name ?? 'Ukjent'

                return {
                    success: true,
                    text: result.data.alreadyAttended
                        ? `${name} var allerede registrert`
                        : `${name} er registrert`,
                }
            }}
        />

        <p className={styles.lead}>
            Skann Omega-ID-en til de som kommer. Gjester uten Omega-ID, og rettelser, tar du i
            listen over påmeldte.
        </p>
    </div>
}
