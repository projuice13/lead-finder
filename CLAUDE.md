# Project notes for Claude

## Deployment / production

This project is hosted on **Vercel**. The `main` branch is the production branch —
every push to `main` automatically triggers a live production deploy. There is no
separate staging environment or manual deploy step.

**Standing instruction from the project owner:** after committing changes, push them
to production. In practice this means: merge the working branch into `main` and push
`main` to `origin`. Changes go live to users as soon as the Vercel build finishes.

## Tech stack

- Next.js 14 (App Router)
- Prisma ORM
- Tailwind CSS
