# Roles Feature - Product Requirements Document

## Summary
Add a collapsible "Roles" menu in the left sidebar allowing users to define reusable role instruction prompts (system prompts) that can be injected when chatting with any LLM model. Provide CRUD (create at minimum) UI for roles, store them in PostgreSQL, allow selection (single active role or none), and expose slash commands `/roles` (list) and `/role <name>` (attempt selection) for quick reference. Default state: no role selected.

## Goals
- Enable users to craft and reuse structured system prompts across sessions.
- Provide persistence via PostgreSQL to share roles for all users of an instance.
- Allow quick selection/clearing of roles from UI.
- Integrate role instructions seamlessly into existing streaming chat flow without altering DB message schema.
- Provide slash commands for visibility and lightweight remote selection feedback.

## Non-Goals (v1)
- Per-user ownership or permission model for roles.
- Editing/deleting roles from the UI (can be added later; backend supports it except UI controls omitted).
- Multi-role stacking (only one active at a time).
- Storing role usage in message history (role remains transient for the request context only).

## Definitions
Role: A named reusable instruction block sent as a system-style context before the user's message. Stored in table `roles(name UNIQUE, instructions TEXT, timestamps)`.

## User Stories
1. As a user I can expand a Roles section and click +New to create a role by entering a name and its instructions so I can reuse guidance.
2. As a user I can click a role to make it active; subsequent prompts are influenced by that role's instructions.
3. As a user I can click the active role again (Clear Role button) to deselect it and return to normal chat.
4. As a user I can list available roles in Slack via `/roles` so I know what exists.
5. As a user I can attempt to select a role via `/role <name>`; Slack responds with confirmation or not-found (UI still determines active role).

## Functional Requirements
1. Sidebar shows collapsible Roles section, default expanded; each role displays name and updated date.
2. A +New button prompts for name & instructions (two sequential prompts) then persists to backend; duplicate names produce an error alert.
3. Selecting a role toggles activeRole (click again on Clear Role to remove). Only one active at a time; default none.
4. When sending a chat message and a role is active, prepend a transient system prompt to the first user message chunk:
   - Format: `[[ROLE:<RoleName>]]\n<instructions>\n---\n<user message>` (clear delimiter for potential parsing).
5. Roles are stored in PostgreSQL `roles` table with uniqueness on name.
6. Backend exposes REST endpoints:
   - `GET /api/roles` list
   - `POST /api/roles {name,instructions}` create
   - `PUT /api/roles/:id` update (not surfaced in UI v1)
   - `DELETE /api/roles/:id` delete (not surfaced in UI v1)
7. Slash commands endpoint `/slack/command` (urlencoded) handles:
   - `/roles` -> returns list bullet features or 'No roles defined.'
   - `/role <name>` -> returns selection confirmation or not-found.
8. Security: If `SLACK_SIGNING_SECRET` is set, validate signatures; otherwise accept (development mode).
9. DB migration: Add `roles` table & triggers both in init script and runtime defensive creation.

## UX & UI
- Roles section visually mirrors Sessions section styling.
- Active role highlighted like session highlight; clear role button appears inside roles list when a role is active.
- Tooltips: role button title attribute shows instructions.

## Performance
- Roles list loaded once on app init; additions appended locally (no forced full refresh) to minimize API calls.

## Edge Cases
- Duplicate name creation -> 409 conflict -> surface alert.
- Empty name or instructions -> blocked client-side (user cancels prompt -> abort).
- Backend unconfigured DB -> role APIs return 500; UI silently shows empty roles.
- Very long instructions -> stored; only tooltip shows full text (browser handles overflow).

## Future Enhancements
- Role editing & deletion UI.
- Per-user or per-workspace role scoping.
- Multi-select or role stacking with ordering.
- Display role instructions inline above chat when active.
- Persist role selection per session.

## Acceptance Criteria
- Creating a new role adds it to UI and DB (verify via GET endpoint).
- Selecting a role modifies subsequent assistant responses contextually (observable difference when instructions are strong, e.g., "Answer only in JSON").
- Slack `/roles` lists created roles; `/role <name>` acknowledges existing names.
- No regressions to existing chat, sessions, or model selection.

