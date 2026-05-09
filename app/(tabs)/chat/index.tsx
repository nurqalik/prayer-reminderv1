import { useState, useEffect, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { View } from "@/components/ui/view";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColor } from "@/hooks/useColor";
import { GoogleGenerativeAI } from "@google/generative-ai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Send, User, Bot, Trash2, Key, Info } from "lucide-react-native";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";

const STORAGE_KEY = "@chat_history";
const API_KEY_STORAGE = "@gemini_api_key";

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState("");

  const accent = useColor("blue");
  const background = useColor("background");
  const muted = useColor("muted");
  const border = useColor("border");
  const text = useColor("text");

  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [history, key] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(API_KEY_STORAGE),
      ]);
      if (history) setMessages(JSON.parse(history));
      if (key) setApiKey(key);
      else setShowKeyInput(true);
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  const saveHistory = async (newMessages: Message[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages));
    } catch (e) {
      console.error("Failed to save chat history", e);
    }
  };

  const saveApiKey = async () => {
    if (!tempKey.trim()) return;
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, tempKey.trim());
      setApiKey(tempKey.trim());
      setShowKeyInput(false);
      setTempKey("");
    } catch (e) {
      console.error("Failed to save API key", e);
    }
  };

  const clearHistory = async () => {
    setMessages([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !apiKey) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite-preview",
        systemInstruction:
          "You are a helpful and knowledgeable Islamic assistant. Follow these rules strictly:\n1. Only answer questions related to Islam.\n2. If you are not sure about an answer, honestly say that you are not sure.\n3. If the user asks a question that is out of the topic of Islam, politely decline and explain that you can only answer questions related to Islam.",
        // tools: [{ googleSearchRetrieval: {} }],
      });

      const chat = model.startChat({
        history: messages.slice(-10).map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        })),
      });

      const result = await chat.sendMessage(userMessage.content);
      const response = await result.response;
      const botText = response.text();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: botText,
        timestamp: Date.now(),
      };

      const finalMessages = [...newMessages, botMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages);
    } catch (e: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: `Error: ${e.message}. Please check your API key.`,
        timestamp: Date.now(),
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
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
            {isUser ? "YOU" : "Roe Bot"}
          </Text>
        </View>
        {isUser ? (
          <Text
            style={{
              color: "#fff",
              fontSize: 15,
              lineHeight: 20,
            }}
          >
            {item.content}
          </Text>
        ) : (
          <Markdown
            style={{
              body: { color: text, fontSize: 15, lineHeight: 22 },
              code_inline: {
                backgroundColor: background,
                color: text,
                borderRadius: 4,
                paddingHorizontal: 4,
              },
              fence: {
                backgroundColor: background,
                color: text,
                borderRadius: 8,
                padding: 8,
              },
              heading1: { color: text, marginTop: 8, marginBottom: 4 },
              heading2: { color: text, marginTop: 8, marginBottom: 4 },
              heading3: { color: text, marginTop: 8, marginBottom: 4 },
              heading4: { color: text, marginTop: 8, marginBottom: 4 },
              heading5: { color: text, marginTop: 8, marginBottom: 4 },
              heading6: { color: text, marginTop: 8, marginBottom: 4 },
              link: { color: accent },
              paragraph: { marginTop: 0, marginBottom: 8 },
              list_item: { marginBottom: 4 },
            }}
          >
            {item.content}
          </Markdown>
        )}
      </View>
    );
  };

  if (showKeyInput) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: background,
          padding: 24,
          paddingBottom: insets.bottom + 24,
          justifyContent: "center",
        }}
      >
        <Card>
          <CardContent style={{ padding: 24, gap: 16 }}>
            <View style={{ alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: accent + "15",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Key size={32} color={accent} />
              </View>
              <Text variant="title">Gemini Setup</Text>
              <Text variant="caption" style={{ textAlign: "center" }}>
                Enter your API key to start chatting with Gemini AI.
              </Text>
            </View>

            <Input
              value={tempKey}
              onChangeText={setTempKey}
              placeholder="Google Gemini API Key"
              secureTextEntry
              containerStyle={{ width: "100%" }}
            />

            <Button onPress={saveApiKey}>Save and Continue</Button>

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 8,
              }}
            >
              <Info size={14} color={accent} />
              <Text variant="link" style={{ fontSize: 13 }}>
                Get key from Google AI Studio
              </Text>
            </TouchableOpacity>
          </CardContent>
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 0.9, backgroundColor: background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
        style={{ flex: 1 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 100,
              opacity: 0.3,
            }}
          >
            <Bot size={64} color={text} />
            <Text
              style={{
                marginTop: 16,
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              Assalamu'alaikum!{"\n"}How can I help you today?
            </Text>
          </View>
        }
      />

      {loading && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Spinner size="sm" />
          <Text variant="caption" style={{ fontSize: 12 }}>
            Roe is thinking...
          </Text>
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: border,
          backgroundColor: background,
        }}
      >
        <TouchableOpacity
          onPress={() => setShowKeyInput(true)}
          style={{ padding: 4 }}
        >
          <Key size={22} color={text} style={{ opacity: 0.6 }} />
        </TouchableOpacity>

        <Input
          value={input}
          onChangeText={setInput}
          placeholder="Ask Roe..."
          containerStyle={{ flex: 1 }}
          inputStyle={{ height: 44 }}
          onSubmitEditing={sendMessage}
        />

        <TouchableOpacity
          onPress={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: input.trim() ? accent : muted,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <Send size={20} color={input.trim() ? "#fff" : text} />
          )}
        </TouchableOpacity>

        {messages.length > 0 && (
          <TouchableOpacity onPress={clearHistory} style={{ padding: 4 }}>
            <Trash2 size={22} color={text} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    maxWidth: "85%",
  },
  userMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  botMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
});
