import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { ScrollView } from "@/components/ui/scroll-view";
import { useColor } from "@/hooks/useColor";
import {
  RefreshCw,
  Trash2,
  Sunrise,
  Sun,
  SunMedium,
  Sunset,
  Moon,
  Clock,
  MapPin,
  Calendar,
  ChevronRight,
} from "lucide-react-native";
import { DateTime } from "luxon";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as BackgroundFetch from "expo-background-fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import { useEffect, useState, useMemo } from "react";
import { Alert, Dimensions } from "react-native";
import { Spinner } from "@/components/ui/spinner";
import { Storage } from "expo-sqlite/kv-store";

export const PRAYER_STORAGE_KEY = "prayer-times";

// --------------------- Constants & Types ---------------------
const TASK_NAME = "PRAYER_TIMES_REFRESH";
const NOTIF_CHANNEL_ID = "prayer-reminders";
const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

type PrayerName = (typeof PRAYER_KEYS)[number];
type StoredTimings = Record<PrayerName, string>;

interface StoredState {
  dateISO: string; // "YYYY-MM-DD" (device-local)
  lat: number;
  lng: number;
  method: number; // Aladhan method id
  school: 0 | 1; // 0: Shafi, 1: Hanafi
  timings: StoredTimings; // e.g. { Maghrib: "17:32" }
  tz: string; // e.g. "Asia/Jakarta"
}

// --------------------- De-dupe & guard (session) ---------------------
let __isScheduling = false;
const __scheduledKeys = new Set<string>();
const keyFor = (tz: string, name: PrayerName, hhmm: string) =>
  `${tz}|${name}|${hhmm}`;

// Foreground display behavior for local notifications
Notifications.setNotificationHandler({
  handleNotification:
    async (): Promise<Notifications.NotificationBehavior> => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

// --------------------- Utilities ---------------------
// Device-local calendar date (no UTC shift)
const localDateISO = () => DateTime.now().toFormat("yyyy-LL-dd");

// Aladhan date string, in the current device zone (good enough; API returns TZ)
const dateForApi = () => DateTime.now().toFormat("dd-LL-yyyy");

function cleanHHmm(raw: string): string {
  const m = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) throw new Error(`Invalid time format: ${raw}`);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function parseHHmm(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59)
    throw new Error(`Bad HH:mm: ${hhmm}`);
  return { hour: h, minute: m };
}

async function ensureNotifChannel() {
  await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL_ID, {
    name: "Prayer Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    bypassDnd: true,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function requestPermissions() {
  const { status: locStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (locStatus !== "granted") throw new Error("Location permission denied");

  const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  if (notifStatus !== "granted")
    throw new Error("Notification permission denied");
}

// --------------------- API ---------------------
async function fetchPrayerTimes(
  lat: number,
  lng: number,
  method = 20,
  school: 0 | 1 = 0,
) {
  const date = dateForApi();
  const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`;
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

  console.log(
    `[FETCH] ${date} tz=${tz} readable=${json?.data?.date?.readable}`,
  );

  return { timings: wanted, tz };
}

// --------------------- Scheduling helpers (per-prayer) ---------------------
async function scheduleDailyPrayer(name: PrayerName, hhmm: string, tz: string) {
  const { hour, minute } = parseHHmm(hhmm);
  const devTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (devTZ !== tz) {
    console.log(
      `[WARN] Device TZ (${devTZ}) != API TZ (${tz}). Daily triggers use DEVICE TZ.`,
    );
  }

  // Avoid duplicate schedules in one app session (we also cancel all before rescheduling)
  const k = keyFor(tz, name, hhmm);
  if (__scheduledKeys.has(k)) {
    console.log(`[SKIP] ${name} already scheduled this session @ ${hhmm}`);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: name,
      body: `It's time to pray. • ${hhmm}`,
      sound: true,
      categoryIdentifier: CATEGORY_SNOOZE,
    },
    // Calendar DAILY trigger: runs every day at hour:minute (device local time)
    trigger: {
      channelId: NOTIF_CHANNEL_ID,
      hour,
      minute,
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
    },
  });

  console.log(
    `[SCHEDULED] ${name} DAILY @ ${String(hour).padStart(2, "0")}:${String(
      minute,
    ).padStart(2, "0")}`,
  );
  __scheduledKeys.add(k);

  // If we're exactly at the same minute right now, also fire a one-shot so today isn't missed
  const now = DateTime.now();
  if (now.hour === hour && now.minute === minute) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: name,
        body: `It's time to pray. • ${hhmm}`,
        sound: true,
      },
      trigger: {
        seconds: 1,
        channelId: NOTIF_CHANNEL_ID,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
    console.log(
      `[FIRED-NOW] ${name} (one-shot) because current time matches ${hhmm}`,
    );
  }
}

const CATEGORY_SNOOZE = "SNOOZE_CATEGORY";

async function registerSnoozeCategory() {
  // Register action buttons for iOS & Android
  await Notifications.setNotificationCategoryAsync(CATEGORY_SNOOZE, [
    {
      identifier: "SNOOZE_10",
      buttonTitle: "Remind me later",
      options: { opensAppToForeground: false },
    },
    {
      identifier: "Dismiss",
      buttonTitle: "Dismiss",
    },
  ]);
}

registerSnoozeCategory();

// Five explicit functions you can call independently if needed
async function scheduleFajr(state: StoredState) {
  await scheduleDailyPrayer("Fajr", state.timings.Fajr, state.tz);
}
async function scheduleDhuhr(state: StoredState) {
  await scheduleDailyPrayer("Dhuhr", state.timings.Dhuhr, state.tz);
}
async function scheduleAsr(state: StoredState) {
  await scheduleDailyPrayer("Asr", state.timings.Asr, state.tz);
}
async function scheduleMaghrib(state: StoredState) {
  await scheduleDailyPrayer("Maghrib", state.timings.Maghrib, state.tz);
}
async function scheduleIsha(state: StoredState) {
  await scheduleDailyPrayer("Isha", state.timings.Isha, state.tz);
}

// Master that calls the five
async function scheduleAllPrayers(state: StoredState) {
  if (__isScheduling) {
    console.log("[SCHEDULE] skipped: another run in progress");
    return;
  }
  __isScheduling = true;
  try {
    await ensureNotifChannel();

    // schedule each prayer individually
    await scheduleFajr(state);
    await scheduleDhuhr(state);
    await scheduleAsr(state);
    await scheduleMaghrib(state);
    await scheduleIsha(state);
  } finally {
    __isScheduling = false;
  }
}

// --------------------- Persistence ---------------------
async function saveState(s: StoredState) {
  await AsyncStorage.setItem("@prayer_state", JSON.stringify(s));
}
async function loadState(): Promise<StoredState | null> {
  const raw = await AsyncStorage.getItem("@prayer_state");
  return raw ? (JSON.parse(raw) as StoredState) : null;
}

// Map ISO Country Code to Aladhan Method ID
const COUNTRY_METHOD_MAP: Record<string, number> = {
  SA: 4, // Makkah
  ID: 20, // Indonesia
  MY: 17, // Malaysia (JAKIM)
  SG: 11, // Singapore
  AE: 8, // Gulf Region (UAE)
  EG: 5, // Egypt
  PK: 1, // Karachi
  US: 2, // ISNA
  GB: 3, // MWL
  FR: 12, // France
  TR: 13, // Turkey
  RU: 14, // Russia
  TN: 18, // Tunisia
  DZ: 19, // Algeria
  MA: 21, // Morocco
  JO: 23, // Jordan
  KW: 9, // Kuwait
  QA: 10, // Qatar
  IR: 7, // Tehran
};

// --------------------- Refresh pipeline ---------------------
async function refreshAndReschedule(
  method_override?: number,
  school: 0 | 1 = 0,
) {
  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude: lat, longitude: lng } = loc.coords;

  let method = method_override;
  if (!method) {
    const address = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    const country = address[0]?.isoCountryCode;
    method = country ? COUNTRY_METHOD_MAP[country] || 20 : 20;
    console.log(`[GEO] Detected country: ${country}, using method: ${method}`);
  }

  const { timings, tz } = await fetchPrayerTimes(lat, lng, method, school);

  const state: StoredState = {
    dateISO: localDateISO(),
    lat,
    lng,
    method,
    school,
    timings,
    tz,
  };

  await saveState(state);

  // Recreate daily schedules fresh (prevents duplicates)
  await Notifications.cancelAllScheduledNotificationsAsync();
  __scheduledKeys.clear();
  await new Promise((r) => setTimeout(r, 50)); // small settle
  await scheduleAllPrayers(state);

  return state;
}

// --------------------- Background Task ---------------------
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const stored = await loadState();
    const today = localDateISO();

    if (!stored || stored.dateISO !== today) {
      await refreshAndReschedule(undefined, stored?.school ?? 0);
    } else {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (scheduled.length === 0) {
        await scheduleAllPrayers(stored);
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.log("[BG] failed:", String(e));
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function ensureBackgroundTaskRegistered() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 3 * 60 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.log("[BG] register error:", String(e));
  }
}

const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK";

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.log("[BG NOTIF] Error:", error);
    return;
  }
  const response = data as Notifications.NotificationResponse;
  const action = response.actionIdentifier;
  if (action === "SNOOZE_10") {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Prayer Reminder",
        body: `Reminding you again in 10 minutes.`,
        sound: true,
        categoryIdentifier: CATEGORY_SNOOZE,
      },
      trigger: {
        seconds: 600,
        channelId: NOTIF_CHANNEL_ID,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
    console.log("[BG NOTIF] Snoozed for 10 minutes");
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((e) =>
  console.log("[BG NOTIF] register error:", String(e)),
);

// --------------------- UI Helper Components ---------------------

const PRAYER_ICONS: Record<PrayerName, any> = {
  Fajr: Sunrise,
  Dhuhr: Sun,
  Asr: SunMedium,
  Maghrib: Sunset,
  Isha: Moon,
};

function getGreeting() {
  const hour = DateTime.now().hour;
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getNextPrayer(timings: StoredTimings): {
  name: PrayerName;
  time: DateTime;
} {
  const now = DateTime.now();
  const prayerTimes = PRAYER_KEYS.map((name) => {
    const { hour, minute } = parseHHmm(timings[name]);
    let time = now.set({ hour, minute, second: 0, millisecond: 0 });
    if (time < now) {
      time = time.plus({ days: 1 });
    }
    return { name, time };
  });

  prayerTimes.sort((a, b) => a.time.toMillis() - b.time.toMillis());
  return prayerTimes[0];
}

function getCountdown(target: DateTime): string {
  const diff = target.diffNow(["hours", "minutes"]).toObject();
  const h = Math.floor(diff.hours || 0);
  const m = Math.floor(diff.minutes || 0);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const PrayerItem = ({
  name,
  time,
  isNext,
}: {
  name: PrayerName;
  time: string;
  isNext: boolean;
}) => {
  const IconComponent = PRAYER_ICONS[name];
  const primary = useColor("text");
  const muted = useColor("textMuted");
  const accent = useColor("blue");
  const cardBg = useColor("card");
  const border = useColor("border");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: name === "Isha" ? 0 : 0.5,
        borderBottomColor: border,
        opacity: isNext ? 1 : 0.6,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isNext ? accent + "15" : cardBg,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        <IconComponent size={18} color={isNext ? accent : primary} />
      </View>
      <Text
        style={{
          flex: 1,
          fontWeight: isNext ? "700" : "500",
          fontSize: 17,
          color: primary,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          fontWeight: isNext ? "700" : "400",
          fontSize: 17,
          color: isNext ? accent : primary,
        }}
      >
        {time}
      </Text>
    </View>
  );
};

export default function HomeScreen() {
  const primary = useColor("text");
  const muted = useColor("textMuted");
  const accent = useColor("blue");
  const background = useColor("background");

  const [state, setState] = useState<StoredState | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(DateTime.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(DateTime.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await requestPermissions();
        await ensureBackgroundTaskRegistered();

        const stored = await loadState();
        const today = localDateISO();

        if (stored && stored.dateISO === today) {
          Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(stored));
          setState(stored);
          const scheduled =
            await Notifications.getAllScheduledNotificationsAsync();
          if (scheduled.length === 0) {
            await scheduleAllPrayers(stored);
          }
        } else {
          const s = await refreshAndReschedule(undefined, stored?.school ?? 0);
          Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(s));
          setState(s);
        }
      } catch (e: any) {
        setErr(e?.message ?? "Initialization failed");
      }
    })();
  }, []);

  const manualRefresh = async () => {
    try {
      setLoading(true);
      const s = await refreshAndReschedule(undefined, state?.school ?? 0);
      Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(s));
      setState(s);
      setLoading(false);
      Alert.alert("Refreshed", "Prayer times updated.");
    } catch (e: any) {
      setLoading(false);
      Alert.alert("Error", e?.message ?? "Failed to refresh.");
    }
  };

  const clearSchedules = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    __scheduledKeys.clear();
    Alert.alert("Cleared", "All notifications cancelled.");
  };

  const nextPrayer = useMemo(() => {
    if (!state) return null;
    return getNextPrayer(state.timings);
  }, [state, now]);

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: 100,
          paddingBottom: 40,
        }}
      >
        {/* Header Section */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <View>
            <Text variant="title" style={{ fontSize: 28, fontWeight: "800" }}>
              {getGreeting()}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
                opacity: 0.6,
              }}
            >
              <Calendar size={14} color={muted} style={{ marginRight: 4 }} />
              <Text variant="caption" style={{ fontSize: 14 }}>
                {now.toFormat("EEEE, d MMMM")}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Icon
              name={RefreshCw}
              size={20}
              color={muted}
              onPress={manualRefresh}
              disabled={loading}
            />
            <Icon
              name={Trash2}
              size={20}
              color={muted}
              onPress={clearSchedules}
            />
          </View>
        </View>

        {err && (
          <Card style={{ backgroundColor: "#fee2e2", marginBottom: 20 }}>
            <Text style={{ color: "#ef4444" }}>{err}</Text>
          </Card>
        )}

        {loading ? (
          <Card style={{ padding: 40, alignItems: "center" }}>
            <Spinner showLabel label="Updating times..." />
          </Card>
        ) : state && nextPrayer ? (
          <View style={{ gap: 24 }}>
            {/* Next Prayer Card */}
            <Card style={{ backgroundColor: accent, borderBottomWidth: 0 }}>
              <CardContent style={{ padding: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontWeight: "600",
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      NEXT PRAYER
                    </Text>
                    <Text
                      style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}
                    >
                      {nextPrayer.name}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.2)",
                      padding: 8,
                      borderRadius: 12,
                    }}
                  >
                    <Clock size={24} color="#fff" />
                  </View>
                </View>

                <View
                  style={{
                    marginTop: 24,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text
                      style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}
                    >
                      Scheduled at
                    </Text>
                    <Text
                      style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}
                    >
                      {state.timings[nextPrayer.name]}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}
                    >
                      Coming up in
                    </Text>
                    <Text
                      style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}
                    >
                      {getCountdown(nextPrayer.time)}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* Prayer List */}
            <View>
              <Text
                variant="subtitle"
                style={{ marginBottom: 16, fontWeight: "700" }}
              >
                Today's Schedule
              </Text>
              <Card>
                <CardContent
                  style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  {PRAYER_KEYS.map((k) => (
                    <PrayerItem
                      key={k}
                      name={k}
                      time={state.timings[k]}
                      isNext={nextPrayer.name === k}
                    />
                  ))}
                </CardContent>
              </Card>
            </View>

            {/* Location Info */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                opacity: 0.5,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MapPin size={12} color={muted} style={{ marginRight: 4 }} />
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {state.tz.split("/")[1].replace("_", " ")}
                </Text>
              </View>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: muted,
                }}
              />
              <Text variant="caption" style={{ fontSize: 12 }}>
                Method {state.method}
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 100,
            }}
          >
            <Spinner />
            <Text style={{ marginTop: 16, color: muted }}>
              Initializing prayer times...
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
