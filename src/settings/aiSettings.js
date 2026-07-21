import settingsPage from "components/settingsPage";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import { deleteApiKey, saveApiKey } from "lib/ai/keyVault";
import { getProviderOptions, getProviderPreset } from "lib/ai/providers";
import appSettings from "lib/settings";

const fallbackSettings = {
	enabled: false,
	mode: "managed",
	managedEndpoint: "",
	provider: "openrouter",
	endpoint: "",
	model: "",
	maxTokens: 128,
	debounceMs: 650,
};

function currentSettings() {
	return { ...fallbackSettings, ...(appSettings.value.aiCompletion || {}) };
}

async function updateAiSettings(patch) {
	await appSettings.update({
		aiCompletion: { ...currentSettings(), ...patch },
	});
}

export default function aiSettings() {
	let page = createPage();
	return {
		show(goTo) {
			page = createPage();
			page.show(goTo);
		},
		hide() {
			page.hide();
		},
		search(key) {
			page = createPage();
			return page.search(key);
		},
		restoreList() {
			page.restoreList();
		},
		setTitle(title) {
			page.setTitle(title);
		},
	};
}

function createPage() {
	const values = currentSettings();
	const preset = getProviderPreset(values.provider);
	const categories = {
		general: "General",
		managed: "Managed service (default)",
		byok: "Bring your own key",
		behavior: "Completion behavior",
	};
	const items = [
		{
			key: "enabled",
			text: "AI inline autocomplete",
			checkbox: values.enabled,
			info: "Show private, current-file ghost-text suggestions while you type.",
			category: categories.general,
		},
		{
			key: "mode",
			text: "Connection mode",
			value: values.mode,
			select: [
				["managed", "Managed (recommended)"],
				["byok", "Bring your own API key"],
			],
			valueText: (value) =>
				value === "byok" ? "Bring your own key" : "Managed",
			info: "Managed mode never stores provider credentials in the APK.",
			category: categories.general,
		},
		{
			key: "managedEndpoint",
			text: "Managed gateway URL",
			value: values.managedEndpoint,
			valueText: (value) => value || "Not configured",
			prompt: "Managed AI gateway HTTPS URL",
			promptType: "url",
			promptOptions: {
				capitalize: false,
				test(value) {
					return !value || /^https:\/\//i.test(String(value));
				},
			},
			info: "Required only for managed mode. Deploy the included gateway and enter its URL.",
			category: categories.managed,
		},
		{
			key: "provider",
			text: "BYOK provider",
			value: values.provider,
			select: getProviderOptions(),
			valueText: (value) => getProviderPreset(value).label,
			info: "Choose a preset or an OpenAI-compatible custom server.",
			category: categories.byok,
		},
		{
			key: "endpoint",
			text: "Custom endpoint",
			value: values.endpoint,
			valueText: (value) => value || preset.endpoint || "Required",
			prompt: "API base URL (leave empty to use the provider default)",
			promptType: "url",
			promptOptions: {
				capitalize: false,
				test(value) {
					return !value || /^https?:\/\//i.test(String(value));
				},
			},
			info: "Optional for presets. HTTP is allowed for local providers such as Ollama.",
			category: categories.byok,
		},
		{
			key: "model",
			text: "Model",
			value: values.model,
			valueText: (value) => value || preset.model || "Required",
			prompt: "Model identifier (leave empty to use the provider default)",
			promptOptions: { capitalize: false },
			info: "Provider-specific model name.",
			category: categories.byok,
		},
		{
			key: "save-api-key",
			text: "Save or replace API key",
			info: "Stored with Android EncryptedSharedPreferences; never written to settings.json.",
			chevron: true,
			category: categories.byok,
		},
		{
			key: "delete-api-key",
			text: "Delete API key",
			info: `Remove the encrypted key stored for ${preset.label}.`,
			chevron: true,
			category: categories.byok,
		},
		{
			key: "maxTokens",
			text: "Maximum completion tokens",
			value: values.maxTokens,
			prompt: "Maximum tokens (16–512)",
			promptType: "number",
			promptOptions: {
				test(value) {
					const number = Number(value);
					return Number.isInteger(number) && number >= 16 && number <= 512;
				},
			},
			info: "Shorter completions are faster and use fewer provider credits.",
			category: categories.behavior,
		},
		{
			key: "debounceMs",
			text: "Typing delay",
			value: values.debounceMs,
			valueText: (value) => `${value} ms`,
			prompt: "Delay after typing (150–5000 ms)",
			promptType: "number",
			promptOptions: {
				test(value) {
					const number = Number(value);
					return Number.isInteger(number) && number >= 150 && number <= 5000;
				},
			},
			info: "Requests are cancelled whenever the document or cursor changes.",
			category: categories.behavior,
		},
	];

	return settingsPage("AI Autocomplete", items, callback, undefined, {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		infoAsDescription: true,
		valueInTail: true,
	});

	async function callback(key, value) {
		try {
			switch (key) {
				case "save-api-key": {
					const apiKey = await prompt(
						`API key for ${getProviderPreset(currentSettings().provider).label}`,
						"",
						"password",
						{ required: true, capitalize: false },
					);
					if (apiKey === null) return;
					await saveApiKey(currentSettings().provider, apiKey);
					toast("API key saved in encrypted Android storage.");
					return;
				}
				case "delete-api-key": {
					const provider = currentSettings().provider;
					const approved = await confirm(
						"Delete API key?",
						`Remove the stored key for ${getProviderPreset(provider).label}?`,
					);
					if (!approved) return;
					await deleteApiKey(provider);
					toast("API key deleted.");
					return;
				}
				case "provider":
					await updateAiSettings({ provider: value, endpoint: "", model: "" });
					return;
				default:
					await updateAiSettings({ [key]: value });
			}
		} catch (error) {
			console.error("Unable to update AI autocomplete settings", error);
			toast(error?.message || "Unable to update AI autocomplete settings.");
		}
	}
}
