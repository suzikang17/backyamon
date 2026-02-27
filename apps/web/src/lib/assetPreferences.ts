const PREFS_KEY = "backyamon_custom_assets";

export interface AssetPreferences {
  pieceSet?: string;
  sfx?: Partial<Record<string, string>>;
  music?: string;
}

export function getAssetPreferences(): AssetPreferences {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(PREFS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function setAssetPreference<K extends keyof AssetPreferences>(
  key: K,
  value: AssetPreferences[K],
): void {
  const prefs = getAssetPreferences();
  prefs[key] = value;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function clearAssetPreference(key: keyof AssetPreferences): void {
  const prefs = getAssetPreferences();
  delete prefs[key];
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
