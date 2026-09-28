import TodoItem from './TodoItem.jsx'

/** The task list. Ordering/filtering already happened upstream in App. */
export default function TodoList({ todos, onToggle, onUpdate, onRemove }) {
  return (
    <ul className="todo-list" data-testid="todo-list">
      {todos.map((todo, index) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          index={index}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}
