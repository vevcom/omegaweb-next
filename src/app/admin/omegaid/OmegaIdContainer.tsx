'use client'
import OmegaIdReader from '@/components/OmegaId/Reader/OmegaIdReader'


export default function OmegaIdContainer({
    publicKey,
}: {
    publicKey: string,
}) {
    return <OmegaIdReader
        publicKey={publicKey}
        successCallback={(userId) => Promise.resolve({
            success: true,
            text: `userID: ${userId}`,
        })}
    />
}
