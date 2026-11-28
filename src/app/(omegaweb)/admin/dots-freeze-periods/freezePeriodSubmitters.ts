'use client'
import { Form } from '@/components/Form/Declared/Form'
import { dotFreezePeriodCapabilities } from '@/capabilities/dots/freezePeriods/capabilities'

export const [CreateFreezePeriodSubmitter, CreateFreezePeriodField] = Form.Submitter({
    capability: dotFreezePeriodCapabilities.create,
})

export const [UpdateFreezePeriodSubmitter, UpdateFreezePeriodField] = Form.Submitter({
    capability: dotFreezePeriodCapabilities.update,
})

export const [DestroyFreezePeriodSubmitter] = Form.Submitter({
    capability: dotFreezePeriodCapabilities.destroy,
})
