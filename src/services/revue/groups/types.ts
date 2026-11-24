import type { revueGroupOperations } from './operations'

export type RevueGroupsForNewRevue = Awaited<ReturnType<typeof revueGroupOperations.readManyForNewRevue>>
