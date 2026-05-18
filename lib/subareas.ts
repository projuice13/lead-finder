import Anthropic from "@anthropic-ai/sdk";
import citySubareas from "@/data/uk-city-subareas.json";

const cityMap = citySubareas as Record<string, string[]>;

export async function getSubareas(city: string): Promise<string[]> {
  // Check hardcoded data first
  const normalized = Object.keys(cityMap).find(
    (k) => k.toLowerCase() === city.toLowerCase()
  );
  if (normalized) {
    return cityMap[normalized];
  }

  // Fall back to Claude API
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `List all distinct neighbourhoods and suburbs of ${city}, UK that would have food and drink businesses. Return ONLY a JSON array of strings, no explanation. Example: ["Area 1", "Area 2"]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse sub-areas from Claude response");

  return JSON.parse(jsonMatch[0]) as string[];
}
