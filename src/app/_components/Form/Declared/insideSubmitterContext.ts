'use client'
import { createContext } from 'react'

/** Whether a component is rendered inside a submitter, whichever submitter that is. */
export const InsideSubmitterContext = createContext(false)
