'use server'

import { makeAction } from '@/services/serverAction'
import { studyProgrammeOperations } from '@/services/groups/studyProgrammes/operations'

export const createStudyProgrammeAction = makeAction(studyProgrammeOperations.create)
export const updateStudyProgrammeAction = makeAction(studyProgrammeOperations.update)
export const addStudyProgrammeMembersAction = makeAction(studyProgrammeOperations.addMembers)
export const removeStudyProgrammeMembersAction = makeAction(studyProgrammeOperations.removeMembers)
