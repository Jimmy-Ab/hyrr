import { useEffect, useState } from "react"

const WIDE = "(min-width: 1024px)"

/**
 * Wide screens: a height that lets the element reach from where it starts down to the bottom
 * edge of the page's scroll container (<main>), keeping main's bottom padding. Never below `min`,
 * never taller than the visible area. `undefined` on narrow screens (normal page flow).
 * Returns a callback ref (works for elements that mount later) and the height; re-measures on
 * resize and when content above changes size.
 */
export function useFillHeight(min = 480) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const main = el?.closest("main")
    if (!el || !main) return
    const media = window.matchMedia?.(WIDE)
    const measure = () => {
      if (!media?.matches) return setHeight(undefined)
      const style = getComputedStyle(main)
      const padTop = parseFloat(style.paddingTop) || 0
      const padBottom = parseFloat(style.paddingBottom) || 0
      // Offset of the element within main's content, independent of the current scroll.
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
      const visible = main.clientHeight - padTop - padBottom
      const fill = main.clientHeight - top - padBottom
      setHeight(Math.round(Math.min(visible, Math.max(min, fill))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(main)
    // Content above the panes (banners, filters, the salary panel) moves their top edge.
    if (main.firstElementChild) observer.observe(main.firstElementChild)
    media?.addEventListener?.("change", measure)
    return () => {
      observer.disconnect()
      media?.removeEventListener?.("change", measure)
    }
  }, [el, min])

  return { ref: setEl, height }
}
