export async function authHeaders(session: {
  authenticated: boolean;
  getAccessToken?: () => Promise<string | null>;
}) {
  if (!session.authenticated || !session.getAccessToken)
    throw new Error("Log in to continue.");
  const token = await session.getAccessToken();
  if (!token) throw new Error("Your session expired. Log in again.");
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}
