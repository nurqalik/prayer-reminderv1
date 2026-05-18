import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Modal,
} from "react-native";
import { View } from "@/components/ui/view";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColor } from "@/hooks/useColor";
import {
  Send,
  User,
  Bot,
  Trash2,
  Key,
  Info,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Camera,
  Rocket,
  RefreshCw,
} from "lucide-react-native";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter, Stack } from "expo-router";
import { trpc } from "@/utils/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentUploader, useUploadThing } from "@/utils/uploadthing";
import { useToast } from "@/components/ui/toast";

type Attachment = {
  uri: string;
  name: string;
  type: string;
  mimeType: string;
  url?: string; // UploadThing URL
};

// Define local message type that matches backend output
type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string | Date;
  files?: { id: string; url: string; mimeType: string }[];
};

export default function ChatScreen() {
  const { userId, isLoading: authLoading, isGuest } = useAuth();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<Attachment | null>(null);
  const [listLayoutHeight, setListLayoutHeight] = useState(0);

  const accent = useColor("blue");
  const background = useColor("background");
  const muted = useColor("muted");
  const border = useColor("border");
  const text = useColor("text");
  const card = useColor("card");

  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keyboardHeight, isKeyboardVisible, keyboardAnimationDuration } =
    useKeyboardHeight();

  const paddingBottom = useRef(new Animated.Value(0)).current;

  // tRPC Hooks
  const utils = trpc.useUtils();

  // Reset session when user changes to prevent cross-account leaks
  useEffect(() => {
    setSessionId(null);
    setOptimisticMessages([]);
  }, [userId]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!userId && !isGuest,
  });
  const hasApiKey = isGuest || !!meQuery.data?.geminiApiKey;

  const sessionsQuery = trpc.chat.getSessions.useQuery(undefined, {
    enabled: !!userId,
  });
  const sessions = sessionsQuery.data;

  const messagesQuery = trpc.chat.getMessages.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId },
  );
  const serverMessages = messagesQuery.data;
  const historyLoading = messagesQuery.isLoading;

  const createSessionMutation = trpc.chat.createSession.useMutation({
    onSuccess: (session: any) => setSessionId(session.id),
  });

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      if (sessionId) {
        utils.chat.getMessages.invalidate({ sessionId });
      }
    },
  });

  const deleteMessagesMutation = trpc.chat.deleteAllMessages.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate();
      setOptimisticMessages([]);
      toast({
        title: "History Cleared",
        description: "All messages have been deleted.",
      });
    },
  });

  const handleUploadComplete = async (res: any[], type: "image" | "file") => {
    if (res && res.length > 0 && sessionId) {
      const fileUrl = res[0].ufsUrl || res[0].url;
      const mimeType =
        res[0].type || (type === "image" ? "image/jpeg" : "application/pdf");

      const messageContent =
        type === "image" ? "See attached image" : "See attached file";

      // Create optimistic message for the upload
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        role: "USER",
        content: messageContent,
        createdAt: new Date(),
        files: [{ id: `temp-f-${Date.now()}`, url: fileUrl, mimeType }],
      };

      setOptimisticMessages((prev) => [...prev, optimisticMsg]);

      try {
        await sendMessageMutation.mutateAsync({
          sessionId,
          content: messageContent,
          file: {
            url: fileUrl,
            mimeType,
          },
        });
      } catch (e) {
        console.error("Failed to send uploaded file message", e);
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMsg.id),
        );
      }
    }
  };

  // UploadThing Hooks
  const { startUpload, isUploading: isUploadingImage } = useUploadThing(
    "chatImage",
    {
      onUploadError: (e) => {
        console.error("Upload error:", e.message);
        toast({
          title: "Upload Failed",
          description: "Could not upload image.",
          variant: "error",
        });
      },
    },
  );

  const pickImage = async (source: "library" | "camera") => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingImage({
          uri: asset.uri,
          name: asset.uri.split("/").pop() || "image.jpg",
          type: "image",
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (e) {
      console.error("Failed to pick image", e);
    }
  };

  const documentUploader = useDocumentUploader("chatFile" as any, {
    onClientUploadComplete: (res) => handleUploadComplete(res, "file"),
    onUploadError: (error) => console.error("File upload error", error),
  });

  const isUploading = isUploadingImage || documentUploader.isUploading;

  // Initialize session
  useEffect(() => {
    if (userId && sessions) {
      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
      } else if (!createSessionMutation.isPending && !sessionId) {
        createSessionMutation.mutate();
      }
    }
  }, [userId, sessions, sessionId, createSessionMutation]);

  // Remove the useEffect that clears optimistic messages as it's prone to race conditions

  useEffect(() => {
    Animated.timing(paddingBottom, {
      toValue: isKeyboardVisible ? keyboardHeight + insets.bottom : 0,
      duration: keyboardAnimationDuration || 250,
      useNativeDriver: false,
    }).start();
  }, [keyboardHeight, isKeyboardVisible, keyboardAnimationDuration]);

  // Combined messages for display
  const messages = useMemo(() => {
    const serverMsgs = Array.isArray(serverMessages) ? serverMessages : [];
    const processedServer = serverMsgs.map((msg: any) => ({
      ...msg,
      files:
        msg.files ||
        msg.MessageFile ||
        msg.messageFiles ||
        msg.attachments ||
        [],
    }));

    // Deduplicate optimistic messages that are already present in server messages
    const serverIds = new Set(processedServer.map((m: any) => m.content));
    const uniqueOptimistic = optimisticMessages.filter(
      (m) => !serverIds.has(m.content),
    );

    return [...processedServer, ...uniqueOptimistic];
  }, [serverMessages, optimisticMessages]);

  const sendMessage = async (textOverride?: string) => {
    if (!hasApiKey) {
      toast({
        title: "API Key Required",
        description:
          "Please set your Gemini API key in Settings to use the chat.",
        variant: "warning",
      });
      return;
    }

    const messageText = (
      typeof textOverride === "string" ? textOverride : input
    ).trim();

    if (
      (!messageText && !pendingImage) ||
      !sessionId ||
      sendMessageMutation.isPending ||
      isUploadingImage
    )
      return;

    if (pendingImage) {
      const imgToUpload = pendingImage;
      const textToUse = messageText || "See attached image";

      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        role: "USER",
        content: textToUse,
        createdAt: new Date(),
        files: [
          {
            id: `temp-f-${Date.now()}`,
            url: imgToUpload.uri,
            mimeType: imgToUpload.mimeType,
          },
        ],
      };

      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      setInput("");
      setPendingImage(null);

      try {
        const blob = await fetch(imgToUpload.uri).then((r) => r.blob());
        const file = new File([blob], imgToUpload.name, { 
          type: imgToUpload.mimeType || "application/octet-stream" 
        });
        
        // React Native FormData requires a uri property on the file blob
        const RNFormDataCompatibleFile = Object.assign(file, { uri: imgToUpload.uri });

        const uploadedFiles = await startUpload([RNFormDataCompatibleFile as unknown as File]);

        if (uploadedFiles && uploadedFiles.length > 0) {
          const fileUrl = uploadedFiles[0].ufsUrl || uploadedFiles[0].url;

          await sendMessageMutation.mutateAsync({
            sessionId,
            content: textToUse,
            file: {
              url: fileUrl,
              mimeType: imgToUpload.mimeType,
            },
          });
        }
      } catch (e) {
        console.error("Failed to upload/send image message", e);
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMsg.id),
        );
      }
      return;
    }

    if (!messageText) return;

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: messageText,
      createdAt: new Date(),
      files: [],
    };

    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setInput("");

    try {
      await sendMessageMutation.mutateAsync({
        sessionId,
        content: messageText,
      });
    } catch (e) {
      setOptimisticMessages((prev) =>
        prev.filter((m) => m.id !== optimisticMsg.id),
      );
      console.error("Failed to send message", e);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "USER";
    const messageFiles = item.files || [];

    return (
      <View
        key={item.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.botMessage,
          { backgroundColor: isUser ? accent : muted },
        ]}
      >
        <View style={styles.messageHeader}>
          {isUser ? (
            <User size={12} color="#fff" />
          ) : (
            <Bot size={12} color={text} />
          )}
          <Text
            style={{
              fontSize: 10,
              marginLeft: 4,
              color: isUser ? "#fff" : text,
              fontWeight: "600",
              opacity: 0.8,
            }}
          >
            {isUser ? "You" : "Roe Bot"}
          </Text>
        </View>

        {messageFiles.map((file) => (
          <View
            key={file.id || Math.random().toString()}
            style={{ marginBottom: 8 }}
          >
            {file.mimeType.startsWith("image") ? (
              <TouchableOpacity onPress={() => setSelectedImage(file.url)}>
                <Image
                  source={{ uri: file.url }}
                  style={{ width: "100%", height: 180, borderRadius: 12 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.filePlaceholder}>
                <FileText size={18} color={isUser ? "#fff" : text} />
                <Text
                  style={{
                    fontSize: 13,
                    color: isUser ? "#fff" : text,
                    fontWeight: "500",
                  }}
                >
                  Document
                </Text>
              </View>
            )}
          </View>
        ))}

        {isUser ? (
          <Text style={{ color: "#fff", fontSize: 15, lineHeight: 20 }}>
            {item.content}
          </Text>
        ) : (
          <Markdown
            style={{
              body: { color: text, fontSize: 15, lineHeight: 22 },
              paragraph: { marginTop: 0, marginBottom: 8 },
            }}
          >
            {item.content}
          </Markdown>
        )}
      </View>
    );
  };

  const isScreenLoading =
    authLoading || historyLoading || createSessionMutation.isPending;

  if (isGuest) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: background,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: accent + "15",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Bot size={40} color={accent} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 12,
              color: text,
            }}
          >
            Unlock AI Companion
          </Text>
          <Text
            style={{
              textAlign: "center",
              fontSize: 16,
              color: text,
              lineHeight: 24,
              paddingHorizontal: 16,
            }}
          >
            Sign in or create an account to start your journey with Roe, your
            personalized Islamic assistant.
          </Text>
        </View>

        <Button onPress={() => router.push("/(auth)/login")} variant="outline">
          <Text style={{ fontWeight: "400", fontSize: 15 }}>
            Sign In to Continue
          </Text>
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => utils.chat.getMessages.invalidate()}
                style={{ padding: 8, marginRight: 8 }}
              >
                <RefreshCw size={20} color={text} opacity={0.6} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteMessagesMutation.mutate()}
                style={{ padding: 8 }}
              >
                <Trash2 size={22} color={text} opacity={0.6} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <Animated.View style={{ flex: 1, paddingBottom }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            { padding: 16, paddingTop: 120, paddingBottom: 32, gap: 16 },
            messages.length === 0 && { flexGrow: 1 },
          ]}
          style={{ flex: 1 }}
          onLayout={(e) => {
            const newHeight = e.nativeEvent.layout.height;
            setListLayoutHeight(newHeight);
            // Auto-scroll when keyboard opens and shrinks layout
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          onContentSizeChange={(contentWidth, contentHeight) => {
            if (contentHeight > listLayoutHeight) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }}
          ListEmptyComponent={
            !isScreenLoading ? (
              <View style={styles.emptyState}>
                <Bot size={64} color={text} />
                <Text style={styles.emptyText}>
                  Assalamu'alaikum!{"\n"}How can I help you today?
                </Text>
              </View>
            ) : null
          }
        />

        {(sendMessageMutation.isPending || isUploading || isScreenLoading) && (
          <View style={styles.loadingContainer}>
            <Spinner size="sm" />
            <Text variant="caption" style={{ fontSize: 12 }}>
              {isUploading
                ? "Uploading file..."
                : sendMessageMutation.isPending
                  ? "Roe is thinking..."
                  : "Connecting..."}
            </Text>
          </View>
        )}

        {pendingImage && (
          <View
            style={{
              padding: 16,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: border,
              backgroundColor: background,
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <View style={{ position: "relative" }}>
              <Image
                source={{ uri: pendingImage.uri }}
                style={{ width: 80, height: 80, borderRadius: 12 }}
              />
              <TouchableOpacity
                onPress={() => setPendingImage(null)}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  backgroundColor: card,
                  borderRadius: 12,
                  padding: 4,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <X size={14} color={text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {userId && (
          <View
            style={[
              styles.inputContainer,
              { borderTopColor: border, backgroundColor: background },
              pendingImage && { borderTopWidth: 0 },
            ]}
          >
            <TouchableOpacity
              onPress={() => pickImage("library")}
              disabled={isUploading}
              style={{ padding: 4 }}
            >
              <ImageIcon
                size={22}
                color={text}
                style={{ opacity: isUploading ? 0.3 : 0.6 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => pickImage("camera")}
              style={{ padding: 4 }}
              disabled={isUploading}
            >
              <Camera
                size={22}
                color={text}
                style={{ opacity: isUploading ? 0.3 : 0.6 }}
              />
            </TouchableOpacity>

            <Input
              value={input}
              onChangeText={setInput}
              placeholder="Ask Roe..."
              containerStyle={{ flex: 1 }}
              inputStyle={{ height: 44 }}
              onSubmitEditing={(e: any) => sendMessage(e.nativeEvent.text)}
              blurOnSubmit={false}
              disabled={isUploading}
            />

            <TouchableOpacity
              onPress={() => sendMessage()}
              disabled={
                !input.trim() || sendMessageMutation.isPending || isUploading
              }
              style={[
                styles.sendBtn,
                { backgroundColor: input.trim() ? accent : muted },
              ]}
            >
              {sendMessageMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <Send size={20} color={input.trim() ? "#fff" : text} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{ position: "absolute", top: 60, right: 30, zIndex: 10 }}
          >
            <TouchableOpacity onPress={() => setSelectedImage(null)}>
              <X size={30} color="#fff" />
            </TouchableOpacity>
          </View>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: "95%", height: "80%" }}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    maxWidth: "85%",
  },
  userMessage: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  botMessage: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  filePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.3,
  },
  emptyText: { marginTop: 16, textAlign: "center", fontWeight: "500" },
  loadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
