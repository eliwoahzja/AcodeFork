import { getApiKey } from "./keyVault";
import { resolveProviderConfig } from "./providers";

const MAX_PREFIX_CHARS = 24_000;
const MAX_SUFFIX_CHARS = 8_000;
const DEFAULT_TIMEOUT_SECONDS = 25;

function joinUrl(base, path) {
	return `${String(base).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}

function stripCodeFences(value) {
	let text = String(value || "").trimEnd();
	const match = text.match(/^```(?:[\w.+-]+)?\s*\n([\s\S]*?)\n```$/);
	if (match) text = match[1];
	return text.replace(/^<COMPLETION>/, "").replace(/<\/COMPLETION>$/, "");
}

function buildPrompt(context) {
	const prefix = String(context.prefix || "").slice(-MAX_PREFIX_CHARS);
	const suffix = String(context.suffix || "").slice(0, MAX_SUFFIX_CHARS);
	return [
		"Complete the code at <CURSOR>.",
		"Return only the exact text to insert. Do not use Markdown fences or explanations.",
		"CRITICAL: Do NOT generate closing tags, braces, or text that already exist in <SUFFIX>. Stop your generation immediately when it connects to the suffix.",
		`File: ${context.filename || "untitled"}`,
		`Language: ${context.language || "text"}`,
		context.instruction ? `User Instruction: ${context.instruction}` : "",
		"<PREFIX>",
		prefix,
		"</PREFIX>",
		"<CURSOR>",
		"<SUFFIX>",
		suffix,
		"</SUFFIX>",
	].filter(Boolean).join("\n");
}

function parseJsonResponse(response) {
	if (response && typeof response === "object") return response;
	try {
		return JSON.parse(String(response || "{}"));
	} catch {
		throw new Error("The AI provider returned an invalid response.");
	}
}

function createNativeRequest(url, options) {
	let requestId = null;
	let settled = false;
	const promise = new Promise((resolve, reject) => {
		requestId = globalThis.cordova.plugin.http.sendRequest(
			url,
			{
				method: "post",
				serializer: "json",
				responseType: "text",
				connectTimeout: DEFAULT_TIMEOUT_SECONDS,
				readTimeout: DEFAULT_TIMEOUT_SECONDS,
				...options,
			},
			(response) => {
				settled = true;
				if (response.status < 200 || response.status >= 300) {
					reject(new Error(`AI request failed (${response.status}).`));
					return;
				}
				resolve(parseJsonResponse(response.data));
			},
			(error) => {
				settled = true;
				reject(new Error(error?.error || "AI request failed."));
			},
		);
	});
	return {
		promise,
		cancel() {
			if (settled || requestId == null) return;
			globalThis.cordova.plugin.http.abort(
				requestId,
				() => {},
				() => {},
			);
		},
	};
}

function createFetchRequest(url, options) {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		DEFAULT_TIMEOUT_SECONDS * 1000,
	);
	const promise = fetch(url, {
		method: "POST",
		headers: options.headers,
		body: JSON.stringify(options.data),
		signal: controller.signal,
	})
		.then(async (response) => {
			if (!response.ok)
				throw new Error(`AI request failed (${response.status}).`);
			return response.json();
		})
		.finally(() => clearTimeout(timeout));
	return { promise, cancel: () => controller.abort() };
}

function sendJson(url, data, headers) {
	const options = {
		data,
		headers: { "Content-Type": "application/json", ...headers },
	};
	if (globalThis.cordova?.plugin?.http?.sendRequest) {
		return createNativeRequest(url, options);
	}
	return createFetchRequest(url, options);
}

function buildProviderRequest(config, apiKey, prompt, maxTokens) {
	if (config.protocol === "gemini") {
		return {
			url: joinUrl(
				config.endpoint,
				`models/${encodeURIComponent(config.model)}:generateContent`,
			),
			headers: { "x-goog-api-key": apiKey },
			data: {
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0.1,
					maxOutputTokens: maxTokens,
					stopSequences: ["</COMPLETION>"],
				},
			},
			parse: (json) => json?.candidates?.[0]?.content?.parts?.[0]?.text,
		};
	}

	if (config.protocol === "anthropic") {
		return {
			url: joinUrl(config.endpoint, "messages"),
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			data: {
				model: config.model,
				max_tokens: maxTokens,
				temperature: 0.1,
				messages: [{ role: "user", content: prompt }],
			},
			parse: (json) =>
				json?.content?.find?.((part) => part.type === "text")?.text,
		};
	}

	const endpoint = config.endpoint.replace(/\/+$/, "");
	return {
		url: endpoint.endsWith("/chat/completions")
			? endpoint
			: joinUrl(endpoint, "chat/completions"),
		headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
		data: {
			model: config.model,
			messages: [
				{
					role: "system",
					content:
						"You are a precise code completion engine. Output insertion text only. Never repeat code that is already in the suffix.",
				},
				{ role: "user", content: prompt },
			],
			temperature: 0.1,
			max_tokens: maxTokens,
			stream: false,
		},
		parse: (json) => json?.choices?.[0]?.message?.content,
	};
}

export function requestInlineCompletion(context, settings = {}) {
	let activeRequest = null;
	let cancelled = false;
	const maxTokens = Math.max(
		16,
		Math.min(Number(settings.maxTokens) || 128, 512),
	);

	const promise = (async () => {
		if (settings.mode !== "byok") {
			const endpoint = String(settings.managedEndpoint || "").trim();
			if (!endpoint) {
				throw new Error(
					"Set the managed AI gateway URL in AI Autocomplete settings.",
				);
			}
			const normalizedEndpoint = endpoint.replace(/\/+$/, "");
			const completionEndpoint = normalizedEndpoint.endsWith("/v1/completions")
				? normalizedEndpoint
				: joinUrl(normalizedEndpoint, "v1/completions");
			activeRequest = sendJson(
				completionEndpoint,
				{
					prefix: String(context.prefix || "").slice(-MAX_PREFIX_CHARS),
					suffix: String(context.suffix || "").slice(0, MAX_SUFFIX_CHARS),
					filename: context.filename || "untitled",
					language: context.language || "text",
					instruction: context.instruction || "",
					maxTokens,
				},
				{ "X-Acode-AI-Client": "android" },
			);
			const json = await activeRequest.promise;
			if (cancelled) return "";
			return stripCodeFences(json?.completion);
		}

		const provider = resolveProviderConfig(settings);
		if (!provider.endpoint || !provider.model) {
			throw new Error(
				"Configure both an endpoint and model for this provider.",
			);
		}
		const apiKey = provider.apiKeyOptional
			? await getApiKey(provider.provider).catch(() => "")
			: await getApiKey(provider.provider);
		if (!apiKey && !provider.apiKeyOptional) {
			throw new Error(
				`Add an API key for ${provider.provider} in AI Autocomplete settings.`,
			);
		}
		if (cancelled) return "";
		const request = buildProviderRequest(
			provider,
			apiKey,
			buildPrompt(context),
			maxTokens,
		);
		activeRequest = sendJson(request.url, request.data, request.headers);
		const json = await activeRequest.promise;
		if (cancelled) return "";
		return stripCodeFences(request.parse(json));
	})();

	return {
		promise,
		cancel() {
			cancelled = true;
			activeRequest?.cancel?.();
		},
	};
}
