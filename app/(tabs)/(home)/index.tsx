import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { ScrollView } from "@/components/ui/scroll-view";
import { useColor } from "@/hooks/useColor";
import {
  RefreshCw,
  Trash2,
  Bell,
  Sunrise,
  Sun,
  SunMedium,
  Sunset,
  Moon,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  Circle,
} from "lucide-react-native";
import { DateTime } from "luxon";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { TouchableOpacity, AppState } from "react-native";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalSearchParams, useRouter } from "expo-router";

// Utilities
import {
  StoredState,
  PrayerName,
  PRAYER_KEYS,
  loadState,
  saveState,
  NOTIF_CHANNEL_ID,
} from "@/utils/prayer-storage";
import {
  refreshAndReschedule,
  localDateISO,
  scheduleAllPrayers,
  parseHHmm,
} from "@/utils/prayer-api";
import {
  ensureBackgroundTaskRegistered,
  ensureNotifChannel,
} from "@/utils/notification-tasks";
import { useAuth } from "@/hooks/useAuth";

// --------------------- UI Helper Components ---------------------

const PRAYER_ICONS: Record<PrayerName, any> = {
  Fajr: Sunrise,
  Dhuhr: Sun,
  Asr: SunMedium,
  Maghrib: Sunset,
  Isha: Moon,
};

function getGreeting(name?: string | null) {
  const hour = DateTime.now().hour;
  let greeting = "";
  if (hour < 12) greeting = "Good Morning";
  else if (hour < 17) greeting = "Good Afternoon";
  else greeting = "Good Evening";

  return name ? `${greeting} ${name}` : greeting;
}

function getNextPrayer(timings: Record<PrayerName, string>): {
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
  const diff = target.diffNow(["hours", "minutes", "seconds"]).toObject();
  const h = Math.floor(diff.hours || 0);
  const m = Math.floor(diff.minutes || 0);
  const s = Math.floor(diff.seconds || 0);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const PrayerItem = ({
  name,
  time,
  isNext,
  isCompleted,
  onToggle,
}: {
  name: PrayerName;
  time: string;
  isNext: boolean;
  isCompleted: boolean;
  onToggle: () => void;
}) => {
  const IconComponent = PRAYER_ICONS[name];
  const primary = useColor("text");
  const muted = useColor("textMuted");
  const accent = useColor("blue");
  const cardBg = useColor("card");
  const border = useColor("border");

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: name === "Isha" ? 0 : 0.5,
        borderBottomColor: border,
        opacity: isNext ? 1 : isCompleted ? 0.4 : 0.6,
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
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontWeight: isNext ? "700" : "500",
            fontSize: 17,
            color: primary,
            textDecorationLine: isCompleted ? "line-through" : "none",
          }}
        >
          {name}
        </Text>
      </View>

      <Text
        style={{
          fontWeight: isNext ? "700" : "400",
          fontSize: 17,
          color: isNext ? accent : primary,
          marginRight: 12,
        }}
      >
        {time}
      </Text>

      <Icon
        name={isCompleted ? CheckCircle2 : Circle}
        size={20}
        color={isCompleted ? accent : muted}
      />
    </TouchableOpacity>
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
  const { userId, userName } = useAuth();

  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setNow(DateTime.now()), 1000);

    // Reload state when app returns to foreground to see changes from background actions
    const sub = AppState.addEventListener("change", async (next) => {
      if (next === "active") {
        const stored = await loadState();
        if (stored) setState(stored);
      }
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status: locStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (locStatus !== "granted")
          throw new Error("Location permission denied");

        const { status: notifStatus } =
          await Notifications.requestPermissionsAsync();
        if (notifStatus !== "granted")
          throw new Error("Notification permission denied");

        await ensureNotifChannel();
        await ensureBackgroundTaskRegistered();

        const stored = await loadState();
        const today = localDateISO();

        if (stored && stored.dateISO === today) {
          setState(stored);
          const scheduled =
            await Notifications.getAllScheduledNotificationsAsync();
          if (scheduled.length === 0) {
            await scheduleAllPrayers(stored);
          }
        } else {
          const s = await refreshAndReschedule(
            undefined,
            stored?.school ?? 0,
            undefined,
            stored ? { lat: stored.lat, lng: stored.lng } : undefined,
          );
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
      const s = await refreshAndReschedule(
        undefined,
        state?.school ?? 0,
        () => {
          toast({
            title: "Method Not Listed",
            description:
              "Your location doesn't have a specific method. Using default (Kemenag Indonesia).",
            variant: "warning",
          });
        },
        state ? { lat: state.lat, lng: state.lng } : undefined,
      );
      setState(s);
      setLoading(false);
      toast({
        title: "Refreshed",
        description: "Prayer times updated.",
        variant: "success",
      });
    } catch (e: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: e?.message ?? "Failed to refresh.",
        variant: "error",
      });
    }
  };

  const clearSchedules = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    toast({
      title: "Cleared",
      description: "All notifications cancelled.",
      variant: "info",
    });
  };

  const toggleCompletion = useCallback(async (prayer: PrayerName) => {
    const latest = await loadState();
    if (!latest) return;

    const isDone = !!latest.completed?.[prayer];
    const newState: StoredState = {
      ...latest,
      completed: {
        ...(latest.completed || {}),
        [prayer as string]: !isDone,
      },
    };
    setState(newState);
    await saveState(newState);
  }, []);

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
          <View style={{ flex: 1, paddingRight: 16 }}>
            {userName ? (
              <>
                <Text
                  style={{
                    fontSize: 16,
                    color: muted,
                    marginBottom: 2,
                    fontWeight: "500",
                  }}
                >
                  {getGreeting()},
                </Text>
                <Text
                  variant="title"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ fontSize: 28, fontWeight: "800", color: primary }}
                >
                  {userName}
                </Text>
              </>
            ) : (
              <Text
                variant="title"
                style={{ fontSize: 28, fontWeight: "800", color: primary }}
              >
                {getGreeting()}
              </Text>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
              }}
            >
              <Calendar size={14} color={muted} style={{ marginRight: 6 }} />
              <Text variant="caption" style={{ fontSize: 14, color: muted, fontWeight: "500" }}>
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
            <CardContent>
              <Text style={{ color: "#ef4444" }}>{err}</Text>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card style={{ padding: 40, alignItems: "center" }}>
            <CardContent>
              <Spinner showLabel label="Updating times..." />
            </CardContent>
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
                      style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}
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
                      style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}
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
                      isCompleted={!!state.completed?.[k]}
                      onToggle={() => toggleCompletion(k)}
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
