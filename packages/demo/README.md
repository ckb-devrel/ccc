This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

### Environment Variables

Before running the development server, you need to configure environment variables for RGB++ features.

Create a `.env.local` file in the `packages/demo` directory with the following variables:

```bash
# BTC Assets API Configuration
# Required: BTC Assets API URL (must be an absolute URL starting with http:// or https://)
NEXT_PUBLIC_BTC_ASSETS_API_URL=https://api-testnet.rgbpp.com

# Optional: BTC Assets API Token (required for mainnet)
NEXT_PUBLIC_BTC_ASSETS_API_TOKEN=

# Optional: BTC Assets API Origin (required for mainnet)
# Your application's origin domain (e.g., localhost:3000, app.example.com)
NEXT_PUBLIC_BTC_ASSETS_API_ORIGIN=
```

**Note:**
- The URL must be an absolute URL (starting with `http://` or `https://`), not a relative path
- For testnet, you can use `https://api-testnet.rgbpp.com`
- For mainnet, you'll need to provide a valid token and origin
- After modifying environment variables, restart the development server

### Run the Development Server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
