# Hometown Carpet Care

React/Vite version of the Hometown Carpet Care website.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Project structure

- `index.html` — Vite HTML entry point and page metadata
- `src/main.jsx` — React application entry point
- `src/App.jsx` — root React component
- `src/page.html` — the page's semantic markup
- `src/styles.css` — mobile-first component styles: the base rules are the phone layout, and `min-width` media queries add the tablet and desktop layouts
- `src/site.js` — navigation, forms, FAQ, and booking-flow behavior
- `google-sheet/Code.gs` — Google Apps Script that saves the booking and quote forms into a Google Sheet

## Form submissions

Both forms post to a Google Sheet through a small Apps Script web app. Paste `google-sheet/Code.gs` into the sheet's Extensions > Apps Script editor, run `setup` once, deploy it as a Web app (Execute as: Me, Who has access: Anyone), and put the `/exec` URL into `SHEET_URL` at the top of the Google Sheet section in `src/site.js`. Bookings and quote requests land in their own tabs.

After editing the script, publish the change with Deploy > Manage deployments > Edit > Version: New version, which keeps the same URL.

The script also sends each new submission as a WhatsApp message through a WhatsApp agent (Meta's WhatsApp Agent Platform API). The agent's API key lives only in the Apps Script project's Script Properties as `WHATSAPP_API_KEY`. After adding it, run `connectWhatsApp` from the editor and message the agent on WhatsApp while it runs (messages sent before it starts are not delivered to it); it stores the recipient as `WHATSAPP_USER_ID` and replies "Connected" in WhatsApp. An agent can only message the person who created it.

