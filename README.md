# Severe Database Group Lookup

A Vercel-ready Next.js tool that checks whether a Roblox account represented in an imported database currently belongs to a given Roblox group.

## How it works

1. It resolves a Roblox username (or accepts a numeric Roblox user ID).
2. It performs a constant-time match against the compact profile-ID index generated from the supplied CSV.
3. Only when the profile is present, it queries Roblox's group-role API and reports whether that user is in the supplied group.

The source CSV contains profile IDs and no historical or current group-membership data. Group membership is consequently a live Roblox check, not a claim stored in the CSV. A database match only indicates that the profile ID occurs in the imported source.

## Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## API

```
GET /api/lookup?user=<Roblox username or user ID>&groupId=<Roblox group ID>
```

Example response fields:

```json
{
  "databaseMatch": true,
  "groupMembershipChecked": true,
  "membership": { "isMember": true, "groupName": "Example", "roleName": "Member", "rank": 1 }
}
```

Exact successful lookup responses use a five-minute shared-cache TTL (`s-maxage=300`) with one-hour stale-while-revalidate. This reduces repeated Roblox API calls. Unmatched profiles intentionally skip the Roblox group request.

## Refreshing the database index

The app deliberately stores only the profile-ID lookup index, not the raw CSV. To rebuild it from a newer export:

```bash
npm run build:data -- "C:\path\to\Severe Injection Database - Refined Raw Data.csv"
```

Review the generated `data/cheater-user-ids.json`, commit it, and redeploy.

## Deploy to Vercel

Import this GitHub repository in Vercel and use the default settings:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: leave blank

No environment variables or database are required. Vercel's CDN caches identical lookup responses at the edge.

