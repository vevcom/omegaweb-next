import { toVariantDrafts } from '@/components/Event/eventSetupDraft'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { QuotaDraft, VariantDraft } from '@/components/Event/eventSetupDraft'

/**
 * Saves the variants and quotas of an event the way its form does: all of them as they are, with
 * the change made to them. The session given saves, and no one in particular when it is left out.
 */
export async function changeEventSetup(
    eventId: number,
    change: (variants: VariantDraft[]) => void,
    session?: SessionMaybeUser,
) {
    const { variants } = await eventOperations.read({ params: { id: eventId }, bypassAuth: true })
    const drafts = toVariantDrafts(variants)
    change(drafts)
    return await eventOperations.saveSetup({
        params: { id: eventId },
        data: { variants: drafts },
        ...(session ? { session } : { bypassAuth: true }),
    })
}

/** The quota among the variants as the form holds them. */
export function quotaDraftOf(variants: VariantDraft[], quotaId: number): QuotaDraft {
    const quota = variants.flatMap(variant => variant.quotas).find(draft => draft.id === quotaId)
    if (!quota) throw new Error(`No quota ${quotaId} among the variants`)
    return quota
}

async function eventIdOfQuota(quotaId: number) {
    const quota = await prisma.eventQuota.findUniqueOrThrow({
        where: { id: quotaId },
        select: { variant: { select: { eventId: true } } },
    })
    return quota.variant.eventId
}

/** Gives a quota the places by saving the setup of its event. */
export async function setQuotaPlaces(quotaId: number, places: number, session?: SessionMaybeUser) {
    return await changeEventSetup(await eventIdOfQuota(quotaId), variants => {
        quotaDraftOf(variants, quotaId).places = places
    }, session)
}

/** Leaves a quota out of the setup of its event, which removes it. */
export async function removeQuota(quotaId: number) {
    return await changeEventSetup(await eventIdOfQuota(quotaId), variants => {
        variants.forEach(variant => {
            variant.quotas = variant.quotas.filter(quota => quota.id !== quotaId)
        })
    })
}
