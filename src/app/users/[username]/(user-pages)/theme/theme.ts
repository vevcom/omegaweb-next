export enum ThemeName {
    Standard = 'Standard',
    Light = 'Light',
    Solarized = 'Solarized',
    StjerneInnbygger = 'StjerneInnbygger',
    HotDogStand = 'Pølsebod',
    owBasic = 'Alt var bedre før',
}

type ThemeColors = {
    layer: string;
    text: string;
    'text-muted': string;
    'surface-base': string;
    'surface-raised': string;
    'surface-hover': string;
    'surface-subtle': string;
    'ink-hover': string;
    'ink-strong': string;
    'accent-red': string;
    'accent-orange': string;
    'accent-yellow': string;
    'accent-green': string;
    'accent-cyan': string;
    'accent-blue': string;
    'accent-magenta': string;
    'accent-violet': string;
};

export const themes: Record<ThemeName, ThemeColors> = {
    [ThemeName.Standard]: {
        layer: 'hsla(210, 0%, 0%, 0.2)',
        text: 'hsl(0, 0%, 80%)',
        'text-muted': 'hsl(0, 0%, 70%)',
        'surface-base': 'hsl(240, 8%, 8%)',
        'surface-raised': 'hsl(240, 6%, 12%)',
        'surface-hover': 'hsl(210, 8%, 18%)',
        'surface-subtle': 'hsl(210, 8%, 35%)',
        'ink-hover': 'hsl(210, 8%, 65%)',
        'ink-strong': 'hsl(210, 8%, 75%)',
        'accent-red': 'hsl(0, 80%, 60%)',
        'accent-orange': 'hsl(40, 80%, 60%)',
        'accent-yellow': 'hsl(60, 80%, 60%)',
        'accent-green': 'hsl(120, 80%, 60%)',
        'accent-cyan': 'hsl(180, 80%, 60%)',
        'accent-blue': 'hsl(210, 70%, 50%)',
        'accent-magenta': 'hsl(300, 80%, 60%)',
        'accent-violet': 'hsl(260, 80%, 60%)',
    },
    [ThemeName.Light]: {
        layer: 'hsla(0, 0%, 0%, 0.05)',
        text: 'hsl(0, 0%, 10%)',
        'text-muted': 'hsl(0, 0%, 20%)',
        'surface-base': 'hsl(210, 18%, 97%)',
        'surface-raised': 'hsl(0, 0%, 100%)',
        'surface-hover': 'hsl(210, 30%, 90%)',
        'surface-subtle': 'hsl(210, 10%, 80%)',
        'ink-hover': 'hsl(210, 8%, 25%)',
        'ink-strong': 'hsl(210, 8%, 10%)',
        'accent-red': 'hsl(0, 70%, 45%)',
        'accent-orange': 'hsl(40, 70%, 40%)',
        'accent-yellow': 'hsl(50, 80%, 35%)',
        'accent-green': 'hsl(120, 60%, 32%)',
        'accent-cyan': 'hsl(185, 70%, 32%)',
        'accent-blue': 'hsl(210, 98%, 50%)',
        'accent-magenta': 'hsl(300, 60%, 40%)',
        'accent-violet': 'hsl(260, 55%, 45%)',
    },
    [ThemeName.Solarized]: {
        layer: 'hsla(0, 0%, 50%, 0.15)',
        text: 'hsl(196, 13%, 45%)',
        'text-muted': 'hsl(180, 7%, 60%)',
        'surface-base': 'hsl(44, 87%, 94%)',
        'surface-raised': 'hsl(44, 60%, 98%)',
        'surface-hover': 'hsl(44, 50%, 88%)',
        'surface-subtle': 'hsl(45, 20%, 75%)',
        'ink-hover': 'hsl(196, 13%, 35%)',
        'ink-strong': 'hsl(196, 20%, 20%)',
        'accent-red': 'hsl(1, 71%, 52%)',
        'accent-orange': 'hsl(18, 89%, 44%)',
        'accent-yellow': 'hsl(45, 100%, 35%)',
        'accent-green': 'hsl(68, 100%, 30%)',
        'accent-cyan': 'hsl(175, 59%, 40%)',
        'accent-blue': 'hsl(210, 98%, 50%)',
        'accent-magenta': 'hsl(331, 64%, 52%)',
        'accent-violet': 'hsl(237, 43%, 60%)',
    },
    [ThemeName.StjerneInnbygger]: {
        layer: 'hsla(211, 48.1%, 35.5%, 0.18)',
        text: 'hsl(0, 0%, 80%)',
        'text-muted': 'hsl(0, 0%, 70%)',
        'surface-base': 'hsl(202, 64%, 8%)',
        'surface-raised': 'hsl(202, 50%, 13%)',
        'surface-hover': 'hsl(205, 40%, 20%)',
        'surface-subtle': 'hsl(205, 30%, 35%)',
        'ink-hover': 'hsl(205, 15%, 65%)',
        'ink-strong': 'hsl(205, 15%, 78%)',
        'accent-red': 'hsl(0, 80%, 60%)',
        'accent-orange': 'hsl(40, 80%, 60%)',
        'accent-yellow': 'hsl(60, 80%, 60%)',
        'accent-green': 'hsl(120, 80%, 60%)',
        'accent-cyan': 'hsl(180, 80%, 60%)',
        'accent-blue': 'hsl(207, 91%, 65%)',
        'accent-magenta': 'hsl(300, 80%, 60%)',
        'accent-violet': 'hsl(260, 80%, 60%)',
    },
    [ThemeName.owBasic]: {
        layer: '#f7f8fa',
        text: '#1c1c1c',
        'text-muted': 'hsl(0, 0%, 20%)',
        'surface-base': '#ffffff',
        'surface-raised': '#f7f8fa',
        'surface-hover': '#ffd600',
        'surface-subtle': 'hsl(210, 10%, 80%)',
        'ink-hover': '#1c1c1c',
        'ink-strong': '#1c1c1c',
        'accent-red': 'hsl(0, 70%, 45%)',
        'accent-orange': 'hsl(40, 70%, 40%)',
        'accent-yellow': 'hsl(50, 80%, 35%)',
        'accent-green': 'hsl(120, 60%, 32%)',
        'accent-cyan': 'hsl(185, 70%, 32%)',
        'accent-blue': '#ffd600',
        'accent-magenta': '#556a82',
        'accent-violet': '#556a82',
    },
    [ThemeName.HotDogStand]: {
        layer: 'hsl(0, 100%, 50%)',
        text: 'hsl(0, 0%, 100%)',
        'text-muted': 'hsl(0, 0%, 100%)',
        'surface-base': 'hsl(0, 100%, 50%)',
        'surface-raised': 'hsl(0, 100%, 50%)',
        'surface-hover': 'hsl(0, 100%, 50%)',
        'surface-subtle': 'hsl(0, 100%, 50%)',
        'ink-hover': 'hsl(0, 0%, 100%)',
        'ink-strong': 'hsl(0, 0%, 100%)',
        'accent-red': 'hsl(0, 80%, 60%)',
        'accent-orange': 'hsl(60, 100%, 50%)',
        'accent-yellow': 'hsl(60, 100%, 50%)',
        'accent-green': 'hsl(60, 100%, 50%)',
        'accent-cyan': 'hsl(60, 100%, 50%)',
        'accent-blue': 'hsl(60, 100%, 50%)',
        'accent-magenta': 'hsl(60, 100%, 50%)',
        'accent-violet': 'hsl(60, 100%, 50%)',
    },
}

const themeListeners = new Set<() => void>()

export function applyTheme(name: ThemeName): void {
    localStorage.setItem('theme', name)
    const colors = themes[name]
    const root = document.documentElement
    // Keeps the Android/desktop browser chrome in step with the theme. The meta
    // itself comes from the viewport export in layout.tsx; without that there is
    // no node here to update.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors['surface-base'])
    Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value)
    })
    themeListeners.forEach(listener => listener())
}

export function subscribeToTheme(listener: () => void): () => void {
    themeListeners.add(listener)
    return () => themeListeners.delete(listener)
}

export function getActiveTheme(): ThemeName | null {
    return localStorage.getItem('theme') as ThemeName | null
}

export function getServerActiveTheme(): ThemeName | null {
    return null
}
