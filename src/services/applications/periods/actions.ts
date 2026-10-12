'use server'

import { makeAction } from '@/services/serverAction'
import { applicationPeriodOperations } from '@/services/applications/periods/operations'

export const createApplicationPeriodAction = makeAction(applicationPeriodOperations.create)

export const destroyApplicationPeriodAction = makeAction(applicationPeriodOperations.destroy)
export const removeAllApplicationTextsAction = makeAction(applicationPeriodOperations.removeAllApplicationTexts)

export const readNumberOfApplicationsAction = makeAction(applicationPeriodOperations.readNumberOfApplications)

export const updateApplicationPeriodAction = makeAction(applicationPeriodOperations.update)
