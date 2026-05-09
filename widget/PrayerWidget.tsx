/* eslint-disable react-native/no-inline-styles */
import React from "react";
import {
  FlexWidget,
  TextWidget,
  ImageWidget,
} from "react-native-android-widget";

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

export function PrayerWidget({ state }: { state: StoredState }) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let nextPrayerName: PrayerName = PRAYER_KEYS[0];

  if (state?.timings) {
    for (const name of PRAYER_KEYS) {
      const timeStr = state.timings[name];
      if (!timeStr) continue;
      const [h, m] = timeStr.split(":").map(Number);
      const prayerMinutes = h * 60 + m;
      if (prayerMinutes > currentMinutes) {
        nextPrayerName = name;
        break;
      }
    }
  }

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#18181b", // Sleek dark zinc background
        borderRadius: 24,
        padding: 16,
        flexDirection: "column",
      }}
      clickAction="OPEN_PRAYER"
      accessibilityLabel="Prayer Reminder Widget"
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: "wrap_content",
          marginBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget
            text="Prayer Schedule"
            style={{
              fontSize: 12,
              color: "#ffffff",
              fontWeight: "700",
              marginLeft: 8,
            }}
          />
        </FlexWidget>
        {state?.tz ? (
          <TextWidget
            text={state.tz.split("/")[1]?.replace("_", " ") || ""}
            style={{
              fontSize: 10,
              color: "#a1a1aa",
              fontWeight: "500",
            }}
          />
        ) : null}
      </FlexWidget>

      {/* Prayers List */}
      <FlexWidget
        style={{
          width: "match_parent",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          flexGap: 2,
        }}
      >
        {PRAYER_KEYS.map((k) => {
          const isNext = k === nextPrayerName;

          return (
            <FlexWidget
              key={k}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                width: "match_parent",
                backgroundColor: isNext ? "#3b82f6" : "#00000000",
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 12,
              }}
            >
              <TextWidget
                text={k}
                style={{
                  fontSize: 14,
                  fontWeight: isNext ? "700" : "500",
                  color: isNext ? "#ffffff" : "#a1a1aa",
                }}
              />
              <TextWidget
                text={state?.timings?.[k] ?? "--:--"}
                style={{
                  fontSize: 14,
                  fontWeight: isNext ? "700" : "600",
                  color: isNext ? "#ffffff" : "#e4e4e7",
                }}
              />
            </FlexWidget>
          );
        })}
      </FlexWidget>

      {/* Footer */}
      <FlexWidget
        style={{
          width: "match_parent",
          alignItems: "center",
          justifyContent: "center",
          height: "wrap_content",
          marginTop: 6,
        }}
      >
        <TextWidget
          text={`Roe - ${new Date().getFullYear()}`}
          style={{
            fontSize: 9,
            color: "#52525b",
            fontWeight: "600",
            letterSpacing: 2,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
