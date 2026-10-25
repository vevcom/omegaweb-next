'use client'
import { createCabinProductAction } from '@/services/cabin/product/actions'
import Form from '@/app/_components/Form/Form'
import NumberInput from '@/app/_components/UI/NumberInput'
import TextInput from '@/app/_components/UI/TextInput'


export function UpdateCabinProductForm() {
    return <Form
        action={createCabinProductAction}
        submitText="Opprett nytt produkt"
    >
        <input type="hidden" name="type" value="BED" />
        <TextInput name="name" label="Produkt navn" />
        <NumberInput name="amount" label="Antall på hytta" defaultValue={1} />
    </Form>
}
