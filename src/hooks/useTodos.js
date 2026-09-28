import { useEffect, useReducer } from 'react'

import { loadTodos, saveTodos } from '../state/storage.js'
import { todosReducer } from '../state/todoReducer.js'

/**
 * Owns the todo list: hydrates from localStorage once, then writes back on
 * every change. `dispatch` is the raw reducer dispatch.
 */
export function useTodos() {
  const [todos, dispatch] = useReducer(todosReducer, undefined, loadTodos)

  useEffect(() => {
    saveTodos(todos)
  }, [todos])

  return { todos, dispatch }
}
