# Calorie Tracker

A full-stack personal food journal for recording meals, monitoring daily calories, and tracking a configurable calorie goal.

## Features

- Account registration, sign-in, and sign-out
- Secure, HTTP-only JWT session cookie
- Daily food entries organised by breakfast, lunch, dinner, and snacks
- Daily calorie total, goal progress, and remaining/over-goal summary
- Editable daily calorie goal
- Date-based journal history and entry deletion
- Server-side validation, rate limiting, security headers, and ownership checks

## Tech stack

- **Client:** React, Vite, CSS
- **Server:** Node.js, Express, Mongoose
- **Database:** MongoDB
- **Authentication:** JWT and bcrypt

## Prerequisites

- Node.js 20 or newer
- A MongoDB database (local or Atlas)

## Run locally

1. Install dependencies in both applications:

   ```powershell
   cd server
   npm install
   cd ..\client
   npm install
   ```

2. Create `server/.env` with the following values:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/calorie-tracker
   JWT_SECRET=replace_with_a_random_secret_at_least_32_characters_long
   APP_ORIGIN=http://localhost:5173
   PORT=5000
   ```

   Generate a strong secret, for example with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

3. In one terminal, start the API:

   ```powershell
   cd server
   npm run dev
   ```

4. In a second terminal, start the client:

   ```powershell
   cd client
   npm run dev
   ```

Open `http://localhost:5173`. During development, Vite forwards `/api` requests to the Express server on port 5000.

## Production build

Build the client, then start the server with `NODE_ENV=production`. The server serves the generated `client/dist` files as well as the API.

```powershell
cd client
npm run build
cd ..\server
$env:NODE_ENV = "production"
npm start
```

For production, set `APP_ORIGIN` to the public application origin and serve the app over HTTPS so secure cookies are enabled.

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account and start a session |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Get the active user |
| PATCH | `/api/users/goal` | Update the daily calorie goal |
| GET | `/api/entries?date=YYYY-MM-DD` | List entries for a date |
| POST | `/api/entries` | Create a food entry |
| DELETE | `/api/entries/:id` | Remove one of the current user's entries |

Calorie values and goals must be whole numbers from 1 to 20,000. Entries require a valid date and one of: `Breakfast`, `Lunch`, `Dinner`, or `Snack`.
