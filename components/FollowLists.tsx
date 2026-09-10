"use client";
import { useState } from "react";
import Link from "next/link";
import { User as UserIcon, ChevronDown } from "lucide-react";
import type { FollowUserRow } from "@/lib/follows";

export default function FollowLists({
  followersCount,
  followingCount,
  followers,
  following
}: {
  followersCount: number;
  followingCount: number;
  followers: FollowUserRow[];
  following: FollowUserRow[];
}) {
  const [open, setOpen] = useState<"followers" | "following" | null>(null);

  const list = open === "followers" ? followers : open === "following" ? following : [];
  const total = open === "followers" ? followersCount : followingCount;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <button
          onClick={() => setOpen(open === "followers" ? null : "followers")}
          disabled={followersCount === 0}
          className={`inline-flex items-center gap-1 text-gray-300 transition ${
            followersCount ? "hover:text-white" : "cursor-default opacity-70"
          }`}
        >
          <b className="text-white">{followersCount.toLocaleString("he-IL")}</b> עוקבים
          {followersCount > 0 && (
            <ChevronDown className={`h-3.5 w-3.5 transition ${open === "followers" ? "rotate-180" : ""}`} />
          )}
        </button>
        <button
          onClick={() => setOpen(open === "following" ? null : "following")}
          disabled={followingCount === 0}
          className={`inline-flex items-center gap-1 text-gray-300 transition ${
            followingCount ? "hover:text-white" : "cursor-default opacity-70"
          }`}
        >
          <b className="text-white">{followingCount.toLocaleString("he-IL")}</b> עוקב/ת אחרי
          {followingCount > 0 && (
            <ChevronDown className={`h-3.5 w-3.5 transition ${open === "following" ? "rotate-180" : ""}`} />
          )}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-border bg-surface2/40 p-2 text-right">
          {list.map((u) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface2 ring-1 ring-border">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt={u.username} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-3.5 w-3.5 text-primary-light" />
                )}
              </span>
              <span className="text-sm font-semibold text-gray-200">{u.username}</span>
            </Link>
          ))}
          {total > list.length && (
            <p className="px-2 py-1 text-xs text-gray-500">ועוד {(total - list.length).toLocaleString("he-IL")}…</p>
          )}
        </div>
      )}
    </div>
  );
}
