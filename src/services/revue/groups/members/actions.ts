'use server'
import { revueGroupMemberOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createRevueGroupMemberAction = makeAction(revueGroupMemberOperations.create)
export const updateRevueGroupMemberAction = makeAction(revueGroupMemberOperations.update)
export const destroyRevueGroupMemberAction = makeAction(revueGroupMemberOperations.destroy)
