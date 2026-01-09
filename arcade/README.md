# ARCade Frontend

Next.js frontend for ARCade on Arc - a decentralized gaming platform on the Arc L1 testnet.

## Tech Stack

- **Framework:** Next.js 16.1.1 with App Router
- **Language:** TypeScript 5.x
- **Styling:** TailwindCSS + Custom CSS Design System
- **Blockchain:** Viem 2.43.3, Wagmi 3.1.3
- **Wallet:** Dynamic Labs SDK
- **Database:** Supabase (PostgreSQL)
- **Cache/Sessions:** Upstash Redis
- **State:** React Context + TanStack Query

## Prerequisites

- Node.js 20+
- npm/yarn/pnpm
- Supabase account
- Upstash Redis account
- Dynamic Labs account

## Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env.local
```

2. Generate required secrets:
```bash
# Generate SESSION_SECRET
openssl rand -hex 32

# Generate CRON_SECRET
openssl rand -hex 32

# Generate SIGNER_PRIVATE_KEY (or use existing wallet)
# Option 1: Use MetaMask export
# Option 2: Generate new: cast wallet new
```

3. Fill in all REQUIRED variables in `.env.local`:
   - `SESSION_SECRET` - JWT signing key (must be different from SIGNER_PRIVATE_KEY)
   - `SIGNER_PRIVATE_KEY` - Wallet for signing game outcomes
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
   - `KV_REST_API_URL` - Upstash Redis URL
   - `KV_REST_API_TOKEN` - Upstash Redis token
   - `CRON_SECRET` - Secret for cron job authentication

See `.env.example` for complete documentation.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (authentication, games, balance)
│   ├── games/             # Game pages (dice, crash, tower, wheel, laser)
│   └── providers.tsx      # React Context providers
├── components/            # Reusable React components
├── lib/                   # Utilities, hooks, and libraries
│   ├── abi.ts            # Smart contract ABIs
│   ├── constants.ts      # Contract addresses and config
│   ├── session.ts        # Authentication and JWT
│   ├── supabase.ts       # Database client
│   ├── redis.ts          # Cache client
│   └── hooks/            # Custom React hooks
└── styles/               # Global styles and design system
```

## Key Features

- **Multi-layer Authentication:**
  - Dynamic wallet connection
  - Challenge-response signature verification
  - JWT session management

- **Rate Limiting:**
  - Distributed rate limiting via Redis
  - 20 requests/minute per IP

- **Security:**
  - HttpOnly cookies
  - CORS protection
  - Input validation
  - Structured logging

## Security Notes

⚠️ **Critical Security Requirements:**

1. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
2. Never reuse `SESSION_SECRET` as `SIGNER_PRIVATE_KEY`
3. Always validate user authentication before sensitive operations
4. Keep `.env.local` out of version control
5. Rotate secrets regularly in production

## Deployment

This app is optimized for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy

Vercel will automatically:
- Build the Next.js app
- Set up serverless functions for API routes
- Configure cron jobs (weekly distribution)
- Enable edge caching

## API Routes

See [API Documentation](../README.md#api-endpoints) in the main README.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License - See [LICENSE](../LICENSE) for details
