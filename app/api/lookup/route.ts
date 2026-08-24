import database from "../../../data/roblox-usernames.json";

const numericId = /^\d{1,20}$/;
const username = /^[A-Za-z0-9_]{3,20}$/;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";
const databaseUsernames = new Set(database.usernames.map((value) => value.toLowerCase()));

type RobloxUser = { id: string; name: string; displayName: string };
type GroupRole = { group: { id: number; name: string }; role: { name: string; rank: number } };

function respond(payload: object, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

async function resolveUser(value: string): Promise<RobloxUser | null> {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userInput = searchParams.get("user")?.trim() ?? "";
  const groupId = searchParams.get("groupId")?.trim() ?? "";

  if (!username.test(userInput) || !numericId.test(groupId)) {
    return respond({ error: "Provide a Roblox username and a numeric group ID." }, 400);
  }

  try {
    const user = await resolveUser(userInput);
    if (!user) return respond({ error: "No Roblox user was found for that username.", databaseMatch: false, groupMembershipChecked: false }, 404);

    const userId = user.id;
    if (!databaseUsernames.has(user.name.toLowerCase())) {
      return respond({
        query: { user: userInput, groupId },
        user: { id: userId, username: user.name, displayName: user.displayName },
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
  } catch {
    return respond({
      query: { user: userInput, groupId },
      databaseMatch: false,
      groupMembershipChecked: false,
      error: "Roblox could not complete the lookup right now. Please retry shortly.",
    }, 502);
  }
}

