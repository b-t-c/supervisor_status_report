# Supervisor Status Report V2.1 — GitHub Pages package

This is the GitHub Pages-ready version of the client-only Supervisor Status Report app.

V2.1 ensures all mode-dependent fields collapse reliably across desktop, Android, and iPhone browsers.

Start with **DEPLOY_TO_GITHUB_PAGES.md** for step-by-step publishing instructions.

## Application behavior

- 3P and 4P status inputs with Offline, Starting up, In standby, and In serial modes
- Mode-specific sample fields and guidance
- One standby sample or separate A-side/B-side serial samples
- Out-of-spec trend selection when a relevant sample exceeds 100 ppm
- ST5–ST8 levels and active/inactive states
- Current NMP Supply calculation across active tanks
- WT level
- Standardized generated report
- Copy Text button
- Local retention of previous values
- Clear/reset button
- PWA/offline support when hosted over HTTPS

No database or server-side report storage is used.
