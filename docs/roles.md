# Roles Feature Documentation

The Roles feature in Chat2AnyLLM allows users to create and apply reusable role instruction prompts (system prompts) that can be injected when chatting with any LLM model. This feature enhances the chat experience by providing consistent context and guidance to the LLM.

## Overview

Roles are stored persistently in PostgreSQL and can be applied to conversations to guide the LLM's behavior. Only one role can be active at a time, and role instructions are prepended to user messages as transient system prompts.

## Using Roles

### Creating a Role

1. Click the "Roles" section in the left sidebar
2. Click the "+New" button
3. Enter a name for your role (must be unique)
4. Enter the instructions for your role
5. Click "Create" to save the role

### Applying a Role

1. Click on any role in the Roles sidebar to make it active
2. The active role will be highlighted
3. When you send a message, the role's instructions will be prepended to your message
4. The format used is: `[[ROLE:<RoleName>]]\n<instructions>\n---\n<user message>`

### Clearing a Role

1. Click the active role again to clear it
2. Or use the `/clear_role` slash command

### Managing Roles

- **Editing**: Click the edit icon next to a role to modify its name or instructions
- **Deleting**: Click the delete icon next to a role to remove it permanently

## Slash Commands

The Roles feature includes several slash commands for quick access:

- `/roles` - List all available roles
- `/role <name>` - Select a role by name
- `/clear_role` - Clear the active role
- `/help` - Show help information including roles commands

## Technical Implementation

### Database Schema

Roles are stored in the PostgreSQL database in a dedicated `roles` table:

```sql
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### API Endpoints

The backend provides REST endpoints for role management:

- `GET /api/roles` - List all roles
- `POST /api/roles` - Create a new role
- `PUT /api/roles/:id` - Update an existing role
- `DELETE /api/roles/:id` - Delete a role

### Frontend Integration

The frontend integrates roles through:

- `RolesSidebar` component in the left panel
- `rolesAPI.ts` helper functions
- Role state management in the `Chat.tsx` component
- Slash command suggestions for role-related commands

## Slack Integration

The roles feature also supports Slack slash commands:

- `/roles` - Lists all available roles in Slack
- `/role <name>` - Attempts to select a role by name in Slack (provides feedback but doesn't change the UI role)

To enable Slack integration, set the `SLACK_SIGNING_SECRET` environment variable in the backend.

## Best Practices

1. **Descriptive Names**: Use clear, descriptive names for roles to easily identify their purpose
2. **Concise Instructions**: Keep role instructions focused and actionable
3. **Contextual Use**: Apply roles only when relevant to the conversation
4. **Testing**: Test roles with different models to ensure consistent behavior

## Example Roles

Here are some example roles you might create:

1. **Code Reviewer**: "You are a senior software engineer reviewing code. Focus on best practices, security, and performance."
2. **Technical Writer**: "You are a technical writer creating documentation. Use clear, concise language and provide examples."
3. **DevOps Engineer**: "You are a DevOps engineer. Focus on infrastructure, deployment, and system reliability."
4. **Data Scientist**: "You are a data scientist. Focus on statistical analysis, machine learning, and data visualization."

## Security Considerations

- Role names and instructions are sanitized to prevent XSS attacks
- All role operations require authentication
- Role data is stored securely in the PostgreSQL database
- Input validation is performed on all role creation and update operations