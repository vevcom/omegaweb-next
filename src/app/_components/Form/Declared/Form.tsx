import SaveStatus from './SaveStatus'
import { makeSubmitter } from './Submitter'

/**
 * The declared form. `Form.Submitter` binds a capability in a `'use client'` file, and gives the
 * submitter and its field, which any component renders, also one on the server. The other parts
 * are placed inside any submitter.
 */
export const Form = {
    Submitter: makeSubmitter,
    SaveStatus,
}
