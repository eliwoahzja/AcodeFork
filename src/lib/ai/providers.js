export const AI_PROVIDER_PRESETS = Object.freeze({
	openai: {
		label: "OpenAI",
		protocol: "openai",
		endpoint: "https://api.openai.com/v1",
		model: "gpt-4.1-mini",
	},
	openrouter: {
		label: "OpenRouter",
		protocol: "openai",
		endpoint: "https://openrouter.ai/api/v1",
		model: "google/gemini-2.5-flash",
	},
	nvidia: {
		label: "NVIDIA NIM",
		protocol: "openai",
		endpoint: "https://integrate.api.nvidia.com/v1",
		model: "meta/llama-3.1-70b-instruct",
	},
	groq: {
		label: "Groq",
		protocol: "openai",
		endpoint: "https://api.groq.com/openai/v1",
		model: "llama-3.3-70b-versatile",
	},
	together: {
		label: "Together AI",
		protocol: "openai",
		endpoint: "https://api.together.xyz/v1",
		model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
	},
	fireworks: {
		label: "Fireworks AI",
		protocol: "openai",
		endpoint: "https://api.fireworks.ai/inference/v1",
		model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
	},
	mistral: {
		label: "Mistral AI",
		protocol: "openai",
		endpoint: "https://api.mistral.ai/v1",
		model: "codestral-latest",
	},
	deepseek: {
		label: "DeepSeek",
		protocol: "openai",
		endpoint: "https://api.deepseek.com/v1",
		model: "deepseek-chat",
	},
	xai: {
		label: "xAI",
		protocol: "openai",
		endpoint: "https://api.x.ai/v1",
		model: "grok-3-mini",
	},
	cerebras: {
		label: "Cerebras",
		protocol: "openai",
		endpoint: "https://api.cerebras.ai/v1",
		model: "llama-3.3-70b",
	},
	gemini: {
		label: "Google Gemini",
		protocol: "gemini",
		endpoint: "https://generativelanguage.googleapis.com/v1beta",
		model: "gemini-2.5-flash",
	},
	anthropic: {
		label: "Anthropic",
		protocol: "anthropic",
		endpoint: "https://api.anthropic.com/v1",
		model: "claude-3-5-haiku-latest",
	},
	ollama: {
		label: "Ollama / local server",
		protocol: "openai",
		endpoint: "http://127.0.0.1:11434/v1",
		model: "qwen2.5-coder:7b",
		apiKeyOptional: true,
	},
	custom: {
		label: "Custom OpenAI-compatible",
		protocol: "openai",
		endpoint: "",
		model: "",
	},
});

export function getProviderPreset(id) {
	return AI_PROVIDER_PRESETS[id] || AI_PROVIDER_PRESETS.custom;
}

export function getProviderOptions() {
	return Object.entries(AI_PROVIDER_PRESETS).map(([id, preset]) => [
		id,
		preset.label,
	]);
}

export function resolveProviderConfig(settings = {}) {
	const provider = settings.provider || "openrouter";
	const preset = getProviderPreset(provider);
	return {
		provider,
		protocol: preset.protocol,
		endpoint: String(settings.endpoint || preset.endpoint || "").trim(),
		model: String(settings.model || preset.model || "").trim(),
		apiKeyOptional: !!preset.apiKeyOptional,
	};
}
