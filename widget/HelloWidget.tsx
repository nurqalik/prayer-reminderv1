"use no memo";
import React from "react";
import {
  FlexWidget,
  ImageWidget,
  TextWidget,
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

export function HelloWidget({ state }: { state: StoredState | null }) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 24,
        padding: 12,
        flexDirection: "column",
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="Prayer Reminder Widget"
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          height: "wrap_content",
        }}
      >
        <ImageWidget
          image={require("../assets/images/icon.png")}
          imageWidth={14}
          imageHeight={14}
          radius={3}
        />
        <TextWidget
          text="Prayer Reminder"
          style={{
            fontSize: 10,
            color: "#000000",
            fontWeight: "500",
            marginLeft: 4,
          }}
        />
      </FlexWidget>
      <FlexWidget
        style={{
          width: "match_parent",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGap: 12,
        }}
      >
        {PRAYER_KEYS.map((k) => (
          <TextWidget
            key={k}
            text={`${k}: ${state?.timings[k] ?? "--:--"}`} // Pass string here
            style={{
              fontSize: 18,
              fontWeight: "600",
              marginVertical: 2,
              fontFamily: "Poppins",
            }}
          />
        ))}
      </FlexWidget>
      <FlexWidget
        style={{
          width: "match_parent",
          alignItems: "center",
          justifyContent: "center",
          height: "wrap_content",
        }}
      >
        <TextWidget
          text={`Roe - ${new Date().getFullYear()}`}
          style={{
            fontSize: 9,
            color: "#000000",
            fontWeight: "600",
            letterSpacing: 2,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
