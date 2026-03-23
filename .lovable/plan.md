

## Analysis

The play button (TaskTimer) IS rendered on line 216 of TaskCard.tsx, but it's placed inside the metadata row among many small items (space name, tags, dates, subtask count, estimated time). It's likely too small or getting lost visually among the metadata.

The description IS shown (line 154-156) but only as a `line-clamp-1` single line preview.

## Plan

### 1. Make the play button more visible
- Move the TaskTimer component OUT of the metadata flex-wrap row
- Place it as a standalone element next to the priority dots and delete button in the right-side actions area (line 220-227)
- Slightly increase the play icon size from `h-3 w-3` to `h-4 w-4` for better visibility

### 2. Show task description more prominently
- Change `line-clamp-1` to `line-clamp-2` to show more description text
- Ensure description is always visible (not just a micro preview)

### Files to edit
- `src/components/TaskCard.tsx`: Move TaskTimer to the right-side action area; expand description display

### Credits
This is a small UI-only change (2 files, minor edits). It should cost approximately 1 credit.

