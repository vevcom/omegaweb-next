'use client'
import { Form } from '@/components/Form/Declared/Form'
import { lockerLocationCapabilities } from '@/capabilities/lockers/locations/capabilities'

export const [CreateLockerLocationSubmitter, CreateLockerLocationField] = Form.Submitter({
    capability: lockerLocationCapabilities.create,
})

export const [UpdateLockerLocationSubmitter, UpdateLockerLocationField] = Form.Submitter({
    capability: lockerLocationCapabilities.update,
})

export const [DestroyLockerLocationSubmitter] = Form.Submitter({
    capability: lockerLocationCapabilities.destroy,
})
