# BYNDL Proof of Concept

This repository contains a full stack proof of concept for the **BYNDL** platform.
The goal of BYNDL is to demonstrate that even non‑experts can produce a
complete, VOB‑conform bill of quantities (Leistungsverzeichnis) with a few
simple inputs and the help of an AI‑driven question catalogue. The system
supports the entire workflow from project definition through trade detection,
question collection, LV generation and an admin dashboard for managing
projects and prompts.

## Repository structure

```
byndl/
├── backend/       # Node.js/Express API server
│   ├── server.js  # Application entry point
│   ├── db/
│   │   └── schema.sql    # PostgreSQL schema definitions
│   └── .env.example      # Example environment configuration
├── frontend/      # Vite/React/Tailwind web application
│   ├── public/
│   ├── src/
│   │   ├── pages/        # React pages for the different views
│   │   ├── components/   # Reusable UI components
│   │   ├── App.jsx       # Application router
│   │   └── main.jsx      # Client bootstrap
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── index.html
└── prompts/       # Prompt files used by the AI
    ├── master_prompt.txt
    ├── questions-<trade>.txt
    └── lv-<trade>.txt
```

## Getting started

### Prerequisites

* **Node.js** version 18 or newer
* **npm** (or yarn/pnpm)
* **PostgreSQL** database

> **Note**: In the environment used to generate this PoC, external package
> downloads are restricted, so the dependencies are not installed. Before
> running the backend, you must execute `npm install` in the `backend` and
> `frontend` directories to pull in the required packages.

### Backend setup

1. Copy `backend/.env.example` to `backend/.env` and fill in the values:

   * `DATABASE_URL` – connection string for your PostgreSQL instance
   * `DATABASE_SSL` – set to `true` if your DB requires SSL (e.g. Render)
   * `JWT_SECRET` – secret used to sign JSON Web Tokens
   * `PORT` – port on which the Express server should listen (defaults to 3001)

2. Set up the database:

   ```sh
   psql <database> -f backend/db/schema.sql
   ```

3. Create an admin user. You can do this manually in SQL:

   ```sql
   INSERT INTO users (username, password_hash) VALUES ('admin', '<bcrypt hash>');
   ```

   You can generate a bcrypt hash using Node:

   ```js
   const bcrypt = require('bcryptjs');
   bcrypt.hash('your-password', 10).then(h => console.log(h));
   ```

4. Install dependencies and start the server:

   ```sh
   cd backend
   npm install
   node server.js
   ```

The API will be available at `http://localhost:3001` by default.

### Frontend setup

1. Install dependencies:

   ```sh
   cd frontend
   npm install
   ```

2. Start the development server:

   ```sh
   npm run dev
   ```

   The app will open in your default browser at `http://localhost:5173`.

### Prompts

All AI interactions are driven by prompt files located in the `prompts/` directory.
These files must be provided by domain experts and should **not** be improvised.
There are three categories of prompts:

* `master_prompt.txt` – instructs the AI how to detect relevant trades based on
  the user’s project description.
* `questions-<trade>.txt` – defines the question catalogue for a specific
  trade (e.g. `questions-sanitaer.txt`). Each line beginning with a number will
  be treated as a separate question.
* `lv-<trade>.txt` – template for generating a VOB‑compliant bill of
  quantities for the trade.

The backend exposes an admin endpoint (`POST /api/admin/prompts`) to upload or
replace prompt files at runtime.

### Deployment

The intended deployment strategy is:

* **Frontend** – Deploy the static React build to [Netlify](https://www.netlify.com/) or
  any other static hosting provider. Run `npm run build` in the `frontend`
  directory to produce the production files.
* **Backend** – Host the Express server on [Render](https://render.com/) or a
  similar platform that supports Node.js. Configure the `DATABASE_URL` and
  `DATABASE_SSL` environment variables in your Render settings.
* **Database** – Use a managed PostgreSQL instance (e.g. Render PostgreSQL).

Refer to the hosting providers’ documentation for detailed deployment steps.