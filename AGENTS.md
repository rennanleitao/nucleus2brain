# Architecture rules
- Task themes are stored as names on each task and indexed in a Space-scoped catalog by a database trigger, so saving a task and creating its themes are atomic and all entry points obey the Space requirement.
- The Tasks page renders cumulative groups only in list mode, so owner and kanban views cannot be replaced by saved grouping preferences.