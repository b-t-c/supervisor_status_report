# Facilities Supervisor Status Report V3.1

This is the GitHub Pages-ready, client-only Supervisor Status Report app.

V3.1 keeps the existing SRP report and CESS tab while adding required event-time entry for applicable tanker statuses. Both reports retain their own prior values on the device.

## SRP report

- 3P and 4P status inputs with Offline, Starting up, In standby, and In serial modes
- Mode-specific sample fields and guidance
- Out-of-spec trend selection at or above 100 ppm
- Optional B-side "Not collected yet" state
- ST5–ST8 levels and active/inactive states
- Current NMP supply calculation and WT level

## CESS report

- ST1A, ST1B, ST2A, ST2B, ST3A, and ST3B levels
- Any number of automatically numbered on-site tanker entries
- Electrolyte supplier, single destination, and detailed status fields
- Other tanker contents, multiple destinations, and detailed status fields
- Required reason fields for delayed or interrupted work
- Required time fields for arrivals, inbounding, sample handoffs/results, unload starts, interruptions, and timed unload delays/pauses
- Status output that places each recorded time directly into the corresponding event description
- Standardized output ordered as tank levels followed by on-site tankers

## Shared behavior

- Dynamic fields based on the selected mode, tanker type, supplier, and status
- Copyable standardized report text
- Independent local retention and clearing for each tab
- PWA/offline support over HTTPS
- No database or server-side report storage

See **DEPLOY_TO_GITHUB_PAGES.md** for publishing and update instructions.
