'use client'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'

type PropTypes = {
    name: string
}

/**
 * This is a checkbox that is always checked with is appended to a form to represent that a field with
 * a name is present in a from.
 * Chackboxes will not submit any value if they are not checked, so this is a way to submit a value
 * so thay can be differentiated from not being present.
 * @returns
 */
export default function CheckboxFieldPresent({ name }: PropTypes) {
    return (
        <input
            type="checkbox"
            name={name}
            value={FIELD_IS_PRESENT_VALUE}
            checked={true}
            readOnly
            className="hidden"
        />
    )
}
