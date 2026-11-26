'use client'
import { createContext } from 'react'
import type { ReactNode } from 'react'

/** The handle a section is dragged by, from whoever lays the sections out in an order. */
export const SectionHandleContext = createContext<ReactNode>(null)
