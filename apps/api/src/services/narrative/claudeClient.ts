const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 300;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

/** Returns null (never throws) on any failure — the caller falls back to the deterministic template. */
export async function generateNarrativeText(apiKey: string, system: string, user: string): Promise<string | null> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      console.error(JSON.stringify({ event: "anthropic_error", status: response.status }));
      return null;
    }

    const data = (await response.json()) as AnthropicResponse;
    const textBlock = data.content.find((block) => block.type === "text");
    return textBlock?.text?.trim() ?? null;
  } catch (error) {
    console.error(JSON.stringify({ event: "anthropic_fetch_failed", error: String(error) }));
    return null;
  }
}
