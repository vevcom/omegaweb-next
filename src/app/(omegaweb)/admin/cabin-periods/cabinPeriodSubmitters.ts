'use client'
import { Form } from '@/components/Form/Declared/Form'
import { cabinPricePeriodCapabilities } from '@/capabilities/cabin/pricePeriod/capabilities'
import { cabinReleasePeriodCapabilities } from '@/capabilities/cabin/releasePeriod/capabilities'

export const [CreateReleasePeriodSubmitter, CreateReleasePeriodField] = Form.Submitter({
    capability: cabinReleasePeriodCapabilities.create,
})

export const [UpdateReleasePeriodSubmitter, UpdateReleasePeriodField] = Form.Submitter({
    capability: cabinReleasePeriodCapabilities.update,
})

export const [DestroyReleasePeriodSubmitter] = Form.Submitter({
    capability: cabinReleasePeriodCapabilities.destroy,
})

export const [CreatePricePeriodSubmitter, CreatePricePeriodField] = Form.Submitter({
    capability: cabinPricePeriodCapabilities.create,
})

export const [UpdatePricePeriodSubmitter, UpdatePricePeriodField] = Form.Submitter({
    capability: cabinPricePeriodCapabilities.update,
})

export const [DestroyPricePeriodSubmitter] = Form.Submitter({
    capability: cabinPricePeriodCapabilities.destroy,
})
