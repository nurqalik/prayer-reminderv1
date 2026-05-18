import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColor } from "@/hooks/useColor";
import { useModeToggle } from "@/hooks/useModeToggle";
import { HelloWidget } from "@/widget/HelloWidget";
import {
  Code,
  Eye,
  Palette,
  Settings,
  ChevronRight,
  RefreshCcw,
  Check,
  Key,
  Info,
  LogOut,
  User,
  ShieldCheck,
} from "lucide-react-native";
import { WidgetPreview } from "react-native-android-widget";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { CALCULATION_METHODS } from "@/constants/methods";
import { Modal, TouchableOpacity, Pressable, Linking } from "react-native";
import { Spinner } from "@/components/ui/spinner";
import { Storage } from "expo-sqlite/kv-store";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/utils/trpc";
import { useAuth } from "@/hooks/useAuth";

// Utilities
import { loadState, PRAYER_STORAGE_KEY } from "@/utils/prayer-storage";
import { refreshAndReschedule } from "@/utils/prayer-api";

const API_KEY_STORAGE = "gemini_api_key";

export default function SettingsScreen() {
  const { userId, logout, isGuest, isLoggingOut } = useAuth();
  const card = useColor("card");
  const border = useColor("border");
  const primary = useColor("text");
  const muted = useColor("textMuted");
  const accent = useColor("blue");
  const { toggleMode, isDark } = useModeToggle();

  const { toast } = useToast();

  const [currentMethod, setCurrentMethod] = useState<number>(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [tempKey, setTempKey] = useState("");
  const [isEditingKey, setIsEditingKey] = useState(false);

  // tRPC Mutation
  const updateApiKeyMutation = trpc.auth.updateApiKey.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    (async () => {
      const [state, storedKey] = await Promise.all([
        loadState(),
        SecureStore.getItemAsync(API_KEY_STORAGE),
      ]);
      if (state) {
        setCurrentMethod(state.method);
      }
      if (storedKey) {
        setApiKey(storedKey);
        setIsEditingKey(false);
      } else {
        setIsEditingKey(true);
      }
    })();
  }, [userId]); // Re-run when userId changes (e.g. after logout)

  const handleSelectMethod = async (methodId: number) => {
    try {
      setLoading(true);
      setModalVisible(false);
      await AsyncStorage.setItem("@method_override", methodId.toString());
      const newState = await refreshAndReschedule(methodId, 0, () => {
        toast({
          title: "Method Not Listed",
          description:
            "Your location doesn't have a specific method. Using default (Kemenag Indonesia).",
          variant: "warning",
        });
      });
      Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(newState));
      setCurrentMethod(newState.method);
      setLoading(false);
      toast({
        title: "Method Updated",
        description: "Prayer times have been recalculated.",
        variant: "success",
      });
    } catch (e: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: e?.message ?? "Failed to update method.",
        variant: "error",
      });
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      await AsyncStorage.removeItem("@method_override");
      const newState = await refreshAndReschedule(undefined, 0, () => {
        toast({
          title: "Method Not Listed",
          description:
            "Your location doesn't have a specific method. Using default (Kemenag Indonesia).",
          variant: "warning",
        });
      });
      Storage.setItemSync(PRAYER_STORAGE_KEY, JSON.stringify(newState));
      setCurrentMethod(newState.method);
      setLoading(false);
      toast({
        title: "Reset Complete",
        description: "Method reset to default based on location.",
        variant: "success",
      });
    } catch (e: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: e?.message ?? "Failed to reset method.",
        variant: "error",
      });
    }
  };

  const saveApiKey = async () => {
    if (!tempKey.trim() || !userId) return;
    try {
      setLoading(true);
      // Update on backend
      await updateApiKeyMutation.mutateAsync({
        geminiApiKey: tempKey.trim(),
      });

      // Force TRPC to refetch user data (including the new API key) across all tabs
      await utils.auth.me.invalidate();

      // Update locally
      await SecureStore.setItemAsync(API_KEY_STORAGE, tempKey.trim());
      setApiKey(tempKey.trim());
      setTempKey("");
      setIsEditingKey(false);
      setLoading(false);
      toast({
        title: "API Key Saved",
        description: "Your Model API key has been securely updated.",
        variant: "success",
      });
    } catch (e: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to securely save API key.",
        variant: "error",
      });
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    const wasGuest = isGuest;
    await logout();

    // Clear local UI state
    setApiKey("");
    setIsEditingKey(true);

    if (!wasGuest) {
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
        variant: "success",
      });
    }
  };

  const currentMethodItem = CALCULATION_METHODS.find(
    (m) => m.id === currentMethod,
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 18,
          paddingTop: 96,
          paddingHorizontal: 20,
          paddingBottom: 40,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <ModeToggle />
        </View>

        <Text
          variant="subtitle"
          style={{
            marginBottom: 8,
            fontWeight: "700",
            opacity: 0.6,
          }}
        >
          Method Available
        </Text>

        <Card style={{ padding: 0 }}>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 0.5,
              borderBottomColor: border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: accent + "15",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <Settings size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", fontSize: 16 }}>
                Calculation Method
              </Text>
              <Text variant="caption" style={{ color: muted, marginTop: 2 }}>
                {currentMethodItem?.flag + " " + currentMethodItem?.name}
              </Text>
            </View>
            <ChevronRight size={20} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReset}
            disabled={loading}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#f43f5e15",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <RefreshCcw size={20} color="#f43f5e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontWeight: "600", fontSize: 16, color: "#f43f5e" }}
              >
                Reset to Default
              </Text>
              <Text variant="caption" style={{ color: muted, marginTop: 2 }}>
                Use location-based method
              </Text>
            </View>
          </TouchableOpacity>
        </Card>

        {!isGuest && (
          <Text
            variant="subtitle"
            style={{
              marginTop: 8,
              marginBottom: 8,
              fontWeight: "700",
              opacity: 0.6,
            }}
          >
            AI Chatbot
          </Text>
        )}

        {!isGuest && (
          <Card style={{ padding: 0 }}>
            {!isEditingKey ? (
              <TouchableOpacity
                onPress={() => setIsEditingKey(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: accent + "15",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 16,
                  }}
                >
                  <Key size={20} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", fontSize: 16 }}>
                    Model API Key
                  </Text>
                  <Text
                    variant="caption"
                    style={{
                      color: apiKey ? "#10b981" : muted,
                      marginTop: 2,
                    }}
                  >
                    {apiKey ? "✓ Securely Saved" : "Click to set your API key"}
                  </Text>
                </View>
                <ChevronRight size={20} color={muted} />
              </TouchableOpacity>
            ) : (
              <View style={{ padding: 16, gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: accent + "15",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Key size={20} color={accent} />
                  </View>
                  <Text style={{ fontWeight: "600", fontSize: 16 }}>
                    Model API Key
                  </Text>
                </View>

                <Input
                  value={tempKey}
                  onChangeText={setTempKey}
                  placeholder="Paste your API key here..."
                  secureTextEntry
                  containerStyle={{ width: "100%" }}
                />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    style={{ flex: 1 }}
                    onPress={saveApiKey}
                    disabled={!tempKey.trim()}
                  >
                    Save Key
                  </Button>
                  {apiKey && (
                    <Button
                      variant="outline"
                      onPress={() => {
                        setIsEditingKey(false);
                        setTempKey("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </View>
              </View>
            )}
          </Card>
        )}

        <Text
          variant="subtitle"
          style={{
            marginTop: 8,
            marginBottom: 8,
            fontWeight: "700",
            opacity: 0.6,
          }}
        >
          Account
        </Text>

        {isGuest && (
          <Card
            style={{
              padding: 16,
              borderColor: accent + "30",
              borderWidth: 1,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: accent + "15",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <ShieldCheck size={20} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 16 }}>
                  Upgrade Account
                </Text>
                <Text variant="caption" style={{ color: muted }}>
                  Sync your data across devices
                </Text>
              </View>
            </View>
            <Button size="sm" onPress={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <Spinner size="sm" color="#fff" />
              ) : (
                "Link Email or Google"
              )}
            </Button>
          </Card>
        )}

        {!isGuest && (
          <Card style={{ padding: 0 }}>
            <TouchableOpacity
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#f43f5e15",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 16,
                }}
              >
                {isLoggingOut ? (
                  <Spinner size="sm" color="#f43f5e" />
                ) : (
                  <LogOut size={20} color="#f43f5e" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontWeight: "600", fontSize: 16, color: "#f43f5e" }}
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Text>
                <Text variant="caption" style={{ color: muted, marginTop: 2 }}>
                  End your current session
                </Text>
              </View>
              {!isLoggingOut && <ChevronRight size={20} color={muted} />}
            </TouchableOpacity>
          </Card>
        )}

        {loading && (
          <View style={{ padding: 20, alignItems: "center" }}>
            <Spinner showLabel label="Updating settings..." />
          </View>
        )}

        {/* Footer */}
        <View
          style={{
            width: "100%",
            position: "absolute",
            bottom: 40,
            alignItems: "center",
            opacity: 0.3,
          }}
        >
          <Text style={{ fontSize: 12 }}>
            © {new Date().getFullYear()} Roe • All rights reserved
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: "80%",
              paddingTop: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 24,
                marginBottom: 20,
              }}
            >
              <Text variant="title" style={{ fontSize: 20, fontWeight: "700" }}>
                Select Method
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: accent, fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {CALCULATION_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => handleSelectMethod(m.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    borderBottomWidth: 0.5,
                    borderBottomColor: border,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: currentMethod === m.id ? accent : primary,
                      fontWeight: currentMethod === m.id ? "700" : "400",
                    }}
                  >
                    {m.flag + " "} {m.name}
                  </Text>
                  {currentMethod === m.id && <Check size={20} color={accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
