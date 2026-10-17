'use server'
import { makeAction } from '@/services/serverAction'
import { eventRegistrationOperations } from '@/services/events/registration/operations'

export const createEventRegistrationAction = makeAction(eventRegistrationOperations.create)
export const createEventRegistrationAsAdminAction = makeAction(eventRegistrationOperations.createAsAdmin)
export const createGuestEventRegistrationAction = makeAction(eventRegistrationOperations.createGuest)

export const readEventRegistrationsPageAction = makeAction(eventRegistrationOperations.readPage)
export const readDetailedEventRegistrationsPageAction = makeAction(eventRegistrationOperations.readPageDetailed)

export const updateEventRegistrationNotesAction = makeAction(eventRegistrationOperations.updateNotes)

export const registerEventAttendanceAction = makeAction(eventRegistrationOperations.registerAttendance)
export const setEventAttendanceAction = makeAction(eventRegistrationOperations.setAttendance)
export const destroyEventRegistrationAction = makeAction(eventRegistrationOperations.destroy)
export const createEventRegistrationPaymentAction = makeAction(eventRegistrationOperations.createPayment)

export const createEventDotAction = makeAction(eventRegistrationOperations.createDot)
export const createEventDotsForManyAction = makeAction(eventRegistrationOperations.createDotsForMany)
