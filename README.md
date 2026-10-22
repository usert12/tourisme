# 3T — Trip & Travel Trace Algeria

A dependency-free full-stack Node.js tourism website focused on five Algerian wilayas: **Constantine, Ghardaïa, Alger, Oran and Guelma**.

## Features

- Landing page with Algeria imagery, 3T logo and login/register cards
- Email/password registration and login with scrypt password hashing
- Demo Google/Facebook login buttons (local demo accounts; real OAuth credentials are not included)
- Forgot-password demo flow
- Visitor profile + logout
- AR / FR / EN interface switcher, including RTL Arabic layout
- Five destination cards using the supplied images
- Destination details with visitor challenge filters
- Visitor "Share Your Trace" form to publish challenges and solutions
- Safety & support page for Algeria
- Admin-only recommendations: hotel, guide and transport
- Admin add/edit/delete recommendation controls
- JSON persistence (`data.json`) automatically created on first start
- Responsive desktop/mobile design

## Run

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run:

```bash
npm start
```

4. Open `http://localhost:3000`

No `npm install` is required because the app uses only built-in Node.js modules.

## Admin account

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment before starting the app to create an administrator account on first startup. Do not commit these values or your local `data.json` file.

## Notes

The Google and Facebook buttons are implemented as **demo social sign-in** because real OAuth requires your own Google/Facebook app IDs, secrets and redirect URLs. The backend endpoint is already separated so it can be replaced with real OAuth later.

The emergency section is intended as a practical UI demo; verify official emergency contact information before production deployment.
