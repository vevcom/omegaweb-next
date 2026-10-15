'use client'
import { sendMailAction } from '@/services/notifications/sendMail/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'


export default function MailForm() {
    return <Form
        action={sendMailAction}
        submitText="Send elektronisk post"
        className="w-full"
        buttonClassName="max-w-[300px] w-full!"
    >
        <TextInput name="from" label="Avsender"/>
        <TextInput name="to" label="Mottaker"/>
        <TextInput name="subject" label="Emne"/>

        <Textarea name="text" label="Melding" className="max-h-[500px] h-[200px]"/>

    </Form>
}
