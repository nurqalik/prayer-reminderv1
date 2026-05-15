import { Tabs } from "expo-router";
import { useColor } from "@/hooks/useColor";
import Feather from "@expo/vector-icons/Feather";

export default function TabsLayout() {
  const accent = useColor("blue");
  const muted = useColor("textMuted");
  const background = useColor("background");
  const border = useColor("border");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: background,
          borderTopColor: border,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
        tabBarItemStyle: {
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
