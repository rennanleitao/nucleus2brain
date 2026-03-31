

## Analysis

After reviewing the codebase, I found that most of what you're asking **already exists**:

- **Edge Function `google-calendar-api`**: Already supports `create_event`, `list_events`, `update_event`, `delete_event`, and `status` actions (lines 117-160 of the edge function)
- **CalendarPage (`src/pages/CalendarPage.tsx`)**: Already renders a full monthly calendar grid with events, has a "Novo Evento" dialog for creating events, and supports calendar selection/settings
- **What's MISSING**: The AI Assistant cannot create calendar events via voice/chat commands

## Plan

### 1. Update the `chat` Edge Function system prompt

Add a new action type `create_calendar_event` to the system prompt so the AI knows it can schedule meetings:

```
- create_calendar_event: {"action":"create_calendar_event","summary":"...","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","description":"...","location":"..."}
```

### 2. Update `src/pages/Assistant.tsx` to handle `create_calendar_event` actions

When the AI responds with a `create_calendar_event` action block, the frontend will:
- Parse the action JSON from the response
- Call the `google-calendar-api` edge function with `action=create_event`
- Show a success toast with the event details
- This works for both typed messages and voice-captured text

### 3. Add calendar context to the Assistant

When gathering context before sending a message, also fetch Google Calendar connection status and upcoming events (next 7 days) so the AI can reference existing meetings when scheduling.

### Technical Details

**File: `supabase/functions/chat/index.ts`**
- Extend `systemPrompt` with the `create_calendar_event` action definition and instructions for scheduling

**File: `src/pages/Assistant.tsx`**
- Add a second action parser for `create_calendar_event` alongside the existing `create_task` handler
- Add a helper function `createCalendarEvent()` that calls the edge function
- Add calendar status + upcoming events to the `context` object sent to the AI

No database changes or new edge functions needed.

