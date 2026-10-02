import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { EASE_OUT } from './animations'

// A number that rolls from its previous value to the next one instead of
// swapping, so money visibly moves. First mount renders the value as is; under
// reduced motion it snaps. `format` stays the caller's, so the digits shown are
// always the caller's own formatting of a whole minor amount.
export default function CountUp({ minor, format, className }: { minor: number; format: (minor: number) => string; className?: string }) {
  const [shown, setShown] = useState(minor)
  const previous = useRef(minor)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (previous.current === minor) return
    if (reduce) {
      previous.current = minor
      setShown(minor)
      return
    }
    const control = animate(previous.current, minor, {
      duration: 0.32,
      ease: EASE_OUT,
      onUpdate: (value) => setShown(Math.round(value)),
      onComplete: () => {
        previous.current = minor
        setShown(minor)
      },
    })
    return () => control.stop()
  }, [minor, reduce])
  return <span className={className}>{format(shown)}</span>
}
