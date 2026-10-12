'use server'

import { makeAction } from '@/services/serverAction'
import { eventOperations } from '@/services/events/operations'

export const createEventAction = makeAction(eventOperations.create)

export const destroyEventAction = makeAction(eventOperations.destroy)

export const readArchivedEventsPageAction = makeAction(eventOperations.readManyArchivedPage)

export const updateEventAction = makeAction(eventOperations.update)
export const setEventPublishedAction = makeAction(eventOperations.setPublished)
export const updateEventParagraphContentAction = makeAction(eventOperations.updateParagraphContent)
export const updateEventCmsCoverImageAction = makeAction(eventOperations.updateCmsCoverImage)

export const updateEventRegularLevelVisibilityAction = makeAction(eventOperations.visibility.updateRegularLevel)
export const updateEventAdminLevelVisibilityAction = makeAction(eventOperations.visibility.updateAdminLevel)

export const searchEventsAction = makeAction(eventOperations.search)
