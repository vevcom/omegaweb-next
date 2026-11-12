'use client'

type Option<Value extends string> = {
    value: Value,
    title: string,
    /** A line saying what choosing it means. */
    hint: string,
    /** Why it cannot be chosen now, shown in place of the hint. */
    blocked?: string | null,
}

/**
 * A choice between a few options that each need a line of explanation: a row of cards with a
 * title and a hint, one of them chosen. An option that cannot be chosen says why.
 */
export default function OptionCards<Value extends string>({ options, value, onChange }: {
    options: Option<Value>[],
    value: Value,
    onChange: (value: Value) => void,
}) {
    return <div className="
        grid grid-cols-4 gap-2
        max-mobile:grid-cols-2
    ">
        {options.map(option => <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            disabled={Boolean(option.blocked)}
            onClick={() => onChange(option.value)}
            className={`
                flex flex-col gap-0.5 p-2.5 rounded-inner border text-left cursor-pointer bg-base-200
                disabled:cursor-not-allowed disabled:opacity-50
                ${value === option.value ? 'border-primary ring-1 ring-primary' : `
                    border-base-300
                    hover:bg-base-300
                `}
            `}
        >
            <span className="font-bold">{option.title}</span>
            <span className="text-s text-base-content/80">{option.blocked ?? option.hint}</span>
        </button>)}
    </div>
}
