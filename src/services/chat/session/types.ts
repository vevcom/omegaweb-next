import type { chatSessionOperations } from './operations'

export type ChatSessionConfig = Awaited<ReturnType<typeof chatSessionOperations.read>>
