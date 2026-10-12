'use server'

import { stripeCustomerOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createStripeCustomerSessionAction = makeAction(stripeCustomerOperations.createSession)
export const createSetupIntentAction = makeAction(stripeCustomerOperations.createSetupIntent)
export const deleteSavedPaymentMethodAction = makeAction(stripeCustomerOperations.deleteSavedPaymentMethod)
