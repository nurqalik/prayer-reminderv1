import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as BackgroundFetch from "expo-background-fetch";
import { requestWidgetUpdate } from "react-native-android-widget";
import { 
  TASK_NAME, 
  loadState, 
  NOTIF_CHANNEL_ID,
} from "./prayer-storage";
import { refreshAndReschedule, localDateISO, scheduleAllPrayers } from "./prayer-api";

// --------------------- Configuration ---------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

Notifications.setNotificationChannelAsync(NOTIF_CHANNEL_ID, {
  name: "Prayer Reminders",
  importance: Notifications.AndroidImportance.HIGH,
  bypassDnd: true,
  vibrationPattern: [0, 250, 250, 250],
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
});

// --------------------- Background Task ---------------------

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const stored = await loadState();
    const today = localDateISO();

    if (!stored || stored.dateISO !== today) {
      await refreshAndReschedule(
        undefined, 
        stored?.school ?? 0, 
        undefined, 
        stored ? { lat: stored.lat, lng: stored.lng } : undefined
      );
      
      // Force widget to refresh with new day's data
      try {
        await requestWidgetUpdate({ widgetName: "Prayer" });
      } catch (e) {
        // Ignore widget update errors in background
      }
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

export async function ensureBackgroundTaskRegistered() {
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

export const ensureNotifChannel = async () => {};
