import React from "react";
import { Linking } from "react-native";
import { Storage } from "expo-sqlite/kv-store";
import type {
  ColorProp,
  WidgetTaskHandlerProps,
} from "react-native-android-widget";
import { HelloWidget } from "./HelloWidget";
import { CounterWidget } from "./CounterWidget";
import { PrayerWidget } from "./PrayerWidget";

// Utilities
import { StoredState, PRAYER_STORAGE_KEY } from "@/utils/prayer-storage";
import { refreshAndReschedule, localDateISO } from "@/utils/prayer-api";

const nameToWidget = {
  // Hello will be the **name** with which we will reference our widget.
  Hello: HelloWidget,
  Counter: CounterWidget,
  Prayer: PrayerWidget,
};

export const COUNTER_STORAGE_KEY = "CounterWidget:count";
export const COUNTER_BACKGROUND_KEY = "CounterWidget:backgroundColor";

export function getStoredBackgroundColor(): ColorProp {
  return (Storage.getItemSync(COUNTER_BACKGROUND_KEY) ||
    "#1F2937") as ColorProp;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[
    widgetInfo.widgetName as keyof typeof nameToWidget
  ] as any;

  const renderCurrentWidget = async (stateOverride?: any) => {
    if (widgetInfo.widgetName === "Counter") {
      const stored = Storage.getItemSync(COUNTER_STORAGE_KEY);
      const count = stored ? Number(stored) : 0;
      const backgroundColor = getStoredBackgroundColor();
      props.renderWidget(
        <CounterWidget count={count} backgroundColor={backgroundColor} />,
      );
    } else if (widgetInfo.widgetName === "Prayer") {
      let state: StoredState;
      try {
        const raw = Storage.getItemSync(PRAYER_STORAGE_KEY);
        state = stateOverride || (raw ? JSON.parse(raw) : {});
      } catch (e) {
        console.error("Failed to load state in widget:", e);
        state = stateOverride || {} as StoredState;
      }
      
      // Auto-refresh if it's a new day
      const today = localDateISO();
      if (state.dateISO && state.dateISO !== today) {
          // Reset completions for the new day
          state.completed = {};
          state.dateISO = today;

          try {
              state = await refreshAndReschedule(
                  state.method,
                  state.school,
                  undefined,
                  state ? { lat: state.lat, lng: state.lng } : undefined
              );
          } catch (e) {
              // Fallback to state with reset completions if refresh fails
              try {
                Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(state));
              } catch (err) {
                console.error("Failed to save reset state in widget:", err);
              }
          }
      }

      try {
        props.renderWidget(<PrayerWidget state={state} />);
      } catch (e) {
        console.error("Failed to render PrayerWidget:", e);
      }
    } else {
      props.renderWidget(<Widget {...widgetInfo} />);
    }
  };

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await renderCurrentWidget();
      break;

    case "WIDGET_DELETED":
      // Not needed for now
      break;

    case "WIDGET_CLICK": {
      if (props.clickAction === "OPEN_APP") {
        Linking.openURL("prayer-reminderv1://(home)/index");
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
