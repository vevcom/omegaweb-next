import type { paymentIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedPayment = Prisma.PaymentGetPayload<{ include: typeof paymentIncluder }>
