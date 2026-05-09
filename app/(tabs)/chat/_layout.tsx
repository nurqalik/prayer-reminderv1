import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { Text } from "@/components/ui/text";

export default function ChatLayout() {
  const theme = useColorScheme();
  const text = useColor("text");
  const background = useColor("background");

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerTintColor: text,
        headerBlurEffect: isLiquidGlassAvailable()
          ? undefined
          : theme === "dark"
            ? "systemMaterialDark"
            : "systemMaterialLight",
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable()
            ? "transparent"
            : background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Roe Bot",
          headerTitle: () =>
            Platform.OS === "android" ? (
              <Text variant="heading">Roe Bot</Text>
            ) : undefined,
        }}
      />
    </Stack>
  );
}
