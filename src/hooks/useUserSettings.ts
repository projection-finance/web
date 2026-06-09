"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pf_settings";

export interface UserSettings {
  timelineOpacity: boolean;
  aiModel: string;
}

const defaults: UserSettings = {
  timelineOpacity: true,
  aiModel: "anthropic/claude-sonnet-4.6",
};

function readFromStorage(): UserSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function writeToStorage(settings: UserSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaults);

  // Load from localStorage on mount
  useEffect(() => {
    setSettings(readFromStorage());
  }, []);

  const update = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      writeToStorage(next);
      return next;
    });
  }, []);

  return { settings, update };
}
