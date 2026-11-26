import { makeSubmitter } from './Submitter'

/**
 * The declared form. `Form.Submitter` binds a capability in a `'use client'` file, and gives the
 * submitter and its field, which any component renders, also one on the server.
 */
export const Form = {
    Submitter: makeSubmitter,
}
