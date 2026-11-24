import type { revueGroupOperations } from './operations'

export type RevueGroupsToCarryOver = NonNullable<Awaited<ReturnType<typeof revueGroupOperations.readToCarryOver>>>
