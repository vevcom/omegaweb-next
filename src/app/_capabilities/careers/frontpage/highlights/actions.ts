'use server'
import { careerFrontpageHighlightOperations } from '@/services/careers/frontpage/highlights/operations'
import { makeAction } from '@/services/serverAction'

export const createCareerFrontpageHighlightAction = makeAction(careerFrontpageHighlightOperations.create)
export const updateCareerFrontpageHighlightAction = makeAction(careerFrontpageHighlightOperations.update)
export const destroyCareerFrontpageHighlightAction = makeAction(careerFrontpageHighlightOperations.destroy)
