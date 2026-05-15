import AsyncStorage from "@react-native-async-storage/async-storage";
import { Storage } from "expo-sqlite/kv-store";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";

export const PRAYER_STORAGE_KEY = "prayer-times";
export const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export type PrayerName = (typeof PRAYER_KEYS)[number];
export type StoredTimings = Record<PrayerName, string>;

export interface StoredState {
  dateISO: string; // "YYYY-MM-DD" (device-local)
  lat: number;
  lng: number;
  method: number; // Aladhan method id
  school: 0 | 1; // 0: Shafi, 1: Hanafi
  timings: StoredTimings; // e.g. { Maghrib: "17:32" }
  tz: string; // e.g. "Asia/Jakarta"
  completed?: Record<string, boolean>; // e.g. { Fajr: true }
}

export async function saveState(s: StoredState) {
  // Sync to widget storage (primary source of truth)
  Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(s));
  // Keep AsyncStorage for redundancy/web if needed
  await AsyncStorage.setItem("@prayer_state", JSON.stringify(s));

  // Notify widget to update
  if (Platform.OS === "android") {
    try {
      await requestWidgetUpdate({ widgetName: "Prayer" });
    } catch (e) {
      console.warn("Failed to update prayer widget:", e);
    }
  }
}

export async function loadState(): Promise<StoredState | null> {
  // Try shared kv-store first
  const shared = Storage.getItemSync(PRAYER_STORAGE_KEY);
  if (shared) return JSON.parse(shared) as StoredState;

  // Fallback to AsyncStorage
  const raw = await AsyncStorage.getItem("@prayer_state");
  return raw ? (JSON.parse(raw) as StoredState) : null;
}

export const NOTIF_CHANNEL_ID = "prayer-reminders";
export const TASK_NAME = "PRAYER_TIMES_REFRESH";
