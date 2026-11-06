# Deploy Facilities Supervisor Status Report V3.1

This folder is ready to replace the existing app in its GitHub Pages repository.

## Update the existing repository

1. Extract the contents of this package into the existing repository folder.
2. Allow the new files to overwrite the old versions.
3. Confirm `index.html` remains at the repository root.
4. Open PowerShell in that repository folder and run:

```powershell
git status
git add -A
git commit -m "Add tanker status time entries"
git push
```

GitHub Pages will redeploy automatically from `main` if the repository is already configured.

## First phone test

After GitHub finishes deploying:

1. Open the existing app URL while online.
2. Refresh once in Safari or Chrome.
3. Confirm the **SRP** and **CESS** tabs appear.
4. If an installed Home Screen copy still shows the old version, fully close and reopen it. Removing and re-adding the Home Screen icon is the fallback.

The service-worker cache name changed in V3.1 so installed devices can retrieve the tanker-time update.

## Data behavior

The app has no database or backend. Entered values are stored only in that device/browser's local storage. SRP and CESS retain separate values, and **Clear** affects only the currently selected tab.

GitHub Pages serves only the application files. Do not add completed plant reports, credentials, or sensitive example data to the repository.
