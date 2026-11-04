'use client'
import { createUserAction } from '@/services/users/actions'
import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import React from 'react'
import { useRouter } from 'next/navigation'

type PropTypes = {
    className?: string
}

export default function CreateUserForm({ className }: PropTypes) {
    const { refresh } = useRouter()

    return (
        <div className={`
            ${'w-full'}
            ${className}
        `}>
            <Form
                title="Lag en bruker"
                submitText="Lag bruker"
                action={createUserAction}
                successCallback={refresh}
            >
                <TextInput label="E-post" name="email"/>
                <TextInput label="Brukernavn" name="username"/>
                <TextInput label="Fornavn" name="firstname"/>
                <TextInput label="Etternavn" name="lastname"/>
                <p>Når en bruker opprettes, får brukeren tilsendt en e-post med en lenke for å fullføre registreringen.</p>
            </Form>
        </div>
    )
}
