import '@pn-server-only'
import { isBuildPhase } from './isBuildPhase'
import Stripe from 'stripe'

// Stripe can only be initialized with a secret key on the server side.
// During the build phase, the stripe key might not be set.
// To avoid build-time errors, we skip the check during the build phase.
if (!process.env.STRIPE_SECRET_KEY && !isBuildPhase()) {
    throw new Error('Stripe secret key not set.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'fake-key', { telemetry: false })
