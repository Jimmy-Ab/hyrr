import { animate, AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion"
import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Motion primitives for an Apple-like feel: short, smooth, no bounce, and always off when the OS
 * asks for reduced motion. See the hyrr-ui skill ("Motion").
 */

/** iOS-style curve used everywhere (matches --ease-apple in index.css). */
export const EASE_APPLE = [0.32, 0.72, 0, 1] as const
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
/** Snappy, critically damped spring (no overshoot) for layout moves like the nav highlight. */
export const SPRING_SMOOTH = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const

let pointerEffectsInstalled = false
/**
 * One delegated pointer listener for the `.spotlight` glow: writes the cursor position into
 * `--mx` / `--my` on the hovered element. Call once at app start.
 */
export function installPointerEffects() {
  if (pointerEffectsInstalled || typeof window === "undefined") return
  pointerEffectsInstalled = true
  let frame = 0
  let last: PointerEvent | null = null
  window.addEventListener(
    "pointermove",
    (e) => {
      last = e
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const target = (last?.target as Element | null)?.closest?.(
          ".spotlight"
        ) as HTMLElement | null
        if (!target || !last) return
        const rect = target.getBoundingClientRect()
        target.style.setProperty("--mx", `${last.clientX - rect.left}px`)
        target.style.setProperty("--my", `${last.clientY - rect.top}px`)
      })
    },
    { passive: true }
  )
}

/** Cross-fades between views: the new page rises in with a short blur-to-sharp. */
export function PageTransition({
  viewKey,
  children,
}: {
  viewKey: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={
          reduce
            ? { opacity: 1 }
            : {
                opacity: 0,
                y: -4,
                filter: "blur(3px)",
                transition: { duration: 0.14, ease: EASE_APPLE },
              }
        }
        transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
        className="min-w-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Number that counts up to its value when it scrolls into view (and animates on change). */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 0.9,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-20px" })
  const reduce = useReducedMotion()
  const from = React.useRef(0)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduce || !inView) {
      node.textContent = format(reduce ? value : from.current)
      if (reduce) from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => {
        node.textContent = format(v)
      },
    })
    from.current = value
    return () => controls.stop()
  }, [value, inView, reduce, duration]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(reduce ? value : 0)}
    </span>
  )
}

/**
 * Sliding highlight behind the active item of a nav or segmented control. Render it inside the
 * active item (position: relative) with the same `layoutId` for the whole group.
 */
export function ActiveIndicator({ layoutId, className }: { layoutId: string; className?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden="true"
      transition={SPRING_SMOOTH}
      className={cn("absolute inset-0 -z-10 rounded-xl bg-primary-light", className)}
    />
  )
}

/** Fades/rises children in once when they enter the viewport. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Inertial smooth scrolling (Lenis) for an app's scroll container. Wheel/trackpad only: touch keeps
 * native momentum, nested scroll areas (kanban columns, chat, dialogs) scroll natively, and it is
 * off when the OS asks for reduced motion. `resetKey` change (e.g. the active view) jumps to top.
 * Pass the element via a callback ref (`ref={setMainEl}`), so it starts when the area mounts.
 */
export function useSmoothScroll(wrapper: HTMLElement | null, resetKey?: unknown) {
  const reduce = useReducedMotion()
  const lenisRef = React.useRef<import("lenis").default | null>(null)

  React.useEffect(() => {
    const content = wrapper?.firstElementChild as HTMLElement | null
    if (!wrapper || !content || reduce) return
    let cancelled = false
    let instance: import("lenis").default | null = null
    // Loaded lazily so it never blocks first paint.
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return
      instance = new Lenis({
        wrapper,
        content,
        autoRaf: true,
        smoothWheel: true,
        syncTouch: false,
        allowNestedScroll: true,
        lerp: 0.14,
        wheelMultiplier: 1.1,
      })
      lenisRef.current = instance
    })
    return () => {
      cancelled = true
      instance?.destroy()
      lenisRef.current = null
    }
  }, [wrapper, reduce])

  React.useEffect(() => {
    if (resetKey === undefined) return
    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true })
    else wrapper?.scrollTo({ top: 0 })
  }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
