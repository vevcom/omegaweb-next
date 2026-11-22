import '@ow-server-only'
import { canSeeEvent } from './auth'
import { linkedEventSelection } from './constants'
import { passesVisibilityWhere } from '@/auth/visibility/passesVisibilityWhere'
import { ServiceError } from '@/services/error'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventAccess, LinkedEvent } from './types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { EventCanView, Prisma } from '@/prisma-generated-pn-types'

/** Reads what the rules of eventAuth need to know about an event, for `.data()`. */
export async function readEventAccess(prisma: PrismaPossibleTransaction<false>, eventId: number): Promise<EventAccess> {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
            published: true,
            canBeViewedBy: true,
            createdById: true,
            companyId: true,
            visibilityAdmin: { include: visibilityIncluder },
            variants: { select: { quotas: { select: { visibility: { include: visibilityIncluder } } } } },
        },
    })
    return {
        published: event.published,
        canBeViewedBy: event.canBeViewedBy,
        adminVisibility: toMatrix(event.visibilityAdmin),
        creatorId: event.createdById,
        quotaVisibilities: event.variants.flatMap(variant => variant.quotas.map(quota => toMatrix(quota.visibility))),
        companyId: event.companyId,
    }
}

/**
 * Whether a write of `companyId` puts a company on the event other than the one it has, for the
 * rules of eventAuth that write it. A new event, without `eventId`, has none.
 */
export async function setsCompany(
    prisma: PrismaPossibleTransaction<false>,
    companyId: number | null | undefined,
    eventId?: number,
): Promise<boolean> {
    if (companyId === null || companyId === undefined) return false
    if (eventId === undefined) return true
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { companyId: true } })
    return event.companyId !== companyId
}

/**
 * The `EventAccess` of the company presentation a write of `companyPresentationId` names, for the
 * rules of eventAuth that write it. Null when the write leaves the link or clears it. The one linked
 * already counts too, so that an id cannot be found by posting it as kept.
 */
export async function linksPresentation(
    prisma: PrismaPossibleTransaction<false>,
    companyPresentationId: number | null | undefined,
): Promise<EventAccess | null> {
    if (companyPresentationId === null || companyPresentationId === undefined) return null
    return await readEventAccess(prisma, companyPresentationId)
}

/**
 * The event linked to another, a presentation to its speed interview or the other way round, when
 * the session may see it. Null when there is none, and when the session may not see it, so that a
 * draft is not given away by the event it is linked to.
 */
export async function linkedEventSeenBy(
    prisma: PrismaPossibleTransaction<false>,
    session: SessionMaybeUser,
    linkedId: number | null,
): Promise<LinkedEvent | null> {
    if (linkedId === null) return null
    if (!canSeeEvent.data(await readEventAccess(prisma, linkedId)).auth(session).authorized) return null
    return await readLinkedEvent(prisma, linkedId)
}

/** The event linked to another, whoever asks. See `linkedEventSeenBy` for what may be shown. */
export async function readLinkedEvent(prisma: PrismaPossibleTransaction<false>, linkedId: number): Promise<LinkedEvent> {
    const { variants, ...linked } = await prisma.event.findUniqueOrThrow({
        where: { id: linkedId },
        select: linkedEventSelection,
    })
    return {
        ...linked,
        takesRegistration: variants.some(variant => variant.quotas.some(quota => quota.places > 0)),
    }
}

/** The event a variant belongs to. */
export async function readEventIdOfVariant(prisma: PrismaPossibleTransaction<false>, variantId: number): Promise<number> {
    const variant = await prisma.eventVariant.findUniqueOrThrow({
        where: { id: variantId },
        select: { eventId: true },
    })
    return variant.eventId
}

/** The event a quota belongs to, through its variant. */
export async function readEventIdOfQuota(prisma: PrismaPossibleTransaction<false>, quotaId: number): Promise<number> {
    const quota = await prisma.eventQuota.findUniqueOrThrow({
        where: { id: quotaId },
        select: { variant: { select: { eventId: true } } },
    })
    return quota.variant.eventId
}

/**
 * An event seen only by those who can register is seen through its quotas, so without any it is
 * seen by nobody but its administrators. A quota without places will do, which is how an event
 * for members only, without registration, is kept visible. Refused once the event is published,
 * or is about to be; a draft is still being set up.
 */
export async function assertSeenThroughQuotas(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    state?: { published: boolean },
) {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { published: true, canBeViewedBy: true },
    })
    if (!(state?.published ?? event.published) || event.canBeViewedBy !== 'CAN_REGISTER') return
    if (await prisma.eventQuota.count({ where: { variant: { eventId } } }) === 0) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Arrangementet er bare synlig for dem som kan melde seg på, så det må ha minst én kvote. '
            + 'En kvote uten plasser holder.'
        )
    }
}

/** What `whoCanRegisterWhere` reads of an event: its quotas with their visibilities. */
export const whoCanRegisterSelection = {
    canBeViewedBy: true,
    variants: { select: { quotas: { select: { visibility: { include: visibilityIncluder } } } } },
} as const satisfies Prisma.EventSelect

/**
 * The users who may register for the event, as a filter: those passing a quota. An event without
 * quotas is open to everyone when it is for all, and to nobody otherwise, since nobody but its
 * administrators sees it then.
 */
export function whoCanRegisterWhere(event: {
    canBeViewedBy: EventCanView,
    variants: { quotas: { visibility: Parameters<typeof passesVisibilityWhere>[0] }[] }[],
}): Prisma.UserWhereInput {
    const quotas = event.variants.flatMap(variant => variant.quotas)
    if (quotas.length === 0) return event.canBeViewedBy === 'ALL' ? {} : { id: { in: [] } }
    return { OR: quotas.map(quota => passesVisibilityWhere(quota.visibility)) }
}
