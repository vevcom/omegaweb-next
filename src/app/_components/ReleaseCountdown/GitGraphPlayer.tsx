'use client'
import styles from './GitGraphPlayer.module.scss'
import { RELEASE_COUNTDOWN_GIT_GRAPH_URL } from '@/services/releaseCountdown/constants'
import { useEffect, useRef, useState } from 'react'
import type { GitGraph } from '@/services/releaseCountdown/gitGraph/types'

const COMMITS_PER_SECOND = 8
const PAUSE_AT_END_MS = 6000
// On load the graph starts at the newest commit and rewinds to the first one, speeding up as it goes,
// before playing forward. The acceleration is picked so the rewind takes this long regardless of history size.
const REWIND_DURATION_S = 6
const REWIND_START_SPEED = 10
// How many commits one row's worth of scrolling moves the graph.
const COMMITS_PER_SCROLLED_ROW = 1
// Fraction of the pending scroll applied each frame, so scrolling glides instead of jumping.
const SCROLL_EASING = 0.15
// Wheel events in line mode (deltaMode 1) report lines instead of pixels.
const PIXELS_PER_WHEEL_LINE = 16
const TEXT_SPACING = 14
// New commits appear at this fraction of the canvas height and push older commits down.
// The canvas is tilted back, so the top part of it is far away (and hidden behind the countdown).
const HEAD_POSITION = 0.12
// When all commits have appeared, the graph keeps gliding until the newest commit rests at this fraction
// of the canvas height (slightly above the bottom of the screen), where a spotlight fades in on it.
const END_POSITION = 0.9
// How quickly the graph slows down as it settles at the end (per second, relative to the distance left).
const SETTLE_RATE = 0.6
const SPOTLIGHT_COLOR = '255, 240, 205'
const SPOTLIGHT_POOL_RADIUS = 260
const SPOTLIGHT_BEAM_LENGTH = 700
const SPOTLIGHT_BEAM_WIDTH = 150
const SPOTLIGHT_PULSE_MS = 2400
// Keeps the (oversized) canvas from getting too expensive to redraw every frame.
const MAX_PIXEL_RATIO = 1.5
const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const LANE_COLORS = [
    '#3b9dff',
    '#3ee0d0',
    '#5be35b',
    '#e8e84a',
    '#f0a73a',
    '#f05a5a',
    '#e45ae4',
    '#9b6bff',
]
const BACKGROUND_COLOR = '#000'
const HASH_COLOR = '#e8e84a'
const SUBJECT_COLOR = '#e6e6e6'
const MUTED_COLOR = '#808080'

const dateFormat = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeZone: 'Europe/Oslo' })

type Layout = {
    rowHeight: number,
    laneWidth: number,
    lineWidth: number,
    commitRadius: number,
    // Space between the graph and the text beside it.
    textGap: number,
    font: string,
    spotlightScale: number,
    // Whether the hash, author and date are drawn left of the graph. Without them the graph sits at the
    // left edge of the screen, with the subject to its right.
    showCommitInfo: boolean,
}

const WIDE_LAYOUT: Layout = {
    rowHeight: 40,
    laneWidth: 30,
    lineWidth: 4,
    commitRadius: 7,
    textGap: 32,
    font: `20px ${FONT_FAMILY}`,
    spotlightScale: 1,
    showCommitInfo: true,
}

// The mobile breakpoint ($mobileBreakpoint in styles/_variables.scss).
const NARROW_LAYOUT_MAX_SCREEN_WIDTH = 800
const NARROW_LAYOUT: Layout = {
    rowHeight: 26,
    laneWidth: 11,
    lineWidth: 2.5,
    commitRadius: 4,
    textGap: 16,
    font: `13px ${FONT_FAMILY}`,
    spotlightScale: 0.5,
    showCommitInfo: false,
}

type Edge = {
    child: number,
    parent: number,
    // 0 for the first parent, higher for merged-in parents.
    parentNumber: number,
}

type DrawGraphArgs = {
    context: CanvasRenderingContext2D,
    graph: GitGraph,
    edges: Edge[],
    progress: number,
    width: number,
    height: number,
    // The canvas is wider than the screen: this is where the left edge of the screen is on it.
    screenLeft: number,
    layout: Layout,
    // 0 to 1: how much of the spotlight on the newest commit is showing.
    spotlight: number,
    time: number,
}

/**
 * The progress at which the newest commit rests at END_POSITION.
 */
function endProgressFor(graph: GitGraph, height: number, layout: Layout) {
    return graph.commits.length + (END_POSITION - HEAD_POSITION) * height / layout.rowHeight
}

type DrawSpotlightArgs = {
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    scale: number,
}

/**
 * A pool of light on the graph around the commit, and a beam falling onto it from above.
 * The canvas is tilted back, so "up" on the canvas is away from the viewer and the beam reads as coming from above.
 */
function drawSpotlight({ context, x, y, intensity, scale }: DrawSpotlightArgs) {
    const light = (alpha: number) => `rgba(${SPOTLIGHT_COLOR}, ${alpha * intensity})`
    const beamLength = SPOTLIGHT_BEAM_LENGTH * scale
    const beamWidth = SPOTLIGHT_BEAM_WIDTH * scale
    const poolRadius = SPOTLIGHT_POOL_RADIUS * scale

    const beam = context.createLinearGradient(x, y - beamLength, x, y)
    beam.addColorStop(0, light(0))
    beam.addColorStop(1, light(0.22))
    context.fillStyle = beam
    context.beginPath()
    context.moveTo(x - beamWidth / 8, y - beamLength)
    context.lineTo(x + beamWidth / 8, y - beamLength)
    context.lineTo(x + beamWidth / 2, y)
    context.lineTo(x - beamWidth / 2, y)
    context.closePath()
    context.fill()

    const pool = context.createRadialGradient(x, y, 0, x, y, poolRadius)
    pool.addColorStop(0, light(0.35))
    pool.addColorStop(0.35, light(0.12))
    pool.addColorStop(1, light(0))
    context.fillStyle = pool
    context.fillRect(x - poolRadius, y - poolRadius, 2 * poolRadius, 2 * poolRadius)
}

function drawGraph({
    context,
    graph,
    edges,
    progress,
    width,
    height,
    screenLeft,
    layout,
    spotlight,
    time,
}: DrawGraphArgs) {
    const { rowHeight, laneWidth, commitRadius, textGap } = layout
    const revealedCount = Math.min(graph.commits.length, Math.floor(progress))
    // The lanes are centered, with commit info to the left and the subject to the right.
    // Without the commit info they start at the left edge of the screen instead.
    const originX = layout.showCommitInfo
        ? width / 2 - (graph.laneCount - 1) * laneWidth / 2
        : screenLeft + textGap
    const laneX = (lane: number) => originX + lane * laneWidth
    // Newest on top: the fractional part of progress makes the rows glide down smoothly.
    // The first commit never rises above END_POSITION, so at the start (and where the rewind turns around)
    // it rests near the bottom and the graph grows upwards from it until it reaches HEAD_POSITION.
    const firstCommitY = Math.max(height * HEAD_POSITION + (progress - 1) * rowHeight, height * END_POSITION)
    const rowY = (index: number) => firstCommitY - index * rowHeight
    const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length]
    const leftTextX = laneX(0) - textGap
    const rightTextX = laneX(graph.laneCount - 1) + textGap

    context.clearRect(0, 0, width, height)
    context.lineWidth = layout.lineWidth
    context.lineCap = 'round'

    const revealed = graph.commits.slice(0, revealedCount)
    const head = revealed[revealedCount - 1]

    if (head && spotlight > 0) {
        drawSpotlight({
            context,
            x: laneX(head[1]),
            y: rowY(revealedCount - 1),
            intensity: spotlight,
            scale: layout.spotlightScale,
        })
    }

    // Every edge whose parent has appeared is drawn. If the child has not appeared yet, the edge runs
    // up to the row where it will appear, so lanes stay continuous instead of popping in with the child.
    const frontierY = rowY(revealedCount)
    edges.forEach(({ child, parent, parentNumber }) => {
        if (parent >= revealedCount) return
        const childRevealed = child < revealedCount
        const childY = childRevealed ? rowY(child) : frontierY
        const parentY = rowY(parent)
        if (parentY < 0 || childY > height) return

        const lane = graph.commits[child][1]
        const parentLane = graph.commits[parent][1]
        const childX = laneX(lane)
        const parentX = laneX(parentLane)
        const curveHeight = Math.min(rowHeight, parentY - childY)

        context.beginPath()
        context.moveTo(parentX, parentY)
        if (parentLane === lane) {
            context.lineTo(childX, childY)
            context.strokeStyle = laneColor(lane)
        } else if (parentNumber === 0) {
            // A branch: it leaves the parent right away and then runs in the child's lane.
            const curveMiddleY = parentY - curveHeight / 2
            context.bezierCurveTo(parentX, curveMiddleY, childX, curveMiddleY, childX, parentY - curveHeight)
            context.lineTo(childX, childY)
            context.strokeStyle = laneColor(lane)
        } else if (childRevealed) {
            // A merge: it runs in the parent's lane and joins the child at the last moment.
            const curveMiddleY = childY + curveHeight / 2
            context.lineTo(parentX, childY + curveHeight)
            context.bezierCurveTo(parentX, curveMiddleY, childX, curveMiddleY, childX, childY)
            context.strokeStyle = laneColor(parentLane)
        } else {
            // A merge that has not happened yet: it is still running in the parent's lane.
            context.lineTo(parentX, childY)
            context.strokeStyle = laneColor(parentLane)
        }
        context.stroke()
    })

    context.font = layout.font
    context.textBaseline = 'middle'
    revealed.forEach(([hash, lane, parents, authorIndex, timestamp, subject], index) => {
        const y = rowY(index)
        if (y < -rowHeight || y > height + rowHeight) return
        const x = laneX(lane)
        const isHead = index === revealedCount - 1

        if (isHead && spotlight > 0) {
            const pulse = 1 + 0.2 * Math.sin(time / SPOTLIGHT_PULSE_MS * 2 * Math.PI)
            const haloRadius = commitRadius * 6 * pulse
            const halo = context.createRadialGradient(x, y, 0, x, y, haloRadius)
            halo.addColorStop(0, `rgba(${SPOTLIGHT_COLOR}, ${0.9 * spotlight})`)
            halo.addColorStop(1, `rgba(${SPOTLIGHT_COLOR}, 0)`)
            context.fillStyle = halo
            context.fillRect(x - haloRadius, y - haloRadius, 2 * haloRadius, 2 * haloRadius)
        }

        context.beginPath()
        context.arc(x, y, isHead ? commitRadius * 1.6 : commitRadius, 0, 2 * Math.PI)
        context.fillStyle = laneColor(lane)
        context.fill()
        if (parents.length > 1) {
            // Merge commits are drawn hollow.
            context.beginPath()
            context.arc(x, y, commitRadius / 2, 0, 2 * Math.PI)
            context.fillStyle = BACKGROUND_COLOR
            context.fill()
        }

        if (layout.showCommitInfo) {
            // Left of the graph, right-aligned and drawn from the graph outwards.
            let cursorX = leftTextX
            context.textAlign = 'right'
            const drawLeftText = (text: string, color: string) => {
                context.fillStyle = color
                context.fillText(text, cursorX, y)
                cursorX -= context.measureText(text).width + TEXT_SPACING
            }
            drawLeftText(hash, HASH_COLOR)
            drawLeftText(graph.authors[authorIndex], laneColor(lane))
            drawLeftText(dateFormat.format(new Date(timestamp * 1000)), MUTED_COLOR)
        }

        context.textAlign = 'left'
        context.fillStyle = isHead ? '#fff' : SUBJECT_COLOR
        context.fillText(subject, rightTextX, y)
    })
}

/**
 * Plays the project's git history as a growing git graph, like `git log --graph` scrolling by,
 * with the newest commit on top. The graph is tilted back so it lies a little flat.
 * The graph is the one fetched from GitHub into the store (updated from the admin panel); until
 * there is one, nothing plays.
 */
export default function GitGraphPlayer() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [graph, setGraph] = useState<GitGraph | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch(RELEASE_COUNTDOWN_GIT_GRAPH_URL, { cache: 'no-store' })
            .then(response => (response.ok ? response.json() : null))
            .then((loaded: GitGraph | null) => {
                if (!cancelled) setGraph(loaded)
            })
            .catch(() => {
                if (!cancelled) setGraph(null)
            })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!graph || !canvas || !context) return undefined

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        // With reduced motion the graph does not play by itself, but can still be scrolled through.
        const autoplaySpeed = reducedMotion ? 0 : COMMITS_PER_SECOND
        const lastProgress = graph.commits.length
        const edges = graph.commits.flatMap(([, , parents], child) =>
            parents.map((parent, parentNumber) => ({ child, parent, parentNumber }))
        )

        let rewinding = !reducedMotion
        let rewindStartedAt: number | null = null
        // Starts at the end (resting on the newest commit); set on the first frame, when the canvas size is known.
        let progress: number | null = null
        let pendingScroll = 0
        let lastTime: number | null = null
        let reachedEndAt: number | null = null
        let animationFrame = 0
        // Picked every frame, so it follows the screen when it is rotated or resized.
        let layout = WIDE_LAYOUT

        // Scrolling moves the graph along with it: content moving down plays forward, up rewinds.
        const scrollBy = (pixels: number) => {
            pendingScroll += pixels / layout.rowHeight * COMMITS_PER_SCROLLED_ROW
        }
        const onWheel = (event: WheelEvent) => {
            scrollBy(-event.deltaY * (event.deltaMode === 1 ? PIXELS_PER_WHEEL_LINE : 1))
        }
        let lastTouchY: number | null = null
        const onTouchStart = (event: TouchEvent) => {
            lastTouchY = event.touches[0]?.clientY ?? null
        }
        const onTouchMove = (event: TouchEvent) => {
            const touchY = event.touches[0]?.clientY
            if (touchY === undefined || lastTouchY === null) return
            scrollBy(touchY - lastTouchY)
            lastTouchY = touchY
        }

        const rewind = (time: number, endProgress: number) => {
            rewindStartedAt ??= time
            const seconds = (time - rewindStartedAt) / 1000
            // Distance = start speed * t + acceleration * t² / 2, solved for the acceleration.
            const rewindAcceleration = 2 * Math.max(0, endProgress - 1 - REWIND_START_SPEED * REWIND_DURATION_S)
                / REWIND_DURATION_S ** 2
            const rewound = REWIND_START_SPEED * seconds + rewindAcceleration * seconds ** 2 / 2
            const rewoundProgress = Math.max(1, endProgress - rewound)
            if (rewoundProgress === 1) rewinding = false
            return rewoundProgress
        }

        const play = (time: number, currentProgress: number, endProgress: number) => {
            const secondsSinceLastFrame = lastTime === null ? 0 : (time - lastTime) / 1000

            // Past the last commit, the graph slows down as it settles at the end.
            const speed = currentProgress < lastProgress
                ? autoplaySpeed
                : Math.min(autoplaySpeed, (endProgress - currentProgress) * SETTLE_RATE + 0.05)
            const scrollStep = pendingScroll * SCROLL_EASING
            pendingScroll -= scrollStep
            let nextProgress = Math.min(
                endProgress,
                Math.max(1, currentProgress + secondsSinceLastFrame * speed + scrollStep)
            )

            if (nextProgress < endProgress) {
                reachedEndAt = null
            } else {
                reachedEndAt ??= time
                if (!reducedMotion && time - reachedEndAt > PAUSE_AT_END_MS) {
                    // Start over from the first commit.
                    nextProgress = 1
                    pendingScroll = 0
                    reachedEndAt = null
                }
            }
            return nextProgress
        }

        const frame = (time: number) => {
            // clientWidth/clientHeight ignore the CSS tilt, unlike getBoundingClientRect.
            const width = canvas.clientWidth
            const height = canvas.clientHeight
            layout = window.innerWidth <= NARROW_LAYOUT_MAX_SCREEN_WIDTH ? NARROW_LAYOUT : WIDE_LAYOUT
            const endProgress = endProgressFor(graph, height, layout)

            progress ??= endProgress
            if (rewinding) {
                // Scrolling is ignored during the rewind.
                pendingScroll = 0
                progress = rewind(time, endProgress)
            } else {
                progress = play(time, progress, endProgress)
            }
            lastTime = time
            const spotlight = Math.min(1, Math.max(0, (progress - lastProgress) / (endProgress - lastProgress)))
            const pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1)
            if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
                canvas.width = Math.round(width * pixelRatio)
                canvas.height = Math.round(height * pixelRatio)
            }
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
            drawGraph({
                context,
                graph,
                edges,
                progress,
                width,
                height,
                // The canvas sticks out past the left edge of the screen by its (negative) offset.
                screenLeft: -canvas.offsetLeft,
                layout,
                spotlight,
                time,
            })

            animationFrame = requestAnimationFrame(frame)
        }
        animationFrame = requestAnimationFrame(frame)
        window.addEventListener('wheel', onWheel, { passive: true })
        window.addEventListener('touchstart', onTouchStart, { passive: true })
        window.addEventListener('touchmove', onTouchMove, { passive: true })
        return () => {
            cancelAnimationFrame(animationFrame)
            window.removeEventListener('wheel', onWheel)
            window.removeEventListener('touchstart', onTouchStart)
            window.removeEventListener('touchmove', onTouchMove)
        }
    }, [graph])

    return (
        <div className={styles.GitGraphPlayer}>
            <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
            {graph && (
                <a className={styles.repository} href={graph.repository} target="_blank" rel="noreferrer">
                    vevcom/project-next · {graph.commits.length} commits
                </a>
            )}
        </div>
    )
}
