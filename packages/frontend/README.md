TaskForge dashboard built with Next.js.

## Getting Started

First, set the API URL if it is not running on `http://localhost:3000`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Then run the development server:

```bash
npm run dev --workspace=frontend
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the dashboard.

The dashboard uses a system font stack so production builds do not depend on fetching remote fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy On Vercel

Set `NEXT_PUBLIC_API_URL` in the Vercel project environment to the deployed API base URL.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
