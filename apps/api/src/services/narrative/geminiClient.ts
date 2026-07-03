const MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_TOKENS = 300;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/** Returns null (never throws) on any failure — the caller falls back to the deterministic template. */
export async function generateNarrativeText(apiKey: string, system: string, user: string): Promise<string | null> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_TOKENS,
        },
      }),
    });

    if (!response.ok) {
      console.error(JSON.stringify({ event: "gemini_error", status: response.status }));
      return null;
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    return text?.trim() || null;
  } catch (error) {
    console.error(JSON.stringify({ event: "gemini_fetch_failed", error: String(error) }));
    return null;
  }
}
