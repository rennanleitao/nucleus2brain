import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AIProvider = "lovable" | "openai" | "openrouter" | "google" | "anthropic";

export interface AIRouterOptions {
  allowLegacyProviders?: boolean;
  defaultModel?: string;
}

export interface AICompletionRequest {
  model?: string;
  messages: unknown[];
  tools?: unknown[];
  tool_choice?: unknown;
  stream?: boolean;
  [key: string]: unknown;
}

export interface AIRouterResult {
  provider: AIProvider;
  model: string;
  response: Response;
}

export class AIRouterConfigurationError extends Error {
  constructor(public provider: AIProvider) {
    super(`API key not configured for ${provider}`);
    this.name = "AIRouterConfigurationError";
  }
}

const PROVIDERS: Record<AIProvider, { url: string; defaultModel: string }> = {
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    defaultModel: "google/gemini-2.5-flash",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4.1-mini",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "google/gemini-3.5-flash",
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-3.5-flash",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
  },
};

const PRIMARY_PROVIDERS = new Set<AIProvider>(["lovable", "openai", "openrouter", "google"]);

function isSupportedProvider(value: string): value is AIProvider {
  return value in PROVIDERS;
}

export function isConfigurableAIProvider(value: string): value is Exclude<AIProvider, "lovable"> {
  return isSupportedProvider(value) && value !== "lovable";
}

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error) {
    console.warn("ai-router: unable to resolve authenticated user", error.message);
  }
  return user?.id ?? null;
}

async function resolveProvider(req: Request, options: AIRouterOptions): Promise<{
  provider: AIProvider;
  model: string;
  apiKey: string;
}> {
  const userId = await getAuthenticatedUserId(req);
  let configuredProvider = "lovable";
  let configuredModel: string | null = null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const serviceClient = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

  if (userId && serviceClient) {
    const { data: settings, error } = await serviceClient
      .from("ai_settings")
      .select("provider, model")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Unable to load AI settings: ${error.message}`);

    configuredProvider = settings?.provider || "lovable";
    configuredModel = settings?.model || null;
  }

  let provider: AIProvider;
  if (
    isSupportedProvider(configuredProvider) &&
    (PRIMARY_PROVIDERS.has(configuredProvider) || options.allowLegacyProviders)
  ) {
    provider = configuredProvider;
  } else {
    // Providers outside this POC keep the function's previous Lovable behavior.
    console.warn(`ai-router: ${configuredProvider} is not supported yet; using lovable`);
    provider = "lovable";
    configuredModel = null;
  }

  const model = configuredModel ||
    (provider === "lovable" ? options.defaultModel : undefined) ||
    PROVIDERS[provider].defaultModel;

  if (provider === "lovable") {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    return { provider, model, apiKey };
  }

  if (!userId || !serviceClient) {
    throw new AIRouterConfigurationError(provider);
  }

  const { data: keyData, error } = await serviceClient
    .from("user_api_keys")
    .select("api_key")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(`Unable to load ${provider} API key: ${error.message}`);
  if (!keyData?.api_key) throw new AIRouterConfigurationError(provider);

  return { provider, model, apiKey: keyData.api_key };
}

export async function routeAICompletion(
  req: Request,
  completion: AICompletionRequest,
  options: AIRouterOptions = {},
): Promise<AIRouterResult> {
  const { provider, model, apiKey } = await resolveProvider(req, options);
  const providerConfig = PROVIDERS[provider];

  if (provider === "anthropic") {
    return routeAnthropicCompletion(providerConfig.url, model, apiKey, completion);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") {
    headers["X-Title"] = "Nucleus";
  }

  const response = await fetch(providerConfig.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...completion, model }),
  });

  return { provider, model, response };
}

export async function testAIProviderConnection(
  provider: Exclude<AIProvider, "lovable">,
  model: string,
  apiKey: string,
): Promise<Response> {
  const completion: AICompletionRequest = {
    messages: [{ role: "user", content: "Reply only with OK." }],
    max_tokens: 4,
  };
  const providerConfig = PROVIDERS[provider];

  if (provider === "anthropic") {
    const result = await routeAnthropicCompletion(providerConfig.url, model, apiKey, completion);
    return result.response;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") headers["X-Title"] = "Nucleus";

  return fetch(providerConfig.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...completion, model }),
  });
}

async function routeAnthropicCompletion(
  url: string,
  model: string,
  apiKey: string,
  completion: AICompletionRequest,
): Promise<AIRouterResult> {
  const messages = completion.messages as Array<{ role?: string; content?: unknown }>;
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter((content): content is string => typeof content === "string")
    .join("\n\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: typeof completion.max_tokens === "number" ? completion.max_tokens : 4096,
      ...(system ? { system } : {}),
      messages: messages.filter((message) => message.role !== "system"),
      stream: completion.stream ?? false,
    }),
  });

  if (!response.ok) return { provider: "anthropic", model, response };

  const compatibleResponse = completion.stream
    ? transformAnthropicStream(response)
    : await transformAnthropicResponse(response);
  return { provider: "anthropic", model, response: compatibleResponse };
}

function transformAnthropicStream(response: Response): Response {
  const source = response.body;
  if (!source) return response;

  let buffer = "";
  let doneSent = false;
  const transformed = source
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream<string, string>({
      transform(chunk, controller) {
        buffer += chunk;
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload);
            if (event.type === "content_block_delta" && event.delta?.text) {
              controller.enqueue(`data: ${JSON.stringify({ choices: [{ delta: { content: event.delta.text } }] })}\n\n`);
            } else if (event.type === "message_stop") {
              controller.enqueue("data: [DONE]\n\n");
              doneSent = true;
            }
          } catch {
            // Ignore malformed SSE events without breaking the response stream.
          }
        }
      },
      flush(controller) {
        if (!doneSent) controller.enqueue("data: [DONE]\n\n");
      },
    }))
    .pipeThrough(new TextEncoderStream());

  return new Response(transformed, {
    status: response.status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function transformAnthropicResponse(response: Response): Promise<Response> {
  const data = await response.json();
  const content = Array.isArray(data?.content)
    ? data.content.filter((block: { type?: string }) => block.type === "text").map((block: { text?: string }) => block.text || "").join("")
    : "";
  return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
