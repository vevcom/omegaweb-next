import { createSelection } from '@/services/createSelection'
import type { Bullshit } from '@/prisma-generated-pn-types'

export const bullshitFieldsToExpose = ['id', 'quote', 'timestamp'] as const satisfies (keyof Bullshit)[]
export const bullshitFilterSelection = createSelection([...bullshitFieldsToExpose])
