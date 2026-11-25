'use client'
import Form from '@/components/Form/Form'
import Slider from '@/components/UI/Slider'
import type { ReactNode } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { MailAddress } from '@/prisma-generated-pn-types'

type PropTypes = {
    /** The forwarding operation of the service that has the address, with its params filled in. */
    action: ActionFormData<MailAddress>,
    forwardsToPrivateEmail: boolean,
    /** What forwarding means for this address. */
    children: ReactNode,
}

/** Whether mail to an address of ours is also sent on to the private email of those behind it. */
export default function MailForwardingForm({ action, forwardsToPrivateEmail, children }: PropTypes) {
    return <Form title="Videresending" submitText="Lagre" action={action} refreshOnSuccess>
        {children}
        <Slider
            label="Videresend til privat e-post"
            name="forwardsToPrivateEmail"
            defaultChecked={forwardsToPrivateEmail}
        />
    </Form>
}
