'use server'

import { makeAction } from '@/services/serverAction'
import { admissionOperations } from '@/services/admission/operations'

export const createAdmissionTrialAction = makeAction(admissionOperations.createTrial)
