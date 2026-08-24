const numericId = /^\d{1,20}$/;
const username = /^[A-Za-z0-9_]{3,20}$/;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";
const INDEX_TTL_MS = 5 * 60 * 1000;

let cachedIds: Set<string> | undefined;
let cacheExpiresAt = 0;

type RobloxUser = { id: string; name: string; displayName: string };
type GroupRole = { group: { id: number; name: string }; role: { name: string; rank: number } };

class DatabaseUnavailable extends Error {}

function respond(payload: object, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

async function resolveUser(value: string): Promise<RobloxUser | null> {
  if (numericId.test(value)) return { id: value, name: value, displayName: value };

  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [value], excludeBannedUsers: false }),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error("Roblox username lookup failed");
  const body = (await response.json()) as { data?: Array<{ id: number; name: string; displayName: string }> };
  const match = body.data?.[0];
  return match ? { ...match, id: String(match.id) } : null;
}

async function getDatabaseIds() {
  if (cachedIds && Date.now() < cacheExpiresAt) return cachedIds;

  const url = process.env.DATABASE_INDEX_URL;
  if (!url) throw new DatabaseUnavailable("The private database index has not been configured.");

  const token = process.env.DATABASE_INDEX_BEARER_TOKEN;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new DatabaseUnavailable("The private database index could not be loaded.");

  const payload = (await response.json()) as { ids?: unknown };
  if (!Array.isArray(payload.ids) || !payload.ids.every((id) => typeof id === "string" && numericId.test(id))) {
    throw new DatabaseUnavailable("The private database index has an invalid format.");
  }

  cachedIds = new Set(payload.ids);
  cacheExpiresAt = Date.now() + INDEX_TTL_MS;
  return cachedIds;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userInput = searchParams.get("user")?.trim() ?? "";
  const groupId = searchParams.get("groupId")?.trim() ?? "";

  if (!(numericId.test(userInput) || username.test(userInput)) || !numericId.test(groupId)) {
    return respond({ error: "Provide a Roblox username or numeric user ID, plus a numeric group ID." }, 400);
  }

  try {
    const user = await resolveUser(userInput);
    if (!user) return respond({ error: "No Roblox user was found for that username.", databaseMatch: false, groupMembershipChecked: false }, 404);

    const userId = user.id;
    const databaseIds = await getDatabaseIds();
    if (!databaseIds.has(userId)) {
      return respond({
        query: { user: userInput, groupId },
        user: { id: userId, username: numericId.test(userInput) ? undefined : user.name, displayName: user.displayName },
        databaseMatch: false,
        groupMembershipChecked: false,
        message: "This profile ID is not present in the imported database, so Roblox group membership was not queried.",
      });
    }

    const response = await fetch(`https://groups.roblox.com/v2/users/${encodeURIComponent(userId)}/groups/roles`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error("Roblox group lookup failed");
    const body = (await response.json()) as { data?: GroupRole[] };
    const role = body.data?.find((entry) => String(entry.group.id) === groupId);

    return respond({
      query: { user: userInput, groupId },
      user: { id: userId, username: user.name, displayName: user.displayName },
      databaseMatch: true,
      groupMembershipChecked: true,
      membership: role
        ? { isMember: true, groupName: role.group.name, roleName: role.role.name, rank: role.role.rank }
        : { isMember: false },
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailable) {
      return respond({ error: error.message, databaseMatch: false, groupMembershipChecked: false }, 503);
    }
    return respond({
      query: { user: userInput, groupId },
      databaseMatch: false,
      groupMembershipChecked: false,
      error: "Roblox could not complete the lookup right now. Please retry shortly.",
    }, 502);
  }
}

