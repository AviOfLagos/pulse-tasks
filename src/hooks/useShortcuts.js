import { useEffect, useRef } from 'react'

/**
 * Global keyboard shortcuts: N new task, / search, Space complete.
 *
 * Keys are ignored while the user is typing (any input, textarea, select or
 * contenteditable), so "n" in a task title stays an "n". Escape is the one key
 * that still fires from inside a field, because it is how you get back out.
 */
export function useShortcuts(handlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const isTyping = (target) => {
      if (!target) return false

      const tag = target.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable === true
      )
    }

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const typing = isTyping(event.target)

      if (event.key === 'Escape') {
        ref.current.onEscape?.()
        return
      }

      if (typing) return

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        ref.current.onNew?.()
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        ref.current.onSearch?.()
        return
      }

      if (event.key === ' ' || event.key === 'Spacebar') {
        // Let a focused button keep its own Space behaviour.
        if (event.target?.tagName === 'BUTTON' || event.target?.tagName === 'A') return

        event.preventDefault()
        ref.current.onComplete?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
