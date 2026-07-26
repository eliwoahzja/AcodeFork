const SERVICE = "Authenticator";
const STORAGE_KEY = "acode_ai_keys";

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

function getLocalStore() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
	} catch {
		return {};
	}
}

function setLocalStore(store) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export async function saveApiKey(provider, apiKey) {
	const normalized = normalizeProvider(provider);
	const secret = String(apiKey || "").trim();
	if (!secret) throw new Error("API key cannot be empty.");
	try {
		await exec("saveAiKey", [normalized, secret]);
	} catch {
		const store = getLocalStore();
		store[normalized] = secret;
		setLocalStore(store);
	}
}

export async function getApiKey(provider) {
	const normalized = normalizeProvider(provider);
	try {
		const value = await exec("getAiKey", [normalized]);
		return typeof value === "string" ? value : "";
	} catch {
		return getLocalStore()[normalized] || "";
	}
}

export async function hasApiKey(provider) {
	const normalized = normalizeProvider(provider);
	try {
		return !!(await exec("hasAiKey", [normalized]));
	} catch {
		return !!getLocalStore()[normalized];
	}
}

export async function deleteApiKey(provider) {
	const normalized = normalizeProvider(provider);
	try {
		await exec("deleteAiKey", [normalized]);
	} catch {
		const store = getLocalStore();
		delete store[normalized];
		setLocalStore(store);
	}
}
