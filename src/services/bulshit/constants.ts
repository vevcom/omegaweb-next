import { createSelection } from '@/services/createSelection'
import type { Bulshit } from '@/prisma-generated-pn-types'

export const bulshitFieldsToExpose = ['id', 'quote', 'timestamp'] as const satisfies (keyof Bulshit)[]
export const bulshitFilterSelection = createSelection([...bulshitFieldsToExpose])
