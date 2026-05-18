import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { trpc } from "@/utils/trpc";
import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Storage } from "expo-sqlite/kv-store";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useQueryClient } from "@tanstack/react-query";

const USER_ID_STORAGE_KEY = "roe_user_id";
const USER_NAME_STORAGE_KEY = "roe_user_name";
const AUTH_COMPLETED_KEY = "roe_auth_completed";
const AUTH_TOKEN_KEY = "roe_auth_token";
const API_KEY_STORAGE = "gemini_api_key";
const PRAYER_STORAGE_KEY = "prayer-times";

interface AuthContextType {
  userId: string | null;
  userName: string | null;
  token: string | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  isGuest: boolean;
  loginAsGuest: () => Promise<any>;
  login: (data: any) => Promise<any>;
  signup: (data: any) => Promise<any>;
  loginWithGoogle: (data: any) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isTokenExpired(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    const payload = parts[1];
    // Decode base64url to base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const { exp } = JSON.parse(decoded);

    if (!exp) return false;

    // Buffer of 60 seconds
    return Date.now() >= exp * 1000 - 60000;
  } catch (e) {
    console.error("[Auth] Failed to decode token:", e);
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const queryClient = useQueryClient();

  const utils = trpc.useUtils();
  const registerMutation = (trpc.auth as any).register.useMutation();
  const loginWithEmailMutation = trpc.auth.loginWithEmail.useMutation();
  const loginWithGoogleMutation = trpc.auth.loginWithGoogle.useMutation();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const initAuth = useCallback(async () => {
    try {
      const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const storedUserId = await SecureStore.getItemAsync(USER_ID_STORAGE_KEY);
      const storedUserName = await SecureStore.getItemAsync(USER_NAME_STORAGE_KEY);
      const hasCompletedAuth = await SecureStore.getItemAsync(AUTH_COMPLETED_KEY);

      if (storedToken && !isTokenExpired(storedToken)) {
        setToken(storedToken);
        setUserId(storedUserId);
        setUserName(storedUserName);
        setIsGuest(false);
      } else if (hasCompletedAuth === "true" && storedUserId?.startsWith("guest_")) {
        setUserId(storedUserId);
        setIsGuest(true);
      }
    } catch (e) {
      console.error("[Auth] Initialization failed:", e);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const loginAsGuest = async () => {
    try {
      const randomId = `guest_${Math.random().toString(36).substring(2, 11)}`;
      await SecureStore.setItemAsync(USER_ID_STORAGE_KEY, randomId);
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      await SecureStore.deleteItemAsync(USER_NAME_STORAGE_KEY);
      
      setUserId(randomId);
      setUserName(null);
      setToken(null);
      setIsGuest(true);
      return { user: { id: randomId } };
    } catch (e) {
      console.error("[Auth] Guest login failed", e);
      throw e;
    }
  };

  const login = async (data: any) => {
    try {
      const result = await loginWithEmailMutation.mutateAsync(data);
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      await SecureStore.setItemAsync(USER_ID_STORAGE_KEY, result.user.id);
      if (result.user.name) {
        await SecureStore.setItemAsync(USER_NAME_STORAGE_KEY, result.user.name);
      }
      if (result.token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, result.token);
        setToken(result.token);
      }
      setUserId(result.user.id);
      setUserName(result.user.name);
      setIsGuest(false);
      return result;
    } catch (e) {
      console.error("[Auth] Login failed", e);
      throw e;
    }
  };

  const signup = async (data: any) => {
    try {
      const result = await registerMutation.mutateAsync(data);
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      await SecureStore.setItemAsync(USER_ID_STORAGE_KEY, result.user.id);
      if (result.user.name) {
        await SecureStore.setItemAsync(USER_NAME_STORAGE_KEY, result.user.name);
      }
      if (result.token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, result.token);
        setToken(result.token);
      }
      setUserId(result.user.id);
      setUserName(result.user.name);
      setIsGuest(false);
      return result;
    } catch (e) {
      console.error("[Auth] Registration failed", e);
      throw e;
    }
  };

  const loginWithGoogle = async (data: any) => {
    try {
      const result = await loginWithGoogleMutation.mutateAsync(data);
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      await SecureStore.setItemAsync(USER_ID_STORAGE_KEY, result.user.id);
      if (result.user.name) {
        await SecureStore.setItemAsync(USER_NAME_STORAGE_KEY, result.user.name);
      }
      if (result.token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, result.token);
        setToken(result.token);
      }
      setUserId(result.user.id);
      setUserName(result.user.name);
      setIsGuest(false);
      return result;
    } catch (e) {
      console.error("[Auth] Google login failed", e);
      throw e;
    }
  };

  const logout = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
        await GoogleSignin.revokeAccess();
      }
    } catch (e) {
      console.warn("[Auth] Google SignOut failed:", e);
    }

    try {
      await SecureStore.deleteItemAsync(AUTH_COMPLETED_KEY);
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_ID_STORAGE_KEY);
      await SecureStore.deleteItemAsync(USER_NAME_STORAGE_KEY);
      await SecureStore.deleteItemAsync(API_KEY_STORAGE);

      Storage.removeItemSync(PRAYER_STORAGE_KEY);
      await AsyncStorage.removeItem("@prayer_state");
      await AsyncStorage.removeItem("@method_override");
    } catch (e) {
      console.warn("[Auth] Failed to clear storage during logout", e);
    }

    try {
      queryClient.clear();
      await utils.invalidate();
      setUserId(null);
      setUserName(null);
      setToken(null);
      setIsGuest(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        userName,
        token,
        isLoading:
          isInitializing ||
          registerMutation.isPending ||
          loginWithEmailMutation.isPending ||
          loginWithGoogleMutation.isPending,
        isLoggingOut,
        isGuest,
        loginAsGuest,
        login,
        signup,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
