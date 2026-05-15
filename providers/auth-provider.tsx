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

const USER_ID_STORAGE_KEY = "roe_user_id";
const AUTH_COMPLETED_KEY = "roe_auth_completed";

interface AuthContextType {
  userId: string | null;
  userName: string | null;
  isLoading: boolean;
  isGuest: boolean;
  loginAsGuest: () => Promise<any>;
  login: (data: any) => Promise<any>;
  signup: (data: any) => Promise<any>;
  loginWithGoogle: (data: any) => Promise<any>;
  upgradeToGoogle: (data: any) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const loginMutation = trpc.auth.login.useMutation();
  const emailLoginMutation = (trpc.auth as any).loginWithEmail?.useMutation?.() || { mutateAsync: async () => { throw new Error("Email login not implemented on backend"); } };
  const upgradeMutation = (trpc.auth as any).upgradeToEmail?.useMutation?.() || { mutateAsync: async () => { throw new Error("Upgrade not implemented on backend"); } };
  const googleLoginMutation = (trpc.auth as any).loginWithGoogle?.useMutation?.() || { mutateAsync: async () => { throw new Error("Google login not implemented on backend"); } };
  const googleUpgradeMutation = (trpc.auth as any).upgradeToGoogle?.useMutation?.() || { mutateAsync: async () => { throw new Error("Google upgrade not implemented on backend"); } };

  const initAuth = useCallback(async () => {
    try {
      let id = await SecureStore.getItemAsync(USER_ID_STORAGE_KEY);
      const hasCompletedAuth =
        await SecureStore.getItemAsync(AUTH_COMPLETED_KEY);
      const androidId = Application.getAndroidId();
      console.log("[Auth] Init - Stored ID:", id);

      if (!id) {
        if (Platform.OS === "android") {
          id = androidId;
          if (!id) {
            id =
              "fallback-" +
              Math.random().toString(36).substring(2) +
              Date.now().toString(36);
          }
        } else {
          id =
            Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
        if (id) await SecureStore.setItemAsync(USER_ID_STORAGE_KEY, id);
      }

      if (id && hasCompletedAuth === "true") {
        const user = await loginMutation.mutateAsync({ userId: id });
        setUserId(user.id);
        setUserName(user.name);
        setIsGuest(!user.email);
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
    const id = await SecureStore.getItemAsync(USER_ID_STORAGE_KEY);
    if (!id) return;
    try {
      const user = await loginMutation.mutateAsync({ userId: id });
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      setUserId(user.id);
      setUserName(user.name);
      setIsGuest(true);
      return user;
    } catch (e) {
      console.error("[Auth] Guest login failed", e);
      throw e;
    }
  };

  const login = async (data: any) => {
    try {
      const user = await emailLoginMutation.mutateAsync(data);
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      setUserId(user.id);
      setUserName(user.name);
      setIsGuest(false);
      return user;
    } catch (e) {
      console.error("[Auth] Login failed", e);
      throw e;
    }
  };

  const signup = async (data: any) => {
    // 1. Get current device identity
    let currentId = userId;
    if (!currentId) {
      currentId = await SecureStore.getItemAsync(USER_ID_STORAGE_KEY);
    }
    
    if (!currentId) throw new Error("Could not identify device for signup");

    try {
      // 2. Ensure an anonymous record exists in DB first
      // The backend 'login' procedure handles this creation if it doesn't exist
      await loginMutation.mutateAsync({ userId: currentId });
      
      // 3. Perform the actual upgrade to email account
      const user = await upgradeMutation.mutateAsync({ ...data, userId: currentId });
      
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      setUserId(user.id);
      setUserName(user.name);
      setIsGuest(false);
      return user;
    } catch (e) {
      console.error("[Auth] Signup/Upgrade failed", e);
      throw e;
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(AUTH_COMPLETED_KEY);
    setUserId(null);
    setUserName(null);
    setIsGuest(false);
  };

  const loginWithGoogle = async (data: any) => {
    try {
      const user = await googleLoginMutation.mutateAsync(data);
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      setUserId(user.id);
      setUserName(user.name);
      setIsGuest(false);
      return user;
    } catch (e) {
      console.error("[Auth] Google login failed", e);
      throw e;
    }
  };

  const upgradeToGoogle = async (data: any) => {
    let currentId = userId;
    if (!currentId) {
      currentId = await SecureStore.getItemAsync(USER_ID_STORAGE_KEY);
    }
    if (!currentId) throw new Error("Could not identify device for upgrade");

    try {
      const user = await googleUpgradeMutation.mutateAsync({
        ...data,
        userId: currentId,
      });
      await SecureStore.setItemAsync(AUTH_COMPLETED_KEY, "true");
      setUserId(user.id);
      setUserName(user.name);
      setIsGuest(false);
      return user;
    } catch (e) {
      console.error("[Auth] Google upgrade failed", e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        userName,
        isLoading:
          isInitializing ||
          loginMutation.isPending ||
          emailLoginMutation.isPending ||
          upgradeMutation.isPending ||
          googleLoginMutation.isPending ||
          googleUpgradeMutation.isPending,
        isGuest,
        loginAsGuest,
        login,
        signup,
        loginWithGoogle,
        upgradeToGoogle,
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
