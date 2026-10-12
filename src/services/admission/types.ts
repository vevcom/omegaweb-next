import type { AdmissionTrial } from '@/prisma-generated-pn-types'
import type { UserBasic } from '@/services/users/types'

export type ExpandedAdmissionTrail = AdmissionTrial & {
    user: UserBasic
}
