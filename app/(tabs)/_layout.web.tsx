import React from "react";
import { Icon } from "@/components/ui/icon";
import { useColor } from "@/hooks/useColor";
import { Tabs } from "expo-router";
import { Home, MessageCircle, Settings } from "lucide-react-native";

export default function WebTabsLayout() {
  const primary = useColor("primary");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Icon name={Home} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Icon name={MessageCircle} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Icon name={Settings} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
