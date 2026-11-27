import TextInput from './TextInput'
import type { PropTypes as TextInputPropTypes } from './TextInput'

export type PropTypes = Omit<TextInputPropTypes, 'type' | 'compact'>

/** A `TextInput` for a number, without the browser's own arrows to step it. */
export default function NumberInput(props: PropTypes) {
    return <TextInput {...props} type="number" />
}
