import '@pn-server-only'
import { specialNotificationChannelAuth } from './auth'
import { notificationChannelOperations } from '@/services/notifications/channels/subservice/operations'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { newEventNotificationChannel } from '@/services/events/newEventNotificationChannel'
import {
    waitingListPromotionNotificationChannel
} from '@/services/events/registration/waitingListPromotionNotificationChannel'
import { newOmbulNotificationChannel } from '@/services/ombul/newOmbulNotificationChannel'
import { newNewsArticleNotificationChannel } from '@/services/news/newNewsArticleNotificationChannel'
import { newJobAdNotificationChannel } from '@/services/careers/jobAds/newJobAdNotificationChannel'
import { newOmegaquoteNotificationChannel } from '@/services/omegaquotes/newOmegaquoteNotificationChannel'
import { contactorNotificationChannel } from '@/services/careers/contactorNotificationChannel'
import type { SpecialNotificationChannel } from '@/prisma-generated-pn-types'
import type { SpecialNotificationChannelImplementation } from '@/services/notifications/channels/implementSpecial'

/**
 * The special channels assembled, for what needs all of them: the seeder, and the pages that show
 * the channel tree. Sending in one goes through the owning service's own implementation.
 */
export const specialNotificationChannelOperations = {
    readMany: notificationChannelOperations.readMany.implement({
        authorizer: () => specialNotificationChannelAuth.readMany,
        ownershipCheck: () => true,
        operationImplementationFields: { where: { purpose: 'SPECIAL' } },
    }),

    channels: {
        ROOT: rootNotificationChannel,
        NEW_EVENT: newEventNotificationChannel,
        NEW_OMBUL: newOmbulNotificationChannel,
        NEW_NEWS_ARTICLE: newNewsArticleNotificationChannel,
        NEW_JOBAD: newJobAdNotificationChannel,
        NEW_OMEGAQUOTE: newOmegaquoteNotificationChannel,
        EVENT_WAITINGLIST_PROMOTION: waitingListPromotionNotificationChannel,
        CONTACTOR: contactorNotificationChannel,
    } satisfies Record<SpecialNotificationChannel, SpecialNotificationChannelImplementation>,
} as const
