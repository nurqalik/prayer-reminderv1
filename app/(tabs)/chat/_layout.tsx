import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { Platform, TouchableOpacity } from "react-native";
import { Text } from "@/components/ui/text";
import { Bot, Trash2 } from "lucide-react-native";
import { trpc } from "@/utils/trpc";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, useAlertDialog } from "@/components/ui/alert-dialog";
import { View } from "@/components/ui/view";

export default function ChatLayout() {
  const theme = useColorScheme();
  const text = useColor("text");
  const background = useColor("background");
  const accent = useColor("blue");
  
  const { userId } = useAuth();
  const utils = trpc.useUtils();
  const deleteDialog = useAlertDialog();

  const deleteAllMessagesMutation = trpc.chat.deleteAllMessages.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate();
    },
  });

  const confirmDeleteAll = () => {
    if (!userId) return;
    deleteDialog.open();
  };

  return (
    <View style={{ flex: 1 }}>
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
                <Text variant="heading">
                  Roe <Bot size={24} color={text} />
                </Text>
              ) : undefined,
            headerRight: () => (
              <TouchableOpacity 
                onPress={confirmDeleteAll}
                disabled={deleteAllMessagesMutation.isPending}
                style={{ padding: 8 }}
              >
                <Trash2 size={20} color={text} style={{ opacity: 0.6 }} />
              </TouchableOpacity>
            ),
          }}
        />
      </Stack>

      <AlertDialog
        isVisible={deleteDialog.isVisible}
        onClose={deleteDialog.close}
        title="Clear History"
        description="Are you sure you want to delete all messages? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => deleteAllMessagesMutation.mutate({ userId: userId || "" })}
      />
    </View>
  );
}
