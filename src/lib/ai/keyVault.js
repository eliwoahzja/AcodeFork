const SERVICE = "Authenticator";

function exec(action, args = []) {
	return new Promise((resolve, reject) => {
		if (!globalThis.cordova?.exec) {
			reject(
				new Error("Secure key storage is only available in the Android app."),
			);
			return;
		}
		globalThis.cordova.exec(resolve, reject, SERVICE, action, args);
	});
}

function normalizeProvider(provider) {
	const value = String(provider || "").toLowerCase();
	if (!/^[a-z0-9_-]{1,40}$/.test(value)) {
		throw new Error("Invalid AI provider identifier.");
	}
	return value;
}

export async function saveApiKey(provider, apiKey) {
	const normalized = normalizeProvider(provider);
	const secret = String(apiKey || "").trim();
	if (!secret) throw new Error("API key cannot be empty.");
	await exec("saveAiKey", [normalized, secret]);
}

export async function getApiKey(provider) {
	const value = await exec("getAiKey", [normalizeProvider(provider)]);
	return typeof value === "string" ? value : "";
}

export async function hasApiKey(provider) {
	return !!(await exec("hasAiKey", [normalizeProvider(provider)]));
}

export async function deleteApiKey(provider) {
	await exec("deleteAiKey", [normalizeProvider(provider)]);
}
