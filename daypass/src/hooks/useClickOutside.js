import { useEffect } from 'react'

/** Ejecuta handler cuando se hace clic/tap fuera del elemento referenciado. */
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) handler()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [ref, handler, active])
}
