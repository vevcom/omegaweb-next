
export default function RadioLarge<ValueType extends number | string>({
    name,
    options,
    defaultValue,
    value,
    onChange,
}: {
    name: string,
    defaultValue?: ValueType,
    value?: ValueType,
    onChange?: (newValue: ValueType) => unknown,
    options: {
        value: ValueType,
        label: string,
    }[]
}) {
    return <div className={[
        'flex flex-row m-[1rem] text-l',
        '[&>div>label]:p-[5px] [&>div>label]:border-3 [&>div>label]:border-[#ccc] [&_input[type=radio]]:hidden',
        '[&_input[type=radio]:checked+label]:border-accent-blue',
        '[&>div:first-child>label]:rounded-l-round [&>div:last-child>label]:rounded-r-round',
    ].join(' ')}>
        {options.map((option, i) => {
            const id = `${name}-${i}`
            return <div key={option.value}>
                <input
                    type="radio"
                    name={name}
                    id={id}
                    value={option.value}
                    checked={value === undefined ? undefined : value === option.value}
                    defaultChecked={(defaultValue === undefined) ? undefined : defaultValue === option.value}
                    onChange={() => {
                        if (onChange) {
                            onChange(option.value)
                        }
                    }}
                />
                <label htmlFor={id} >
                    {option.label}
                </label>
            </div>
        })}
    </div>
}
