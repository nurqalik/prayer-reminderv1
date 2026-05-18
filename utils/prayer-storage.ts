import AsyncStorage from "@react-native-async-storage/async-storage";
import { Storage } from "expo-sqlite/kv-store";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import * as React from "react";
import { PrayerWidget } from "../widget/PrayerWidget";

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
  const json = JSON.stringify(s);
  
  // 1. Sync to widget storage (primary source of truth)
  try {
    Storage.setItemSync(PRAYER_STORAGE_KEY, json);
  } catch (e) {
    console.error("Failed to save to kv-store:", e);
  }

  // 2. Keep AsyncStorage for redundancy/web if needed
  try {
    await AsyncStorage.setItem("@prayer_state", json);
  } catch (e) {
    console.error("Failed to save to AsyncStorage:", e);
  }

  // 3. Notify widget to update
  if (Platform.OS === "android") {
    try {
      // Small delay ensures the SQLite write is fully flushed and visible to the widget process
      setTimeout(async () => {
        try {
          await requestWidgetUpdate({ 
            widgetName: "Prayer",
            renderWidget: () => React.createElement(PrayerWidget, { 
              state: JSON.parse(Storage.getItemSync(PRAYER_STORAGE_KEY) || "{}") 
            })
          });
        } catch (e) {
          console.warn("Failed to update prayer widget:", e);
        }
      }, 100);
    } catch (e) {
      console.warn("Failed to trigger widget update timeout:", e);
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
