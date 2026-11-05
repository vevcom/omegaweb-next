import '@pn-server-only'
import { specialNotificationAuth } from './auth'
import { notificationOperations } from '@/services/notifications/subservice/operations'
import { rootNotificationChannel } from '@/services/notifications/subservice/special/implement'
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
import type { SpecialNotificationChannelImplementation } from '@/services/notifications/subservice/special/implement'

/**
 * The special channels assembled, for what needs all of them: the seeder, and the pages that show
 * the channel tree. Sending in one goes through the owning service's own implementation.
 */
export const specialNotificationOperations = {
    readManyChannels: notificationOperations.readManyChannels.implement({
        authorizer: () => specialNotificationAuth.readManyChannels,
        ownershipCheck: () => true,
        operationImplementationFields: { where: { special: { not: null } } },
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
