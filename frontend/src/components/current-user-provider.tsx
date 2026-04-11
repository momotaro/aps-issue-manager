"use client";

/**
 * 現在のユーザーを管理する Provider / フック。
 *
 * @remarks
 * 認証導入前の暫定実装として、mock ユーザー 2 名から UserSwitcher で選択する。
 * localStorage に永続化し、リロード後も選択を維持する。
 * `(app)/layout.tsx` に配置され、AppHeader 含む配下すべてで `useCurrentUser` を利用できる。
 *
 * TODO(auth): 認証導入時は backend セッションから取得する形に差し替える。
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  findMockUserById,
  MOCK_USER_SUPERVISOR,
  type MockUser,
} from "@/lib/mock-users";

const STORAGE_KEY = "viewer.currentUserId";

type CurrentUserContextValue = {
  currentUser: MockUser;
  switchUser: (userId: string) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/**
 * 現在のユーザーを提供する Provider。
 * `(app)/layout.tsx` のルートに配置する。
 */
export const CurrentUserProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] =
    useState<MockUser>(MOCK_USER_SUPERVISOR);

  // localStorage からの復元は hydration mismatch を避けるため useEffect で行う
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const user = findMockUserById(saved);
    if (user) setCurrentUser(user);
  }, []);

  const switchUser = useCallback((userId: string) => {
    const user = findMockUserById(userId);
    if (!user) return;
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, userId);
    }
  }, []);

  return (
    <CurrentUserContext.Provider value={{ currentUser, switchUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
};

/**
 * 現在のユーザーと切替関数を返すフック。
 * `CurrentUserProvider` の配下で使用すること。
 */
export const useCurrentUser = (): CurrentUserContextValue => {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx;
};
