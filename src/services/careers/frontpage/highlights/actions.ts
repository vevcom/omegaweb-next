'use server'

import { makeAction } from '@/services/serverAction'
import { careerFrontpageHighlightOperations } from '@/services/careers/frontpage/highlights/operations'

export const createCareerFrontpageHighlightAction = makeAction(careerFrontpageHighlightOperations.create)

export const updateCareerFrontpageHighlightAction = makeAction(careerFrontpageHighlightOperations.update)

export const destroyCareerFrontpageHighlightAction = makeAction(careerFrontpageHighlightOperations.destroy)
