'use server'
import { omegaIdOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const generateOmegaIdAction = makeAction(omegaIdOperations.generate)
