interface Env {
	GEMINI_API_KEY?: string;
	NVIDIA_API_KEY?: string;
	ALLOWED_ORIGINS?: string;
	GEMINI_MODEL?: string;
	NVIDIA_MODEL?: string;
	RATE_LIMIT_PER_MINUTE?: string;
	REQUEST_TIMEOUT_MS?: string;
}

interface CompletionInput {
	prefix: string;
	suffix: string;
	filename: string;
	language: string;
	maxTokens: number;
}

interface RateEntry {
	windowStart: number;
	count: number;
}

const MAX_BODY_BYTES = 32_000;
const MAX_PREFIX_CHARS = 12_000;
const MAX_SUFFIX_CHARS = 4_000;
const rateEntries = new Map<string, RateEntry>();

class ProviderError extends Error {
	constructor(readonly provider: string, message: string) {
		super(message);
	}
}

function corsHeaders(request: Request, env: Env): HeadersInit {
	const origin = request.headers.get("Origin");
	const allowed = new Set(
		String(env.ALLOWED_ORIGINS || "")
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean),
	);
	const headers: Record<string, string> = {
		Vary: "Origin",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, X-Acode-AI-Client",
		"Access-Control-Max-Age": "86400",
	};
	if (origin && allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
	return headers;
}

function json(
	request: Request,
	env: Env,
	body: unknown,
	status = 200,
	extraHeaders: HeadersInit = {},
): Response {
	return Response.json(body, {
		status,
		headers: {
			...corsHeaders(request, env),
			"Cache-Control": "no-store",
			...extraHeaders,
		},
	});
}

function isOriginAllowed(request: Request, env: Env): boolean {
	const origin = request.headers.get("Origin");
	if (!origin) return true;
	return String(env.ALLOWED_ORIGINS || "")
		.split(",")
		.map((value) => value.trim())
		.includes(origin);
}

function clientId(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

function checkRateLimit(request: Request, env: Env): {
	allowed: boolean;
	remaining: number;
	retryAfter: number;
} {
	const now = Date.now();
	const windowMs = 60_000;
	const configured = Number(env.RATE_LIMIT_PER_MINUTE);
	const limit = Number.isFinite(configured)
		? Math.max(1, Math.min(Math.floor(configured), 300))
		: 30;
	const id = clientId(request);
	let entry = rateEntries.get(id);
	if (!entry || now - entry.windowStart >= windowMs) {
		entry = { windowStart: now, count: 0 };
		rateEntries.set(id, entry);
	}
	entry.count++;

	if (rateEntries.size > 5000) {
		for (const [key, value] of rateEntries) {
			if (now - value.windowStart >= windowMs) rateEntries.delete(key);
		}
	}

	return {
		allowed: entry.count <= limit,
		remaining: Math.max(0, limit - entry.count),
		retryAfter: Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000)),
	};
}

async function readInput(request: Request): Promise<CompletionInput> {
	const declaredLength = Number(request.headers.get("Content-Length") || 0);
	if (declaredLength > MAX_BODY_BYTES) throw new Error("Request body is too large");
	const raw = await request.text();
	if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
		throw new Error("Request body is too large");
	}

	let value: Record<string, unknown>;
	try {
		value = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		throw new Error("Request body must be valid JSON");
	}
	if (typeof value.prefix !== "string" || typeof value.suffix !== "string") {
		throw new Error("prefix and suffix must be strings");
	}
	if (
		value.prefix.length > MAX_PREFIX_CHARS ||
		value.suffix.length > MAX_SUFFIX_CHARS
	) {
		throw new Error("Code context exceeds the allowed size");
	}
	const requestedTokens = Number(value.maxTokens);
	return {
		prefix: value.prefix,
		suffix: value.suffix,
		filename: String(value.filename || "untitled").slice(0, 300),
		language: String(value.language || "text").slice(0, 80),
		maxTokens: Number.isFinite(requestedTokens)
			? Math.max(16, Math.min(Math.floor(requestedTokens), 512))
			: 128,
	};
}

function promptFor(input: CompletionInput): string {
	return [
		"Complete the code at <CURSOR>.",
		"Return only insertion text, without Markdown fences or explanation.",
		"Preserve indentation and do not repeat text after the cursor.",
		`File: ${input.filename}`,
		`Language: ${input.language}`,
		"<PREFIX>",
		input.prefix,
		"</PREFIX>",
		"<CURSOR>",
		"<SUFFIX>",
		input.suffix,
		"</SUFFIX>",
	].join("\n");
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	env: Env,
): Promise<Response> {
	const configured = Number(env.REQUEST_TIMEOUT_MS);
	const timeoutMs = Number.isFinite(configured)
		? Math.max(1000, Math.min(Math.floor(configured), 30_000))
		: 20_000;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

function cleanCompletion(value: unknown): string {
	let text = String(value || "").trimEnd();
	const fence = text.match(/^```(?:[\w.+-]+)?\s*\n([\s\S]*?)\n```$/);
	if (fence) text = fence[1];
	return text
		.replace(/^<COMPLETION>/, "")
		.replace(/<\/COMPLETION>$/, "")
		.slice(0, 16_000);
}

async function completeWithGemini(
	input: CompletionInput,
	env: Env,
): Promise<string> {
	if (!env.GEMINI_API_KEY) throw new ProviderError("gemini", "not configured");
	const model = env.GEMINI_MODEL || "gemini-2.5-flash";
	const response = await fetchWithTimeout(
		`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": env.GEMINI_API_KEY,
			},
			body: JSON.stringify({
				contents: [{ role: "user", parts: [{ text: promptFor(input) }] }],
				generationConfig: {
					temperature: 0.1,
					maxOutputTokens: input.maxTokens,
				},
			}),
		},
		env,
	);
	if (!response.ok) {
		throw new ProviderError("gemini", `upstream status ${response.status}`);
	}
	const body = (await response.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	const completion = cleanCompletion(body.candidates?.[0]?.content?.parts?.[0]?.text);
	if (!completion) throw new ProviderError("gemini", "empty response");
	return completion;
}

async function completeWithNvidia(
	input: CompletionInput,
	env: Env,
): Promise<string> {
	if (!env.NVIDIA_API_KEY) throw new ProviderError("nvidia", "not configured");
	const response = await fetchWithTimeout(
		"https://integrate.api.nvidia.com/v1/chat/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
			},
			body: JSON.stringify({
				model: env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
				messages: [
					{
						role: "system",
						content: "You are a precise code completion engine. Output insertion text only.",
					},
					{ role: "user", content: promptFor(input) },
				],
				temperature: 0.1,
				max_tokens: input.maxTokens,
				stream: false,
			}),
		},
		env,
	);
	if (!response.ok) {
		throw new ProviderError("nvidia", `upstream status ${response.status}`);
	}
	const body = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const completion = cleanCompletion(body.choices?.[0]?.message?.content);
	if (!completion) throw new ProviderError("nvidia", "empty response");
	return completion;
}

async function handleCompletion(request: Request, env: Env): Promise<Response> {
	const rate = checkRateLimit(request, env);
	const rateHeaders = {
		"X-RateLimit-Remaining": String(rate.remaining),
		...(rate.allowed ? {} : { "Retry-After": String(rate.retryAfter) }),
	};
	if (!rate.allowed) {
		return json(request, env, { error: "Rate limit exceeded" }, 429, rateHeaders);
	}

	let input: CompletionInput;
	try {
		input = await readInput(request);
	} catch (error) {
		return json(
			request,
			env,
			{ error: error instanceof Error ? error.message : "Invalid request" },
			400,
			rateHeaders,
		);
	}

	try {
		const completion = await completeWithGemini(input, env);
		return json(request, env, { completion, provider: "gemini" }, 200, rateHeaders);
	} catch (geminiError) {
		console.warn("Gemini completion failed; trying NVIDIA", geminiError);
		try {
			const completion = await completeWithNvidia(input, env);
			return json(request, env, { completion, provider: "nvidia" }, 200, rateHeaders);
		} catch (nvidiaError) {
			console.error("All completion providers failed", nvidiaError);
			return json(
				request,
				env,
				{ error: "Completion providers are temporarily unavailable" },
				503,
				rateHeaders,
			);
		}
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (!isOriginAllowed(request, env)) {
			return json(request, env, { error: "Origin is not allowed" }, 403);
		}
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders(request, env) });
		}
		if (request.method === "GET" && url.pathname === "/health") {
			return json(request, env, {
				ok: true,
				providers: {
					gemini: Boolean(env.GEMINI_API_KEY),
					nvidia: Boolean(env.NVIDIA_API_KEY),
				},
			});
		}
		if (request.method === "POST" && url.pathname === "/v1/completions") {
			return handleCompletion(request, env);
		}
		return json(request, env, { error: "Not found" }, 404);
	},
};
