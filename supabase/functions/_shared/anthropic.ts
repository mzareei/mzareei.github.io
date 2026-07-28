// Thin Claude API client for the generation pipeline.
//
// Everything the pipeline asks for is structured, so each call goes out with a
// tool definition and comes back as a validated tool_use input rather than
// prose we would have to parse. `ANTHROPIC_API_KEY` is a Supabase secret and
// never leaves the edge function.

const apiUrl = "https://api.anthropic.com/v1/messages";
const apiVersion = "2023-06-01";
const defaultModel = "claude-sonnet-5";

export function anthropicKey() {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Set it with: supabase secrets set ANTHROPIC_API_KEY=sk-ant-..."
    );
  }
  return key;
}

export function hasAnthropicKey() {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}

/** Base64 in fixed-size chunks — a lecture PDF is megabytes, and spreading one
 *  giant byte array across String.fromCharCode blows the call stack. */
export function toBase64(bytes: Uint8Array) {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function pdfBlock(base64: string) {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
}

export function textBlock(text: string) {
  return { type: "text", text };
}

/**
 * One structured call. `schema` is the JSON Schema of the object we want back;
 * the model is forced to answer through a single tool so the result is already
 * shaped, and anything else it might have said is discarded.
 */
export async function generateStructured(input: {
  system: string;
  content: unknown[];
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  model?: string;
}): Promise<Record<string, unknown>> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey(),
      "anthropic-version": apiVersion
    },
    body: JSON.stringify({
      model: input.model || Deno.env.get("ANTHROPIC_MODEL") || defaultModel,
      max_tokens: input.maxTokens ?? 8000,
      system: input.system,
      tools: [{
        name: input.toolName,
        description: input.toolDescription,
        input_schema: input.schema
      }],
      tool_choice: { type: "tool", name: input.toolName },
      messages: [{ role: "user", content: input.content }]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude API ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();
  const block = (payload.content || []).find((entry: Record<string, unknown>) =>
    entry.type === "tool_use" && entry.name === input.toolName
  );
  if (!block) {
    const stop = payload.stop_reason ? ` (stop_reason: ${payload.stop_reason})` : "";
    throw new Error(`Claude did not return ${input.toolName} output${stop}.`);
  }
  return block.input as Record<string, unknown>;
}
