import {
    createCareerFrontpageHighlightAction,
    destroyCareerFrontpageHighlightAction,
    updateCareerFrontpageHighlightAction,
} from './actions'
import { careerFrontpageHighlightContract } from '@/services/careers/frontpage/highlights/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const careerFrontpageHighlightCapabilities = defineCapabilities(careerFrontpageHighlightContract, {
    create: createCareerFrontpageHighlightAction,
    update: updateCareerFrontpageHighlightAction,
    destroy: destroyCareerFrontpageHighlightAction,
})
