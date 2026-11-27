import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'
import { eventKinds } from '@/services/events/kinds'
import { Require } from '@/auth/authorizer/Require'
import type { EventKind } from '@/prisma-generated-pn-types'

export const eventSlotAuth = {
    // Whether a slot is free tells no one who holds it.
    readOfVariant: canSeeEvent,
    readBoard: eventAdminLevel,
    readCompanySchedule: Require.companyMember().custom<{ kind: EventKind }>(
        ({ kind }) => eventKinds[kind].companySeesSchedule,
        { errorMessage: 'Bedriften ser ikke timeplanen til et arrangement av denne typen.' },
    ),
} as const
