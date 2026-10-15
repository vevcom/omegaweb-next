'use client'
import Button from '@/components/UI/Button'
import SubmitButton from '@/components/UI/SubmitButton'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import Checkbox from '@/components/UI/Checkbox'
import DateInput from '@/components/UI/DateInput'
import Slider from '@/components/UI/Slider'
import FileInput from '@/components/UI/FileInput'
import Dropdown from '@/components/UI/Dropdown'
import SearchableDropdown from '@/components/UI/SearchableDropdown'
import ColorInput from '@/components/UI/ColorInput'
import { SelectString, SelectNumber } from '@/components/UI/Select'
import ProgressBar from '@/components/ProgressBar/ProgressBar'

const textInputColors = ['primary', 'secondary', 'red', 'black', 'white'] as const
const sliderColors = ['primary', 'secondary', 'red', 'black', 'white'] as const
const fileInputColors = ['primary', 'secondary', 'red', 'black', 'white'] as const
const selectColors = ['primary', 'secondary', 'red', 'black', 'white'] as const

const dropdownOptions = [
    { value: 'ntnu', label: 'NTNU' },
    { value: 'ntb', label: 'NTB' },
    { value: 'komite', label: 'Komité' },
    { value: 'styret', label: 'Styret' },
]

const selectOptions = dropdownOptions.map(option => ({ ...option, key: option.value }))

const yearOptions = [2020, 2021, 2022, 2023].map(year => ({ value: year, key: String(year) }))

export default function ComponentTest() {
    return (
        <div className="p-4 flex flex-col gap-4 [&>p]:text-text-muted">
            <h1>Komponenter</h1>
            <p>Et lite utvalg av komponenter som finnes på veven.</p>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Buttons</h2>
                <div className="flex flex-wrap items-start gap-4">
                    <Button color="primary">Primary</Button>
                    <Button color="secondary">Secondary</Button>
                    <Button color="green">Green</Button>
                    <Button color="red">Red</Button>
                    <Button color="secondary" disabled>Disabled</Button>
                </div>
                <form className="flex flex-wrap items-start gap-4">
                    <SubmitButton color="primary" success={false}>Submit</SubmitButton>
                    <SubmitButton color="green" success={true}>Success</SubmitButton>
                </form>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Text inputs</h2>
                <div className="flex flex-wrap items-start gap-4">
                    {textInputColors.map(color => (
                        <TextInput key={color} name={`text_${color}`} label={color} color={color} />
                    ))}
                </div>
                <div className="flex flex-wrap items-start gap-4">
                    <Textarea name="textarea_demo" label="Textarea" />
                </div>
                <div className="flex flex-wrap items-start gap-4">
                    <DateInput name="date_demo" label="Date" />
                    <DateInput name="datetime_demo" label="Date and time" includeTime />
                </div>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Checkbox and sliders</h2>
                <div className="flex flex-wrap items-start gap-4">
                    <Checkbox name="checkbox_demo_1" label="Unchecked" />
                    <Checkbox name="checkbox_demo_2" label="Checked" defaultChecked />
                    <Checkbox name="checkbox_demo_3" label="Disabled" disabled />
                </div>
                <div className="flex flex-wrap items-start gap-4">
                    {sliderColors.map(color => (
                        <Slider key={color} name={`slider_${color}`} label={color} color={color} />
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>File input</h2>
                <div className="flex flex-wrap items-start gap-4">
                    {fileInputColors.map(color => (
                        <FileInput key={color} name={`file_${color}`} label={color} color={color} />
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Color input</h2>
                <div className="flex flex-wrap items-start gap-4">
                    <ColorInput name="color_demo" label="Farge" defaultValue="#037FFC" />
                    <ColorInput
                        name="color_rgb_demo"
                        label="Fra RGB"
                        defaultValueRGB={{ red: 92, green: 209, blue: 122 }}
                    />
                    <ColorInput name="color_disabled_demo" label="Disabled" defaultValue="#EB5757" disabled />
                </div>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Dropdowns</h2>
                <div className="flex flex-wrap items-start gap-4">
                    <Dropdown name="dropdown_demo" label="Dropdown" options={dropdownOptions} />
                    <SearchableDropdown
                        name="searchable_dropdown_demo"
                        label="Searchable dropdown"
                        options={dropdownOptions}
                    />
                </div>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Selects</h2>
                <div className="flex flex-wrap items-start gap-4">
                    {selectColors.map(color => (
                        <SelectString
                            key={color}
                            name={`select_${color}`}
                            label={color}
                            color={color}
                            options={selectOptions}
                        />
                    ))}
                </div>
                <div className="flex flex-wrap items-start gap-4">
                    <SelectNumber name="select_number_demo" label="Opptaksår" options={yearOptions} />
                    <SelectString
                        name="select_disabled_demo"
                        label="Disabled"
                        options={selectOptions}
                        disabled
                    />
                </div>
            </section>

            <section className="flex flex-col gap-2 pb-4 border-b border-surface-subtle last:border-b-0">
                <h2>Progress bar</h2>
                <div className="flex flex-col gap-2 max-w-120">
                    <ProgressBar progress={0.25} />
                    <ProgressBar progress={0.5} />
                    <ProgressBar progress={0.9} />
                </div>
            </section>
        </div>
    )
}
