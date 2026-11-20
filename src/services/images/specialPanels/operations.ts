import '@ow-server-only'
import { flairImageCollection } from '@/services/flairs/flairImageCollection'
import { ombulCoverCollection } from '@/services/ombul/ombulCoverCollection'
import { committeeLogoCollection } from '@/services/groups/committees/committeeLogoCollection'
import { profileImageCollection } from '@/services/users/profileImageCollection'
import { standardImageCollection } from '@/services/images/standard/standardImageCollection'
import { promoImageCollection } from '@/services/promo/promoImageCollection'
import { careerTeamImageCollection } from '@/services/careers/team/persons/careerTeamImageCollection'
import { companyLogoCollection } from '@/services/careers/companies/companyLogoCollection'
import { chatProfileImageCollection } from '@/services/chat/users/chatProfileImageCollection'
import type { SpecialCollection } from '@/prisma-generated-pn-types'
import type { SpecialCollectionImplementation } from '@/services/images/subservice/special/implement'

/**
 * The special collections assembled, for what needs all of them: the seeder, and the image panels,
 * which let whoever passes a collection's panel auth look through its images and pick one for a
 * cms image. Uploading to one goes through the owning service's own collection.
 */
export const specialImagePanelOperations = {
    FLAIRIMAGES: flairImageCollection,
    OMBULCOVERS: ombulCoverCollection,
    COMMITTEELOGOS: committeeLogoCollection,
    PROFILEIMAGES: profileImageCollection,
    STANDARDIMAGES: standardImageCollection,
    PROMOIMAGES: promoImageCollection,
    CAREERTEAMIMAGES: careerTeamImageCollection,
    COMPANYLOGOS: companyLogoCollection,
    CHATPROFILEIMAGES: chatProfileImageCollection,
} as const satisfies Record<SpecialCollection, SpecialCollectionImplementation>
