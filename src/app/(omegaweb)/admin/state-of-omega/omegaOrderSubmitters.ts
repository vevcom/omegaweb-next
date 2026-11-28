'use client'
import { Form } from '@/components/Form/Declared/Form'
import { omegaOrderCapabilities } from '@/capabilities/omegaOrder/capabilities'

export const [CreateOmegaOrderSubmitter] = Form.Submitter({
    capability: omegaOrderCapabilities.create,
})
