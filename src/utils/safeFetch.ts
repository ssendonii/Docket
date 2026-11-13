export async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Network request failed";
    throw new Error(`Unable to reach the server (${detail}). Please check your connection and try again.`);
  }

  const rawBody = await res.text();
  const trimmed = rawBody.trim();

  let parsed: unknown = null;
  if (trimmed.length > 0) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const lower = trimmed.slice(0, 300).toLowerCase();
      if (lower.startsWith("<!doctype") || lower.startsWith("<html") || lower.includes("<html")) {
        throw new Error(
          `Connection or gateway timeout error (HTTP ${res.status}). The server returned an HTML error page instead of JSON. Please retry in a moment.`
        );
      }
      throw new Error(
        `Unexpected response from server (HTTP ${res.status}): ${trimmed.slice(0, 140)}`
      );
    }
  }

  if (!res.ok) {
    const errorMsg =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : `Request failed with HTTP ${res.status}.`;
    throw new Error(errorMsg);
  }

  if (parsed === null) {
    throw new Error(`Server returned an empty response (HTTP ${res.status}).`);
  }

  return parsed as T;
}
