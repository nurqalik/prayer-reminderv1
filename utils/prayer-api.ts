import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { DateTime } from "luxon";
import { 
  StoredState, 
  StoredTimings, 
  PrayerName, 
  PRAYER_KEYS, 
  NOTIF_CHANNEL_ID, 
  saveState,
  loadState
} from "./prayer-storage";

// Device-local calendar date (no UTC shift)
export const localDateISO = () => DateTime.now().toFormat("yyyy-LL-dd");

// Aladhan date string, in the current device zone
export const dateForApi = () => DateTime.now().toFormat("dd-LL-yyyy");

export function cleanHHmm(raw: string): string {
  const m = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) throw new Error(`Invalid time format: ${raw}`);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function parseHHmm(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59)
    throw new Error(`Bad HH:mm: ${hhmm}`);
  return { hour: h, minute: m };
}

export async function fetchPrayerTimes(
  lat: number,
  lng: number,
  method = 20,
  school: 0 | 1 = 0,
) {
  const date = dateForApi();
  const url = `${process.env.EXPO_PUBLIC_PRAYER_API_URL}/timings/${date}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json || json.code !== 200)
    throw new Error("Failed to fetch prayer times");

  const all = json.data.timings as Record<string, string>;
  const wanted: StoredTimings = {
    Fajr: cleanHHmm(all.Fajr),
    Dhuhr: cleanHHmm(all.Dhuhr),
    Asr: cleanHHmm(all.Asr),
    Maghrib: cleanHHmm(all.Maghrib),
    Isha: cleanHHmm(all.Isha),
  };
  const tz = json.data.meta.timezone as string;

  return { timings: wanted, tz };
}

const __scheduledKeys = new Set<string>();
const keyFor = (tz: string, name: PrayerName, hhmm: string) =>
  `${tz}|${name}|${hhmm}`;

export async function scheduleDailyPrayer(name: PrayerName, hhmm: string, tz: string) {
  const { hour, minute } = parseHHmm(hhmm);

  const k = keyFor(tz, name, hhmm);
  if (__scheduledKeys.has(k)) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time for ${name}`,
      body: `It is now ${hhmm}. Open the app to mark your prayer as completed.`,
      sound: true,
      data: { prayerName: name },
    },
    trigger: {
      channelId: NOTIF_CHANNEL_ID,
      hour,
      minute,
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
    },
  });

  __scheduledKeys.add(k);

  // One-shot if it's the exact same minute
  const now = DateTime.now();
  if (now.hour === hour && now.minute === minute) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${name}`,
        body: `It is now ${hhmm}. Open the app to mark your prayer as completed.`,
        sound: true,
        data: { prayerName: name },
      },
      trigger: {
        seconds: 1,
        channelId: NOTIF_CHANNEL_ID,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  }
}

export async function scheduleAllPrayers(state: StoredState) {
  for (const name of PRAYER_KEYS) {
    await scheduleDailyPrayer(name, state.timings[name], state.tz);
  }
}

const COUNTRY_METHOD_MAP: Record<string, number> = {
  SA: 4, ID: 20, MY: 17, SG: 11, AE: 8, EG: 5, PK: 1, US: 2, GB: 3, FR: 12, TR: 13, RU: 14, TN: 18, DZ: 19, MA: 21, JO: 23, KW: 9, QA: 10, IR: 7,
};

export async function refreshAndReschedule(
  method_override?: number,
  school: 0 | 1 = 0,
  onMethodNotListed?: () => void,
  existingCoords?: { lat: number; lng: number },
) {
  let lat: number;
  let lng: number;

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    lat = loc.coords.latitude;
    lng = loc.coords.longitude;
  } catch (e) {
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      lat = last.coords.latitude;
      lng = last.coords.longitude;
    } else if (existingCoords) {
      lat = existingCoords.lat;
      lng = existingCoords.lng;
    } else {
      throw e;
    }
  }

  let method = method_override;
  if (method === undefined) {
    const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const country = address[0]?.isoCountryCode;
    method = country ? COUNTRY_METHOD_MAP[country] : 20;
    if (method === 20 && !country && onMethodNotListed) onMethodNotListed();
  }

  const { timings, tz } = await fetchPrayerTimes(lat, lng, method, school);
  
  // Try to preserve existing completions if it's the same day
  const existing = await loadState();
  const today = localDateISO();
  const completed = (existing && existing.dateISO === today) ? (existing.completed || {}) : {};

  const state: StoredState = {
    dateISO: today,
    lat, lng, method, school, timings, tz,
    completed,
  };

  await saveState(state);
  await Notifications.cancelAllScheduledNotificationsAsync();
  __scheduledKeys.clear();
  await scheduleAllPrayers(state);

  return state;
}
