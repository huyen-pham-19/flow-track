# FlowTrack

FlowTrack is a personal task and focus management web app built with vanilla HTML, CSS, and JavaScript. It provides a Kanban-style board for day-to-day task tracking and a calendar view for scheduling work by date, time, and duration.
The project is designed as a lightweight frontend application with local persistence, a polished visual interface, and explicit task workflow rules.

## Project Overview
FlowTrack focuses on two core productivity workflows:

- **Board management** for capturing and progressing tasks through custom status columns
- **Calendar planning** for assigning work to specific dates and time slots

## Core Features

### 1. Board workflow
- Default columns: **To Do**, **Doing**, and **Done**
- Support for adding custom columns
- Quick task creation directly inside a column
- Drag-and-drop task movement across columns
- Task status transition rules:
  - a task can move from **To Do** to **Doing**
  - a task can move from **Doing** to **Done**
  - direct transition from **To Do** to **Done** is intentionally blocked
- Reopen completed tasks back into active work

### 2. Task detail management
Each task supports:
- title
- description
- status
- priority (`low`, `medium`, `high`)
- work date
- start time
- duration in minutes
- tags

### 3. Calendar scheduling
- Week view
- Day view
- Navigation across periods
- Per-view summary of scheduled tasks and total duration
- Time-based placement of scheduled tasks in the calendar grid

### 4. Search and filtering
- Search by task title, description, and tags
- Filter board by task status
- Statistics for total tasks, lists, completed tasks, scheduled tasks, and planned duration

### 5. Theme and UI polish
- Dark and light theme support
- Responsive layout across desktop and smaller screens
- Toast notifications for state feedback
- Overdue task highlighting
- Modern glassmorphism-inspired interface styling

## Tech Stack
- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Browser localStorage for persistence

## Architecture Notes

### State model
The app maintains a centralized `state` object containing:
- theme
- active page
- board filter
- calendar view
- current calendar date
- columns
- tasks

### Rendering approach
Rendering is separated into focused functions such as:
- `renderAll()`
- `renderPages()`
- `renderBoard()`
- `renderCalendar()`
- `renderStats()`

### Data normalization
The code includes multiple protective normalization steps:
- fallback column creation
- task shape normalization
- completion timestamp correction
- removal of expired completed tasks

### Workflow validation
Task transitions are not treated as arbitrary UI changes. 
The code validates transitions and shows feedback when a move is not allowed. 
This is a good example of embedding business rules into application logic rather than relying only on interface conventions.
