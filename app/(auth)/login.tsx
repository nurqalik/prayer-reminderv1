import React, { useState, useEffect } from "react";
import { StyleSheet, TouchableOpacity, View as RNView } from "react-native";
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

import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

export default function LoginScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    loginAsGuest,
    login,
    signup,
    loginWithGoogle,
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

  // Google Sign-In is configured globally in AuthProvider,
  // so we don't need to re-configure it here.

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      console.log("[Login] Starting Google Sign-In...");
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      const user = userInfo.data?.user;
      if (!user) throw new Error("No user data returned from Google");

      const googleData = {
        googleId: user.id,
        email: user.email,
        name: user.name ?? undefined,
        image: user.photo ?? undefined,
      };

      console.log("[Login] Google data retrieved, attempting login...");
      await loginWithGoogle(googleData);

      toast({
        title: "Welcome!",
        description: `Successfully signed in as ${user.name}`,
        variant: "success",
      });
    } catch (error: any) {
      console.error("[Login] Google auth error:", error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User closed the modal - silent
      } else if (error.code === statusCodes.IN_PROGRESS) {
        toast({
          title: "In Progress",
          description: "Login is already in progress",
          variant: "info",
        });
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        toast({
          title: "Error",
          description: "Google Play Services not available",
          variant: "error",
        });
      } else {
        toast({
          title: "Google Login Error",
          description:
            error.message ||
            "An unexpected error occurred during Google sign-in.",
          variant: "error",
        });
      }
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
    } catch (e: any) {
      console.error("[Login] Auth error:", e);
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

  const handleGuestLogin = async () => {
    try {
      console.log("[Login] Continuing as guest...");
      setLoading(true);
      await loginAsGuest();
      console.log("[Login] Guest login successful");
    } catch (e: any) {
      console.error("[Login] Guest login failed:", e);
      toast({
        title: "Error",
        description: e?.message || "Failed to continue as guest.",
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
          disabled={loading || authLoading}
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
