import type { chatUserOperations } from './operations'

export type ChatProfile = Awaited<ReturnType<typeof chatUserOperations.readProfiles>>[number]
