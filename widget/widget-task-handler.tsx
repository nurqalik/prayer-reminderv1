import React, { useState } from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { HelloWidget } from "./HelloWidget";
import { Linking } from "react-native";

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

const nameToWidget = {
  // Hello will be the **name** with which we will reference our widget.
  Prayer: HelloWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const [state, setState] = useState<StoredState | null>(null);

  const widgetInfo = props.widgetInfo;
  const Widget =
    nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
      props.renderWidget(<Widget state={state} />);
      break;

    case "WIDGET_UPDATE":
      props.renderWidget(<Widget state={state} />);
      break;

    case "WIDGET_RESIZED":
      props.renderWidget(<Widget state={state} />);
      break;

    case "WIDGET_DELETED":
      // Not needed for now
      break;

    case "WIDGET_CLICK":
      if (props.clickAction === "OPEN_APP") {
        Linking.openURL("prayer-reminderv1://index");
      }
      props.renderWidget(<Widget state={state} />);
      break;

    default:
      break;
  }
}
