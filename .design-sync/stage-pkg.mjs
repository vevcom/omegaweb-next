#!/usr/bin/env node
// Builds a self-contained, bundlable component package out of this Next.js
// app's presentational components, for the claude.ai/design import.
//
// Why this exists: omegaweb-next has no library build, and every component
// styles itself through SCSS modules (`*.module.scss`), which esbuild cannot
// load. This script performs a *mechanical* transform of the real source:
//
//   1. transitively collects each scoped component's repo-internal imports
//   2. compiles every `*.module.scss` to `*.module.css` with sass (resolving
//      the `@/styles` alias), so esbuild's native CSS-modules support keeps
//      the class-name map intact
//   3. rewrites import specifiers to the staged layout, swapping `next/link`
//      and `next/navigation` for tiny DOM shims
//   4. emits an `index.ts` barrel + `package.json` so the converter sees an
//      ordinary package
//
// Component bodies are copied verbatim apart from import specifiers. Nothing
// here reimplements a component.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as sass from 'sass'

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT = join(REPO, '.design-sync/.cache/pkg')
const SCOPE = JSON.parse(readFileSync(join(REPO, '.design-sync/scope.json'), 'utf8')).components

const TS_EXT = ['.tsx', '.ts', '.jsx', '.js']
const STYLE_RX = /\.(module\.)?s?css$/

// The app's four themes live here and are applied at runtime by setting the
// custom properties on documentElement (see ThemeEnabler).
const THEME_SRC = 'src/app/users/[username]/(user-admin)/theme/theme.ts'

// tsconfig `paths`, longest prefix first so `@/components/*` beats `@/*`.
const ALIASES = (() => {
    const raw = JSON.parse(
        readFileSync(join(REPO, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
    ).compilerOptions.paths
    return Object.entries(raw)
        .map(([pattern, targets]) => ({
            prefix: pattern.replace(/\*$/, ''),
            wild: pattern.endsWith('*'),
            targets: targets.map(t => join(REPO, t.replace(/\*$/, '').replace(/^\.\//, ''))),
        }))
        .sort((left, right) => right.prefix.length - left.prefix.length)
})()

// Bare specifiers we redirect to a local shim. The design agent builds plain
// React, so Next's router-coupled primitives have no runtime here.
const SHIMS = {
    'next/link': '_shims/Link',
    'next/navigation': '_shims/navigation',
    'next/image': '_shims/Image',
}

const problems = []

function resolveSpecifier(spec, importerAbs) {
    if (SHIMS[spec]) return { kind: 'shim', shim: SHIMS[spec] }

    let base = null
    if (spec.startsWith('.')) {
        base = resolve(dirname(importerAbs), spec)
    } else {
        for (const alias of ALIASES) {
            if (alias.wild ? !spec.startsWith(alias.prefix) : spec !== alias.prefix) continue
            const tail = alias.wild ? spec.slice(alias.prefix.length) : ''
            for (const target of alias.targets) {
                const candidate = join(target, tail)
                const hit = probe(candidate)
                if (hit) return { kind: 'file', file: hit }
            }
            base = join(alias.targets[0], tail)
            break
        }
    }
    if (base === null) return { kind: 'external' }

    const hit = probe(base)
    if (hit) return { kind: 'file', file: hit }
    problems.push(`unresolved: ${spec}  (from ${relative(REPO, importerAbs)})`)
    return { kind: 'external' }
}

function probe(base) {
    if (STYLE_RX.test(base) && existsSync(base)) return base
    for (const ext of ['', ...TS_EXT]) {
        if (ext && existsSync(base + ext)) return base + ext
        if (!ext && existsSync(base) && /\.\w+$/.test(base)) return base
    }
    for (const ext of TS_EXT) {
        const indexed = join(base, `index${ext}`)
        if (existsSync(indexed)) return indexed
    }
    return null
}

// `import x from 's'`, `export * from 's'`, `import('s')` — one pass, capturing
// the quoted specifier so we can rewrite it in place.
const SPEC_RX = /(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"]+)\2/g

function specifiersIn(text) {
    const found = []
    for (const match of text.matchAll(SPEC_RX)) found.push(match[3])
    return found
}

// ── 1. Transitive closure over repo-internal files ──────────────────────────

const componentFiles = new Map() // abs tsx path -> group
for (const [name, meta] of Object.entries(SCOPE)) {
    const abs = join(REPO, meta.src)
    if (!existsSync(abs)) throw new Error(`scope.json: ${name} -> ${meta.src} does not exist`)
    const prior = componentFiles.get(abs)
    if (prior && prior !== meta.group) {
        throw new Error(`${meta.src} is claimed by two groups (${prior}, ${meta.group})`)
    }
    componentFiles.set(abs, meta.group)
}

const staged = new Map() // abs source path -> staged path relative to OUT
const queue = [...componentFiles.keys()]
const seen = new Set(queue)

function stagedPathFor(abs) {
    const group = componentFiles.get(abs)
    const base = abs.split('/').pop()
    if (group) return `src/${group}/${base}`
    // Everything else mirrors its repo path under _internal/ so two files
    // with the same basename can never collide.
    return `src/_internal/${relative(join(REPO, 'src'), abs)}`
}

while (queue.length) {
    const abs = queue.shift()
    staged.set(abs, stagedPathFor(abs))
    if (STYLE_RX.test(abs)) continue
    for (const spec of specifiersIn(readFileSync(abs, 'utf8'))) {
        const resolved = resolveSpecifier(spec, abs)
        if (resolved.kind !== 'file') continue
        if (seen.has(resolved.file)) continue
        seen.add(resolved.file)
        queue.push(resolved.file)
    }
}

// ── 2. Emit ─────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true })

function write(relPath, content) {
    const dest = join(OUT, relPath)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, content)
}

// The `@/…` alias resolver for sass, mirroring tsconfig paths.
const scssImporter = {
    findFileUrl(url) {
        if (!url.startsWith('@/')) return null
        for (const alias of ALIASES) {
            if (alias.wild ? !url.startsWith(alias.prefix) : url !== alias.prefix) continue
            const tail = alias.wild ? url.slice(alias.prefix.length) : ''
            return pathToFileURL(join(alias.targets[0], tail))
        }
        return null
    },
}

function compileScss(abs) {
    return sass.compile(abs, {
        importers: [scssImporter],
        loadPaths: [join(REPO, 'src/styles'), join(REPO, 'src')],
        silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
    }).css
}

let styleCount = 0
for (const [abs, relPath] of staged) {
    if (STYLE_RX.test(abs)) {
        // SCSS modules become plain `.module.css`; esbuild scopes them natively.
        // Each one `@use`s the shared `ohma` module, so sass re-emits the whole
        // @font-face block into every single file (with the app's runtime
        // `/fonts/…` urls, which resolve to nothing in a bundle). The canonical
        // copy lives in styles/globals.css — drop the duplicates.
        const css = compileScss(abs).replace(/@font-face\s*\{[^}]*\}\s*/g, '')
        write(relPath.replace(/\.module\.scss$/, '.module.css').replace(/\.scss$/, '.css'), css)
        styleCount++
        continue
    }

    const text = readFileSync(abs, 'utf8')
    const here = join(OUT, relPath)
    const rewritten = text.replace(SPEC_RX, (whole, lead, quote, spec) => {
        const resolved = resolveSpecifier(spec, abs)
        let target
        if (resolved.kind === 'shim') {
            target = join(OUT, 'src', resolved.shim)
        } else if (resolved.kind === 'file') {
            const dest = staged.get(resolved.file)
            if (!dest) return whole
            target = join(OUT, dest)
                .replace(/\.module\.scss$/, '.module.css')
                .replace(/\.(tsx|ts|jsx|js)$/, '')
        } else {
            return whole
        }
        let rel = relative(dirname(here), target)
        if (!rel.startsWith('.')) rel = `./${rel}`
        return `${lead}${quote}${rel}${quote}`
    })
    // 'use client' is a Next directive; harmless but noisy in a plain bundle.
    write(relPath, rewritten.replace(/^\s*'use client'\r?\n/, ''))
}

// ── 3. Shims ────────────────────────────────────────────────────────────────

write('src/_shims/Link.tsx', `import React from 'react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname?: string },
    children?: ReactNode,
    prefetch?: boolean,
    replace?: boolean,
    scroll?: boolean,
}

/** Stands in for next/link outside a Next app: renders the same anchor. */
export default function Link({ href, children, prefetch, replace, scroll, ...props }: LinkProps) {
    const resolved = typeof href === 'string' ? href : (href?.pathname ?? '#')
    return <a href={resolved} {...props}>{children}</a>
}
`)

write('src/_shims/navigation.ts', `// Stands in for next/navigation outside a Next app.
export function usePathname(): string {
    return typeof window === 'undefined' ? '/' : window.location.pathname
}
export function useSearchParams(): URLSearchParams {
    return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
}
export function useRouter() {
    return {
        push: (href: string) => { if (typeof window !== 'undefined') window.location.assign(href) },
        replace: (href: string) => { if (typeof window !== 'undefined') window.location.replace(href) },
        back: () => { if (typeof window !== 'undefined') window.history.back() },
        forward: () => { if (typeof window !== 'undefined') window.history.forward() },
        refresh: () => {},
        prefetch: () => {},
    }
}
`)

write('src/_shims/Image.tsx', `import React from 'react'
import type { ImgHTMLAttributes } from 'react'

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
    src: string,
    alt: string,
    width?: number,
    height?: number,
    fill?: boolean,
    priority?: boolean,
}

/** Stands in for next/image outside a Next app: a plain img. */
export default function Image({ fill, priority, style, ...props }: ImageProps) {
    return <img {...props} style={fill ? { ...style, width: '100%', height: '100%', objectFit: 'cover' } : style} />
}
`)

// ── 3b. Combined provider ───────────────────────────────────────────────────
// Several components read app-level React context (PopUp teleporting, page
// title, edit mode). `cfg.provider` needs ONE bundle export to wrap previews
// in, so nest the app's real providers here rather than reimplementing them.

const providerImports = [
    ['PopUpProvider', 'src/contexts/PopUp.tsx', 'default'],
    ['PageTitleProvider', 'src/contexts/PageTitle.tsx', 'PageTitleProvider'],
    ['EditModeProvider', 'src/contexts/EditMode.tsx', 'default'],
]
const providerBody = providerImports
    .map(([local, src, binding]) => {
        const abs = join(REPO, src)
        if (!staged.has(abs)) {
            // Not pulled in by any scoped component — stage it just for this.
            staged.set(abs, stagedPathFor(abs))
            const text = readFileSync(abs, 'utf8')
            const here = join(OUT, staged.get(abs))
            const rewritten = text.replace(SPEC_RX, (whole, lead, quote, spec) => {
                const resolved = resolveSpecifier(spec, abs)
                if (resolved.kind !== 'file') return whole
                const dest = staged.get(resolved.file)
                if (!dest) return whole
                let rel = relative(dirname(here), join(OUT, dest).replace(/\.(tsx|ts|jsx|js)$/, ''))
                if (!rel.startsWith('.')) rel = `./${rel}`
                return `${lead}${quote}${rel}${quote}`
            })
            write(staged.get(abs), rewritten.replace(/^\s*'use client'\r?\n/, ''))
        }
        const modPath = relative(join(OUT, 'src/_shims'), join(OUT, staged.get(abs))).replace(/\.(tsx|ts)$/, '')
        const spec = modPath.startsWith('.') ? modPath : `./${modPath}`
        return binding === 'default'
            ? `import ${local} from '${spec}'`
            : `import { ${local} } from '${spec}'`
    })
    .join('\n')

write('src/_shims/Providers.tsx', `import React from 'react'
${providerBody}

/**
 * Wraps children in every app-level context the design system's components
 * read. Any tree using PopUp, PageWrapper, AdminNav or EditModeSwitch must be
 * inside this.
 */
export default function OhmaProviders({ children }: { children: React.ReactNode }) {
    return (
        <EditModeProvider defaultValue={false}>
            <PageTitleProvider>
                <PopUpProvider>
                    {children}
                </PopUpProvider>
            </PageTitleProvider>
        </EditModeProvider>
    )
}
`)

// The preview card harness hard-codes `body{background:#fff}`, but this design
// system is dark-only: `globals.css` paints `html` with --surface-base and
// --text is near-white. On a white card, text and icons render invisible. This
// re-establishes the surface the app actually renders components on. Used only
// as the outer half of `cfg.provider` — it never wraps a real design, which
// gets the dark surface from styles.css directly.
write('src/_shims/Surface.tsx', `import React from 'react'

/** Paints the app's own page surface, so previews aren't light-on-light. */
export default function OhmaPreviewSurface({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            background: 'var(--surface-base)',
            color: 'var(--text)',
            padding: '1.25rem',
            borderRadius: '0.5rem',
        }}>
            {children}
        </div>
    )
}
`)

// ── 4. Barrel + package.json ────────────────────────────────────────────────

// Stage theme.ts so the runtime theme API ships with the bundle: a design can
// call applyTheme(ThemeName.Light) exactly as the app's ThemeEnabler does.
const themeAbs = join(REPO, THEME_SRC)
if (!staged.has(themeAbs)) {
    staged.set(themeAbs, stagedPathFor(themeAbs))
    write(staged.get(themeAbs), readFileSync(themeAbs, 'utf8'))
}
const themeModule = './' + staged.get(themeAbs).replace(/\.ts$/, '')

const lines = [
    "export { default as OhmaProviders } from './src/_shims/Providers'",
    "export { default as OhmaPreviewSurface } from './src/_shims/Surface'",
    `export { themes, applyTheme, subscribeToTheme, getActiveTheme, ThemeName } from '${themeModule}'`,
]
const bySrc = new Map()
for (const [name, meta] of Object.entries(SCOPE)) {
    const abs = join(REPO, meta.src)
    const modPath = './' + staged.get(abs).replace(/\.(tsx|ts)$/, '')
    if (!bySrc.has(modPath)) bySrc.set(modPath, [])
    bySrc.get(modPath).push({ name, binding: meta.export })
}
for (const [modPath, exports] of [...bySrc].sort()) {
    const parts = exports.map(({ name, binding }) =>
        binding === 'default' ? `default as ${name}` : binding === name ? name : `${binding} as ${name}`)
    lines.push(`export { ${parts.join(', ')} } from '${modPath}'`)
}
write('index.ts', `// Generated by .design-sync/stage-pkg.mjs — do not edit.\n${lines.join('\n')}\n`)

// CSS-module imports have no types of their own; the converter's ts-morph pass
// and `tsc --emitDeclarationOnly` both need them to resolve to something.
write('css-modules.d.ts', `declare module '*.module.css' {
    const classes: { readonly [key: string]: string }
    export default classes
}
`)

write('tsconfig.json', JSON.stringify({
    compilerOptions: {
        target: 'es2020',
        lib: ['dom', 'dom.iterable', 'esnext'],
        jsx: 'react-jsx',
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        declaration: true,
        emitDeclarationOnly: true,
        declarationDir: './types',
        baseUrl: '.',
    },
    include: ['index.ts', 'src/**/*.ts', 'src/**/*.tsx', 'css-modules.d.ts'],
}, null, 2) + '\n')

write('package.json', JSON.stringify({
    name: '@ohma/ui',
    version: '0.1.0',
    private: true,
    main: './index.ts',
    module: './index.ts',
    types: './types/index.d.ts',
}, null, 2) + '\n')

// ── 5. Fonts ────────────────────────────────────────────────────────────────
// The app serves its fonts from /public/fonts at runtime, so the compiled CSS
// carries absolute `url('/fonts/…')` references that resolve to nothing inside
// a bundle. Copy the real files in and rewrite the urls to be relative.

let fontFiles = 0
for (const abs of walkDir(join(REPO, 'public/fonts'))) {
    if (!/\.(woff2?|ttf|otf)$/.test(abs)) continue
    const rel = relative(join(REPO, 'public'), abs)
    mkdirSync(dirname(join(OUT, rel)), { recursive: true })
    writeFileSync(join(OUT, rel), readFileSync(abs))
    fontFiles++
}

// Inter is `$fonts-primary` in _fonts.scss (so: the body font for the whole
// site) but the app never @font-face's it and ships no file — production has
// been falling back to system sans. Vendor it so the design system renders
// what the stylesheet actually asks for.
const INTER_CACHE = join(REPO, '.design-sync/.cache/fonts/Inter')
const INTER_WEIGHTS = [300, 400, 500, 700]
let interFaces = ''
if (existsSync(INTER_CACHE)) {
    for (const weight of INTER_WEIGHTS) {
        const file = join(INTER_CACHE, `Inter-${weight}.woff2`)
        if (!existsSync(file)) continue
        mkdirSync(join(OUT, 'fonts/Inter'), { recursive: true })
        writeFileSync(join(OUT, `fonts/Inter/Inter-${weight}.woff2`), readFileSync(file))
        fontFiles++
        interFaces += `@font-face {
  font-family: 'Inter';
  src: url('../fonts/Inter/Inter-${weight}.woff2') format('woff2');
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
}
`
    }
} else {
    console.error('  ! Inter not vendored yet — run .design-sync/vendor-inter.mjs')
}

// ── 5b. Themes ──────────────────────────────────────────────────────────────
// The app ships four themes and swaps the whole palette at runtime by setting
// the custom properties on documentElement (see theme.ts / ThemeEnabler).
// `globals.scss` only carries the Standard values, so emit the other three as
// `[data-theme]` blocks — that gives designs (and the DS pane) a way to render
// any theme, and keeps the source of truth in theme.ts rather than duplicating
// hex values here.

function readThemes() {
    // theme.ts uses an `enum`, which Node's default type-stripping can't handle,
    // so read it in a child process with full type transformation. Keeps the
    // main invocation flag-free.
    const reader = `import(${JSON.stringify(join(REPO, THEME_SRC))})
        .then(m => process.stdout.write(JSON.stringify(m.themes)))`
    const out = execFileSync(process.execPath, ['--experimental-transform-types', '-e', reader], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(out)
}

const themes = readThemes()
const themeNames = Object.keys(themes)
const themeCss = themeNames
    .map(name => {
        const body = Object.entries(themes[name])
            .map(([token, value]) => `  --${token}: ${value};`)
            .join('\n')
        // Standard is what globals.scss already declares on `html`; emit it as a
        // named block too so switching back to it is symmetric.
        return `:root[data-theme="${name}"] {\n${body}\n}`
    })
    .join('\n\n')

const globalsCss = compileScss(join(REPO, 'src/styles/globals.scss'))
    .replace(/url\((['"]?)\/fonts\//g, 'url($1../fonts/')
write('styles/globals.css', `${interFaces}${globalsCss}\n\n${themeCss}\n`)

function walkDir(root) {
    if (!existsSync(root)) return []
    const out = []
    const stack = [root]
    while (stack.length) {
        const dir = stack.pop()
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const abs = join(dir, entry.name)
            if (entry.isDirectory()) stack.push(abs)
            else out.push(abs)
        }
    }
    return out
}

// ── 6. Declarations ─────────────────────────────────────────────────────────
// The converter derives its component list from the .d.ts tree, and step 2
// wipes OUT (types/ included). Emitting them here rather than as a separate
// command means a forgotten `tsc` can't silently produce a partial bundle.

const tsc = join(REPO, 'node_modules/.bin/tsc')
if (!existsSync(tsc)) throw new Error(`typescript not installed: ${tsc}`)
try {
    execFileSync(tsc, ['-p', join(OUT, 'tsconfig.json')], { stdio: ['ignore', 'pipe', 'pipe'] })
} catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    console.error(`  ! tsc reported errors while emitting declarations:\n${detail}`)
    process.exitCode = 1
}
const dtsCount = walkDir(join(OUT, 'types')).filter(path => path.endsWith('.d.ts')).length
console.error(`  declarations: ${dtsCount} .d.ts emitted`)

// ── 7. Report ───────────────────────────────────────────────────────────────

const componentCount = Object.keys(SCOPE).length
const internalCount = [...staged.values()].filter(p => p.startsWith('src/_internal/') && !STYLE_RX.test(p)).length
console.error(`  staged: ${componentCount} components, ${internalCount} internal modules, ${styleCount} stylesheets -> ${relative(REPO, OUT)}`)
const externals = new Set()
for (const abs of staged.keys()) {
    if (STYLE_RX.test(abs)) continue
    for (const spec of specifiersIn(readFileSync(abs, 'utf8'))) {
        if (resolveSpecifier(spec, abs).kind === 'external') externals.add(spec)
    }
}
console.error(`  externals: ${[...externals].sort().join(', ')}`)
if (problems.length) {
    console.error('\n  PROBLEMS:')
    for (const problem of [...new Set(problems)].sort()) console.error(`    ${problem}`)
    process.exitCode = 1
}
