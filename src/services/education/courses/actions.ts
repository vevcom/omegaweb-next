'use server'
import { courseOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCourseAction = makeAction(courseOperations.create)
export const updateCourseAction = makeAction(courseOperations.update)
export const destroyCourseAction = makeAction(courseOperations.destroy)
