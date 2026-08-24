# Severe Database Group Lookup

A Vercel-ready Next.js tool that checks whether a Roblox account represented in an imported database currently belongs to a given Roblox group.

## How it works

1. It resolves a Roblox username (or accepts a numeric Roblox user ID).
2. It loads a compact profile-ID index from a private URL, holds it in memory for five minutes, and performs a constant-time match.
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

## Configure the private database index

The source data and its generated profile-ID index are deliberately excluded from this public repository. Generate an index from a newer export:

```bash
npm run build:data -- "C:\path\to\Severe Injection Database - Refined Raw Data.csv"
```

Upload the generated `data/cheater-user-ids.json` to a private object store or authenticated HTTPS endpoint, then configure these Vercel environment variables:

- `DATABASE_INDEX_URL` — the private HTTPS URL serving the generated JSON index.
- `DATABASE_INDEX_BEARER_TOKEN` — optional bearer token sent when fetching the index.

The index must contain an `ids` array of numeric Roblox profile IDs, exactly as produced by the build script. It is cached in each warm serverless instance for five minutes; each lookup remains an O(1) set membership check after that first load.

## Deploy to Vercel

Import this GitHub repository in Vercel and use the default settings:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: leave blank

The project builds with the default Vercel settings. Add `DATABASE_INDEX_URL` (and, if required, `DATABASE_INDEX_BEARER_TOKEN`) before using the lookup API; otherwise it returns a clear `503` configuration error. Vercel's CDN caches identical completed lookup responses at the edge.

