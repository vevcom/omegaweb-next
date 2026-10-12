'use server'

import { committeeParticipationOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readAllCommitteeParticipationAction = makeAction(committeeParticipationOperations.readAll)
