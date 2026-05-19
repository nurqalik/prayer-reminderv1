/* eslint-disable react-native/no-inline-styles */
import React from "react";
import { FlexWidget, TextWidget, SvgWidget } from "react-native-android-widget";
import { StoredState, PRAYER_KEYS, PrayerName } from "@/utils/prayer-storage";
import { DateTime } from "luxon";

const ICONS = {
  sunrise: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41-1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41-1.41"/><path d="M22 22H2"/><path d="m8 22 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  sunset: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41-1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41-1.41"/><path d="M22 22H2"/><path d="m16 22-4-4-4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e4e4e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7a5 5 0 0 1-4.9 6.2 5.3 5.3 0 0 1-5.1-5 5.1 5.1 0 0 1 1-3 4.6 4.6 0 0 1 5.2-1.7 4.7 4.7 0 0 1 3.8 3.5Z"/><path d="M22 5h-4"/><path d="M20 3v4"/><path d="M21 14h-2"/><path d="M20 13v2"/><path d="M17 19h-1"/><path d="M16.5 18.5v1"/></svg>`,
};

export function NextPrayerWidget({ state }: { state: StoredState }) {
  const now = DateTime.now();
  const currentMinutes = now.hour * 60 + now.minute;

  let nextPrayerName: PrayerName = PRAYER_KEYS[0];
  let nextPrayerTime = state?.timings?.[PRAYER_KEYS[0]] || "--:--";
  let isTomorrow = false;

  if (state?.timings) {
    let found = false;
    for (const name of PRAYER_KEYS) {
      const timeStr = state.timings[name];
      if (!timeStr) continue;
      const [h, m] = timeStr.split(":").map(Number);
      const prayerMinutes = h * 60 + m;
      if (prayerMinutes >= currentMinutes) {
        nextPrayerName = name;
        nextPrayerTime = timeStr;
        found = true;
        break;
      }
    }
    if (!found) {
      nextPrayerName = "Fajr";
      nextPrayerTime = state.timings?.["Fajr"] || "--:--";
      isTomorrow = true;
    }
  }

  // Get icon based on prayer
  let svg = ICONS.sun;
  if (nextPrayerName === "Fajr") svg = ICONS.sunrise;
  else if (nextPrayerName === "Dhuhr" || nextPrayerName === "Asr")
    svg = ICONS.sun;
  else if (nextPrayerName === "Maghrib") svg = ICONS.sunset;
  else if (nextPrayerName === "Isha") svg = ICONS.moon;

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#18181b",
        borderRadius: 24,
        padding: 12,
      }}
      clickAction="OPEN_APP"
    >
      <TextWidget
        text="NEXT PRAYER"
        style={{
          fontSize: 10,
          color: "#71717a",
          fontWeight: "600",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      />

      <SvgWidget
        svg={svg}
        style={{
          width: 32,
          height: 32,
          marginBottom: 6,
        }}
      />

      <TextWidget
        text={nextPrayerName}
        style={{
          fontSize: 14,
          color: "#a1a1aa",
          fontWeight: "700",
        }}
      />

      <TextWidget
        text={nextPrayerTime}
        style={{
          fontSize: 22,
          color: "#ffffff",
          fontWeight: "800",
          marginVertical: 2,
        }}
      />

      <TextWidget
        text={now.toFormat("ccc, d LLL")}
        style={{
          fontSize: 10,
          color: "#71717a",
          fontWeight: "500",
        }}
      />

      {isTomorrow && (
        <TextWidget
          text="Tomorrow"
          style={{
            fontSize: 9,
            color: "#3b82f6",
            fontWeight: "600",
            marginTop: 2,
          }}
        />
      )}
    </FlexWidget>
  );
}
