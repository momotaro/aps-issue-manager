"use client";

/**
 * UserSwitcher — 現在のユーザー（監督会社 / 協力会社）を切り替えるセグメントトグル。
 *
 * @remarks
 * AppHeader（黒背景）の右側に配置される。
 * 認証導入前の暫定 UI であり、将来は削除または認証済みユーザー表示に置き換える。
 */

import { MOCK_USERS } from "@/lib/mock-users";
import { useCurrentUser } from "./current-user-provider";

export const UserSwitcher = () => {
  const { currentUser, switchUser } = useCurrentUser();

  return (
    <div className="flex items-center gap-0 rounded-md border border-zinc-700 p-0.5">
      {MOCK_USERS.map((user) => {
        const isActive = currentUser.id === user.id;
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => switchUser(user.id)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-white text-zinc-900"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: user.color }}
            />
            {user.company === "supervisor" ? "監督会社" : "協力会社"}
          </button>
        );
      })}
    </div>
  );
};
