import React from "react";
import { Linking } from "react-native";
import Storage from "expo-sqlite/kv-store";
import type {
  ColorProp,
  WidgetTaskHandlerProps,
} from "react-native-android-widget";
import { HelloWidget } from "./HelloWidget";
import { CounterWidget } from "./CounterWidget";
import { PrayerWidget } from "./PrayerWidget";

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
  Hello: HelloWidget,
  Counter: CounterWidget,
  Prayer: PrayerWidget,
};

export const COUNTER_STORAGE_KEY = "CounterWidget:count";
export const COUNTER_BACKGROUND_KEY = "CounterWidget:backgroundColor";
export const PRAYER_STORAGE_KEY = "prayer-times";

export function getStoredBackgroundColor(): ColorProp {
  return (Storage.getItemSync(COUNTER_BACKGROUND_KEY) ||
    "#1F2937") as ColorProp;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[
    widgetInfo.widgetName as keyof typeof nameToWidget
  ] as any;

  const renderCurrentWidget = () => {
    if (widgetInfo.widgetName === "Counter") {
      const stored = Storage.getItemSync(COUNTER_STORAGE_KEY);
      const count = stored ? Number(stored) : 0;
      const backgroundColor = getStoredBackgroundColor();
      props.renderWidget(
        <CounterWidget count={count} backgroundColor={backgroundColor} />,
      );
    } else if (widgetInfo.widgetName === "Prayer") {
      const stored = Storage.getItemSync(PRAYER_STORAGE_KEY);
      const state: StoredState = stored ? JSON.parse(stored) : ({} as any);
      props.renderWidget(<PrayerWidget state={state} />);
    } else {
      props.renderWidget(<Widget {...widgetInfo} />);
    }
  };

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      renderCurrentWidget();
      break;

    case "WIDGET_DELETED":
      // Not needed for now
      break;

    case "WIDGET_CLICK": {
      if (props.clickAction === "OPEN_APP") {
        Linking.openURL("androidwidgetapp://home");
        break;
      }

      if (props.clickAction === "OPEN_PRAYER") {
        Linking.openURL("prayer-reminderv1://home");
        break;
      }

      if (widgetInfo.widgetName === "Counter") {
        const currentValue = Number(props.clickActionData?.value) || 0;
        const backgroundColor = (props.clickActionData?.backgroundColor ||
          getStoredBackgroundColor()) as ColorProp;
        const count =
          currentValue + (props.clickAction === "INCREMENT" ? 1 : -1);
        
        Storage.setItemSync(COUNTER_STORAGE_KEY, `${count}`);
        
        props.renderWidget(
          <CounterWidget count={count} backgroundColor={backgroundColor} />,
        );
      }
      break;
    }
    default:
      break;
  }
}
