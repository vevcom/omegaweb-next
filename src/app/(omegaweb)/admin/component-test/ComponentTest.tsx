'use client'
import styles from './page.module.scss'
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
        <div className={styles.wrapper}>
            <h1>Komponenter</h1>
            <p>Et lite utvalg av komponenter som finnes på veven.</p>

            <section className={styles.section}>
                <h2>Buttons</h2>
                <div className={styles.row}>
                    <Button color="primary">Primary</Button>
                    <Button color="secondary">Secondary</Button>
                    <Button color="green">Green</Button>
                    <Button color="red">Red</Button>
                    <Button color="secondary" disabled>Disabled</Button>
                </div>
                <form className={styles.row}>
                    <SubmitButton color="primary" success={false}>Submit</SubmitButton>
                    <SubmitButton color="green" success={true}>Success</SubmitButton>
                </form>
            </section>

            <section className={styles.section}>
                <h2>Text inputs</h2>
                <div className={styles.row}>
                    {textInputColors.map(color => (
                        <TextInput key={color} name={`text_${color}`} label={color} color={color} />
                    ))}
                </div>
                <div className={styles.row}>
                    <Textarea name="textarea_demo" label="Textarea" />
                </div>
                <div className={styles.row}>
                    <DateInput name="date_demo" label="Date" />
                    <DateInput name="datetime_demo" label="Date and time" includeTime />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Checkbox and sliders</h2>
                <div className={styles.row}>
                    <Checkbox name="checkbox_demo_1" label="Unchecked" />
                    <Checkbox name="checkbox_demo_2" label="Checked" defaultChecked />
                    <Checkbox name="checkbox_demo_3" label="Disabled" disabled />
                </div>
                <div className={styles.row}>
                    {sliderColors.map(color => (
                        <Slider key={color} name={`slider_${color}`} label={color} color={color} />
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2>File input</h2>
                <div className={styles.row}>
                    {fileInputColors.map(color => (
                        <FileInput key={color} name={`file_${color}`} label={color} color={color} />
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2>Color input</h2>
                <div className={styles.row}>
                    <ColorInput name="color_demo" label="Farge" defaultValue="#037FFC" />
                    <ColorInput
                        name="color_rgb_demo"
                        label="Fra RGB"
                        defaultValueRGB={{ red: 92, green: 209, blue: 122 }}
                    />
                    <ColorInput name="color_disabled_demo" label="Disabled" defaultValue="#EB5757" disabled />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Dropdowns</h2>
                <div className={styles.row}>
                    <Dropdown name="dropdown_demo" label="Dropdown" options={dropdownOptions} />
                    <SearchableDropdown
                        name="searchable_dropdown_demo"
                        label="Searchable dropdown"
                        options={dropdownOptions}
                    />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Selects</h2>
                <div className={styles.row}>
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
                <div className={styles.row}>
                    <SelectNumber name="select_number_demo" label="Opptaksår" options={yearOptions} />
                    <SelectString
                        name="select_disabled_demo"
                        label="Disabled"
                        options={selectOptions}
                        disabled
                    />
                </div>
            </section>

            <section className={styles.section}>
                <h2>Progress bar</h2>
                <div className={styles.column}>
                    <ProgressBar progress={0.25} />
                    <ProgressBar progress={0.5} />
                    <ProgressBar progress={0.9} />
                </div>
            </section>
        </div>
    )
}
