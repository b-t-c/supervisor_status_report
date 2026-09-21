# Deploy Supervisor Status Report V2.2 to GitHub Pages

This folder is ready to publish as a plain static GitHub Pages site.

## What will be hosted

Only the application files:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `service-worker.js`
- the two app icons

The report does **not** use a database or backend. Values entered by a supervisor are stored in that device/browser's local storage and the report is generated locally in the browser.

## Easiest deployment method

### 1. Create a repository

On GitHub:

1. Click **New repository**.
2. Give it a simple name, for example:
   `supervisor-status-report`
3. Choose the repository visibility permitted by your company.
4. Create the repository.

> Important: GitHub Pages websites are web-accessible. Do not put sensitive company data, example reports, credentials, or secrets in this repository.

### 2. Upload these files

Upload the **contents of this folder** to the top level of the repository.

The repository root should look exactly like:

```text
supervisor-status-report/
├── .nojekyll
├── index.html
├── app.js
├── styles.css
├── manifest.json
├── service-worker.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

`index.html` must be at the repository root for the setup below.

### 3. Turn on GitHub Pages

In the repository:

1. Open **Settings**.
2. In the left sidebar, open **Pages**.
3. Under **Build and deployment**, set **Source** to:
   **Deploy from a branch**
4. Select:
   - Branch: `main`
   - Folder: `/(root)`
5. Click **Save**.

GitHub will publish the site.

### 4. Open the app

Return to **Settings → Pages**.

Once deployment finishes, GitHub will show a **Visit site** link.

For a normal GitHub.com project site, the address will generally have this form:

```text
https://YOUR-USERNAME.github.io/supervisor-status-report/
```

Send that HTTPS address to the supervisors.

## iPhone

1. Open the GitHub Pages URL in **Safari**.
2. Confirm the inputs, live Current NMP Supply field, Generate Output button, and Copy Text button work.
3. To put it on the Home Screen:
   - Tap **Share**
   - Tap **Add to Home Screen**
   - Confirm **Add**

The app includes a web-app manifest and is configured to launch in a standalone/app-like display.

## Android

Open the same URL in Chrome. The browser may offer **Install app** or **Add to Home screen**.

The standalone `.html` file can still be used directly on Android if desired, but the hosted URL gives Android and iPhone one consistent distribution method.

## Updating the app later

Replace/edit the files in the repository and commit the change to `main`.

GitHub Pages republishes from the configured source. Supervisors continue using the same URL.

The service worker uses a network-first strategy, so when a device has a network connection it will retrieve updated files and refresh its cached copy.

## Local data behavior

The app stores prior entries using browser `localStorage`.

That means:

- Values remain on the supervisor's device/browser.
- One supervisor does not see another supervisor's entries.
- Clearing website data can erase retained values.
- The app's **Clear** button resets the saved report values.
- GitHub is serving the application code; this V2.2 does not send the entered report contents to GitHub.

## Offline behavior

After the GitHub Pages version has been opened successfully, the service worker caches the app files. It is designed to remain usable when the device temporarily has no network connection.

For initial installation/loading and for receiving updates, the phone should have internet access.

## Recommended first test

Before distributing broadly:

1. Publish the site.
2. Open it on one iPhone in Safari.
3. Enter:
   - Each 3P/4P operational mode and its required sample values
   - An out-of-spec sample at or above 100 ppm and the corresponding trend
   - Serial mode with **Not collected yet** selected for B-side
   - ST5–ST8 levels and active states
   - WT level
4. Confirm Current NMP Supply updates.
5. Generate the report.
6. Copy the report text and paste it into Notes or your normal reporting destination.
7. Add the app to the iPhone Home Screen and repeat the test from the Home Screen icon.
