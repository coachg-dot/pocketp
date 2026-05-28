const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase();

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) return defaultValue;
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	// Env vars (injected at build time by Vite) always win over stale localStorage. [v2 — capacitor-safe]
	// This is critical for Capacitor: localStorage may be empty on fresh install,
	// and window.location is "capacitor://localhost/" so URL params are never present.
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) return storedValue;
	return null;
};

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}

	// In Capacitor native WebView, window.location.href = "capacitor://localhost/"
	// which is useless as a fromUrl. Use a sensible fallback.
	const isCapacitor = typeof window !== 'undefined' &&
		(window.Capacitor?.isNativePlatform?.() ||
		 window.location?.protocol === 'capacitor:' ||
		 window.location?.protocol === 'ionic:');
	const safeFromUrl = isCapacitor
		? (import.meta.env.VITE_BASE44_APP_BASE_URL || 'https://base44.com')
		: window.location.href;

	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: safeFromUrl,
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
	};
};

export const appParams = {
	...getAppParams()
};
