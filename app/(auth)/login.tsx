import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View as RNView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { View } from "@/components/ui/view";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColor } from "@/hooks/useColor";
import { useRouter } from "expo-router";
import {
  LogIn,
  Mail,
  ShieldCheck,
  UserCircle2,
  ArrowRight,
  Chrome,
  Activity,
} from "lucide-react-native";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    loginAsGuest,
    login,
    signup,
    loginWithGoogle,
    upgradeToGoogle,
    isLoading: authLoading,
  } = useAuth();

  const accent = useColor("blue");
  const muted = useColor("textMuted");
  const background = useColor("background");
  const card = useColor("card");
  const border = useColor("border");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Google Auth Setup
  // NOTE: You must replace these with your actual Client IDs from Google Cloud Console
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId:
      "406758684869-b2vg9o0rmhv1u16h6u7ra5pbvg6fsa8c.apps.googleusercontent.com",
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    webClientId:
      "406758684869-oon4su278s5tm2rvjlofun1ebg4us031.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      handleGoogleAuthSuccess(authentication?.accessToken);
    }
  }, [response]);

  const handleGoogleAuthSuccess = async (token?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const googleUser = await userInfoResponse.json();

      const googleData = {
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        image: googleUser.picture,
      };

      try {
        // Attempt to upgrade first (handles guest -> google migration)
        await upgradeToGoogle(googleData);
      } catch (e: any) {
        // If upgrade fails (e.g. account already linked), try logging in
        if (
          e.message?.includes("already linked") ||
          e.message?.includes("CONFLICT")
        ) {
          await loginWithGoogle({ googleId: googleUser.id });
        } else {
          throw e;
        }
      }

      toast({
        title: "Welcome!",
        description: `Successfully signed in as ${googleUser.name}`,
        variant: "success",
      });
    } catch (e: any) {
      toast({
        title: "Google Auth Error",
        description: e?.message ?? "Failed to authenticate with Google.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) return;
    setLoading(true);
    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await signup({ name, email, password });
      }
      // Navigation is handled by the root layout's useEffect
    } catch (e: any) {
      toast({
        title: "Error",
        description:
          e?.message ?? `Failed to ${isLogin ? "sign in" : "sign up"}.`,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!request) {
      toast({
        title: "Initialization Error",
        description: "Google Auth is still initializing. Please try again.",
        variant: "error",
      });
      return;
    }
    promptAsync();
  };

  const handleGuestLogin = async () => {
    try {
      setLoading(true);
      await loginAsGuest();
      // Navigation is handled by the root layout's useEffect
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to continue as guest.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RNView
          style={[styles.iconContainer, { backgroundColor: accent + "15" }]}
        >
          <Activity size={40} color={accent} />
        </RNView>
        <Text variant="title" style={styles.title}>
          Prayer Reminder
        </Text>
        <Text style={[styles.subtitle, { color: muted }]}>
          Your daily Muslim companion and prayer reminder assistant.
        </Text>
      </View>

      <View style={styles.form}>
        {!isLogin && (
          <Input
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <Input
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          onPress={handleAuth}
          disabled={
            loading || authLoading || !email || !password || (!isLogin && !name)
          }
          style={styles.primaryBtn}
        >
          {loading ? (
            <Spinner size="sm" color="#fff" />
          ) : isLogin ? (
            "Sign In"
          ) : (
            "Sign Up"
          )}
        </Button>

        <TouchableOpacity
          onPress={() => setIsLogin(!isLogin)}
          style={styles.toggleBtn}
        >
          <Text style={{ color: muted, fontSize: 14 }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <Text style={{ color: accent, fontWeight: "700" }}>
              {isLogin ? "Sign Up" : "Sign In"}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerContainer}>
        <View style={[styles.divider, { backgroundColor: border }]} />
      </View>

      <View style={styles.socialContainer}>
        <Button
          variant="outline"
          onPress={handleGoogleLogin}
          style={styles.socialBtn}
          disabled={loading || authLoading || !request}
        >
          <RNView style={styles.socialBtnContent}>
            <Image
              source={require("@/assets/google-icon.svg")}
              style={{ width: 20, height: 20, marginRight: 10 }}
              contentFit="contain"
            />
            <Text style={{ fontWeight: "600" }}>Continue with Google</Text>
          </RNView>
        </Button>

        <TouchableOpacity
          onPress={handleGuestLogin}
          style={styles.guestBtn}
          disabled={loading || authLoading}
        >
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Text style={{ color: muted, fontWeight: "600" }}>
                Continue as Guest
              </Text>
              <ArrowRight size={16} color={muted} style={{ marginLeft: 4 }} />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: muted }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  form: {
    gap: 16,
  },
  primaryBtn: {
    height: 52,
    marginTop: 8,
  },
  toggleBtn: {
    alignItems: "center",
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 32,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  socialContainer: {
    gap: 16,
  },
  socialBtn: {
    height: 52,
  },
  socialBtnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    height: 32,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 32,
    right: 32,
  },
  footerText: {
    fontSize: 11,
    textAlign: "center",
    opacity: 0.6,
  },
});
