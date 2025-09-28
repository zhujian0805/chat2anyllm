# Plan Mode Documentation

Plan Mode is a unique feature in Chat2AnyLLM that uses two models - one for planning and one for execution. This allows for more structured and thoughtful responses by separating the planning phase from the execution phase.

## Overview

Plan Mode enhances the chat experience by using a two-step approach:
1. **Planning Model**: Creates a structured plan as a numbered checklist
2. **Execution Model**: Executes the plan and provides a concrete implementation

This approach helps ensure more thorough and well-structured responses from the LLMs.

## Enabling Plan Mode

To enable Plan Mode, use the slash command:

```
/model:plan-mode <planning_model> <answering_model>
```

Example:
```
/model:plan-mode gpt-4 claude-3
```

To disable Plan Mode:
```
/model:plan-mode-off
```

## How Plan Mode Works

When Plan Mode is enabled:

1. **User sends a message**: The user types their question or request and sends it
2. **Planning Phase**:
   - The frontend sends the message to the planning model
   - The planning model generates a numbered checklist plan
   - The plan is displayed to the user as a "Plan" message
3. **Execution Phase**:
   - The frontend sends the original question along with the plan to the execution model
   - The execution model provides a concrete implementation following the plan
   - The response is displayed to the user as an "Implementation" message

## Planning Prompt Format

The planning model receives a specially formatted prompt:

```
Create a concise, actionable plan as a numbered checklist only. Rules:
- Use 1., 2., 3., ...
- One short, specific action per step
- No intro or outro text

Task: <user_message>
```

## Execution Prompt Format

The execution model receives a prompt that includes both the original task and the plan:

```
Follow the numbered steps in the plan below and produce a concrete implementation.

Rules:
- Do NOT restate or re-list the plan.
- Provide only actionable output: commands, file contents, API calls, or code.
- Use fenced code blocks with correct language tags (bash, sh, json, yaml, python, ts, etc.).
- When creating/editing files, include the file path before the code block.
- Assume Linux with bash for shell commands.
- Keep brief explanations only where needed.
- End with a short "Verify" section the user can run.

Original question: <user_message>

Plan (for you to follow, do not echo):
<generated_plan>
```

## Example Usage

1. Enable Plan Mode:
   ```
   /model:plan-mode gpt-4 claude-3
   ```

2. Ask a complex question:
   ```
   Create a React component that displays a todo list with add/remove functionality
   ```

3. The planning model (gpt-4) generates a plan:
   ```
   Plan:
   1. Create TodoList component with state management
   2. Implement addTodo function to add new items
   3. Implement removeTodo function to delete items
   4. Create input field and add button
   5. Create list rendering with delete buttons
   6. Add basic styling with CSS
   ```

4. The execution model (claude-3) implements the plan:
   ```
   Implementation:
   Here's a complete React todo list component:

   src/components/TodoList.js
   ```jsx
   import React, { useState } from 'react';
   import './TodoList.css';

   const TodoList = () => {
     const [todos, setTodos] = useState([]);
     const [inputValue, setInputValue] = useState('');

     const addTodo = () => {
       if (inputValue.trim() !== '') {
         setTodos([...todos, { id: Date.now(), text: inputValue }]);
         setInputValue('');
       }
     };

     const removeTodo = (id) => {
       setTodos(todos.filter(todo => todo.id !== id));
     };

     return (
       <div className="todo-list">
         <h2>Todo List</h2>
         <div className="input-section">
           <input
             type="text"
             value={inputValue}
             onChange={(e) => setInputValue(e.target.value)}
             placeholder="Enter a new todo..."
           />
           <button onClick={addTodo}>Add</button>
         </div>
         <ul className="todos">
           {todos.map(todo => (
             <li key={todo.id}>
               {todo.text}
               <button onClick={() => removeTodo(todo.id)}>Remove</button>
             </li>
           ))}
         </ul>
       </div>
     );
   };

   export default TodoList;
   ```

   src/components/TodoList.css
   ```css
   .todo-list {
     max-width: 400px;
     margin: 0 auto;
     padding: 20px;
   }

   .input-section {
     display: flex;
     margin-bottom: 20px;
   }

   .input-section input {
     flex: 1;
     padding: 8px;
     margin-right: 10px;
   }

   .todos {
     list-style: none;
     padding: 0;
   }

   .todos li {
     display: flex;
     justify-content: space-between;
     padding: 10px;
     border-bottom: 1px solid #eee;
   }
   ```

   Verify: Save the files and import the TodoList component in your App.js to see it in action.
   ```

## Benefits of Plan Mode

1. **Structured Thinking**: Forces the LLM to think through problems methodically
2. **Better Quality Output**: Results in more organized and complete implementations
3. **Model Specialization**: Allows using different models for planning vs. execution
4. **Transparency**: Users can see the plan before the implementation
5. **Flexibility**: Can modify the plan before execution if needed

## Technical Implementation

Plan Mode is implemented client-side in the frontend:

- Uses the same session streaming endpoint as regular chat
- Implements a two-phase request pattern
- Handles streaming responses for both planning and execution phases
- Displays distinct "Plan" and "Implementation" messages

The implementation can be found in the `handleSendMessage` function in `Chat.tsx`, where it checks if Plan Mode is enabled and follows the two-phase approach.

## Best Practices

1. **Choose Complementary Models**: Select a planning model that's good at structuring thoughts and an execution model that's good at implementation
2. **Complex Tasks**: Plan Mode is most beneficial for complex, multi-step tasks
3. **Review Plans**: Check the generated plan before the execution phase to ensure it covers your requirements
4. **Iterate**: If the result isn't what you expected, you can refine your original query and try again

## Limitations

1. **Longer Response Times**: Plan Mode takes roughly twice as long as a single model call
2. **Token Usage**: Uses more tokens as it makes two separate API calls
3. **Model Dependencies**: Requires access to two different models
4. **Streaming Complexity**: More complex streaming implementation than single-model responses

## Disabling Plan Mode

To return to normal mode, use:
```
/model:plan-mode-off
```

This will clear the planning and answering models and return to the standard single-model chat experience.