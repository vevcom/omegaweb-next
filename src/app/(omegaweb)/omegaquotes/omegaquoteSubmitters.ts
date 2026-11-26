'use client'
import { Form } from '@/components/Form/Declared/Form'
import { omegaquoteCapabilities } from '@/capabilities/omegaquotes/capabilities'

export const [CreateQuoteSubmitter, CreateQuoteField] = Form.Submitter({ capability: omegaquoteCapabilities.create })
