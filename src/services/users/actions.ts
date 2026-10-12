'use server'
import { makeAction } from '@/services/serverAction'
import { userOperations } from '@/services/users/operations'

/**
 * A action that creates a user by the given data. It will also hash the password
 * @param rawdata - The user to create
 * @returns - The created user
 */
export const createUserAction = makeAction(userOperations.create)

/**
 * A action to read a page of users with the given details (filtering)
 * @param readPageInput - This is a) the page to read and b) the details to filter by like
 * name and groups
 * @returns
 */
export const readUserPageAction = makeAction(userOperations.readPage)

/**
 * updateUserAction is meant for admin updates while
 * updateUserProfileAction is meant for standard profile updates
 */
export const updateUserAction = makeAction(userOperations.update)
export const updateUserProfileAction = makeAction(userOperations.updateProfile)
export const updateUserProfileImageAction = makeAction(userOperations.updateProfileImage)
export const updateUserBioParagraphContentAction = makeAction(userOperations.updateBioParagraphContent)

export const registerNewEmailAction = makeAction(userOperations.registerNewEmail)
export const registerUserAction = makeAction(userOperations.register)

export const connectStudentCardAction = makeAction(userOperations.connectStudentCard)

export const searchUsersAction = makeAction(userOperations.search)
