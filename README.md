# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

## 🛡️ Project Maintenance & Health Audit

We have implemented a systemic audit tool to ensure the project remains stable and synchronized. You can run it anytime to verify the status of migrations, business logic (tests), and production build compatibility.

### Run Systemic Audit
To perform a full project health check, run the following command in your terminal:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/maintain.ps1
```

This tool verifies:
- **Supabase Sync**: Ensures local and remote migrations are identical.
- **Logic Integrity**: Runs the full suite of 35 Vitest cases for enrollment rules.
- **Vercel Readiness**: Validates that the Vite production build completes successfully.

## 🚀 Deployment

The project is optimized for deployment on **Vercel**. 
- **Security**: `vercel.json` includes strict security headers (HSTS, CSP, X-Frame-Options).
- **SEO**: A basic `robots.txt` is included in the `public/` directory to manage search engine crawling.

## 📂 Project Structure Note

- **`supabase/migrations/`**: Has been squashed into a single baseline `20260100000000_initial_schema.sql` for a clean start.
- **`supabase/scripts/dev/`**: Contains dangerous or administrative scripts like `reset_data.sql` that are excluded from automatic migrations.

