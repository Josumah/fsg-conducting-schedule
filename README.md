# FSG #1 & #2 Conducting Schedule

A responsive shared calendar for the Saturday field service conducting rotation.

## Schedule rules

- Rotation: **James → Les → Harlan → JP → Isaac**
- Anchor: **JP on Saturday, October 3, 2026**
- The fourth Saturday of every month is **Kingdom Hall — No conducting**.
- Editors can override a fourth Saturday with an assignment or another no-conducting reason.
- A fourth-Saturday assignment consumes a normal turn and advances the rotation; restoring the default returns it to a paused Kingdom Hall date.
- Convention, assembly, CO-visit, and other special-event Saturdays can be tagged manually.
- Every no-conducting Saturday pauses the rotation and does not consume a turn.
- Assignment overrides change only the selected date. The underlying rotation continues unchanged.

## Features

- Responsive month calendar and mobile agenda
- Prominent next-assignment card
- Shared schedule exceptions backed by a Google Sheet
- Public read-only page and separate private editor link
- 12-month iCalendar (`.ics`) download
- No framework or frontend build step

## Run locally

Requirements: Python 3 for the local static server and Node.js 20 or newer for tests.

```bash
npm test
python3 -m http.server 8000
```

Open <http://127.0.0.1:8000>.

## Google Sheet and Apps Script setup

1. Create a new Google Sheet named `FSG Conducting Schedule`.
2. In the sheet, open **Extensions → Apps Script**.
3. Replace the editor contents with [`apps-script/Code.gs`](apps-script/Code.gs), then save.
4. Generate a long random editor token on your computer:

   ```bash
   openssl rand -hex 32
   ```

5. In Apps Script, open **Project Settings → Script Properties** and add:

   | Property | Value |
   |---|---|
   | `EDIT_TOKEN` | The generated random token |

6. Select **Deploy → New deployment → Web app**.
7. Set **Execute as** to **Me** and **Who has access** to **Anyone**, then deploy.
8. Copy the `/exec` web app URL into [`src/config.js`](src/config.js) as `SCHEDULE_API_URL`. The web app URL is public by design. Never put the editor token in that file.
9. Test the normal public URL and the private editor URL:

   ```text
   Public:  https://josumah.github.io/fsg-conducting-schedule/
   Editor:  https://josumah.github.io/fsg-conducting-schedule/#edit=YOUR_RANDOM_TOKEN
   ```

The app removes the editor token from the address bar after loading and keeps it in session storage for that browser tab. Anyone who receives the private link can edit the shared schedule. If the link is exposed, replace the `EDIT_TOKEN` script property and redistribute the private link.

## Data model and security

The Apps Script web app stores schedule exceptions in a `Schedule Overrides` tab that it creates automatically. Public visitors read the effective schedule through JSONP, avoiding Apps Script's cross-origin redirect limitations. Editor writes use a no-CORS post and are confirmed by re-reading the sheet before the UI reports success. Changes require the private editor token, and Apps Script validates:

- Saturday-only dates
- Known participant names
- Supported skip reasons
- Notes no longer than 160 characters

Only exceptions are stored. The base rotation is deterministic and remains available if the Google Sheet is temporarily unreachable.

## GitHub Pages deployment

The repository is intended to publish directly from the root of the `main` branch:

1. In **Settings → Pages**, choose **Deploy from a branch**.
2. Select `main` and `/ (root)`.
3. Save and wait for the Pages deployment to complete.

The live URL will be <https://josumah.github.io/fsg-conducting-schedule/>.

## Calendar download

The download button generates a one-time calendar file covering the next 12 months. It includes assignments, fourth-Saturday Kingdom Hall dates, and all currently loaded shared exceptions.

Because it is a downloaded snapshot, future shared edits do not update an already imported calendar automatically. Download a fresh copy after significant schedule changes.
