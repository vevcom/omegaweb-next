'use client'
import { Form } from '@/components/Form/Declared/Form'
import { careerFrontpageHighlightCapabilities } from '@/capabilities/careers/frontpage/highlights/capabilities'

export const [CreateHighlightSubmitter, CreateHighlightField] = Form.Submitter({
    capability: careerFrontpageHighlightCapabilities.create,
})

export const [UpdateHighlightSubmitter, UpdateHighlightField] = Form.Submitter({
    capability: careerFrontpageHighlightCapabilities.update,
})

export const [DestroyHighlightSubmitter] = Form.Submitter({
    capability: careerFrontpageHighlightCapabilities.destroy,
})
