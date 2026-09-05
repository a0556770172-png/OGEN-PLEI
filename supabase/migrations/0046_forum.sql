-- פורום "הצעות לשיפור ורעיונות" - כל משתמש כותב פוסטים, מגיב, ונותן לייק.
-- כל לייק על פוסט ראשי = +1 מוניטין לכותב (פעם אחת לכל זוג פוסט+נותן-לייק).
-- בנוסף: מעקב בין משתמשים (user_follows).

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.forum_posts(id) on delete cascade, -- null = פוסט ראשי; אחרת תגובה
  title text,                                                          -- רק לפוסטים ראשיים
  body text not null,
  hidden boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forum_posts_parent_idx on public.forum_posts (parent_id, created_at);
create index if not exists forum_posts_root_idx on public.forum_posts (created_at desc) where parent_id is null;

create table if not exists public.forum_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- מונע farming של מוניטין ע"י לייק / ביטול / לייק חוזר: מזכה פעם אחת בלבד.
create table if not exists public.forum_like_points_awarded (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  liker_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, liker_id)
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists user_follows_following_idx on public.user_follows (following_id);

-- RLS פעיל בלי policies = גישה דרך השרת בלבד (admin client), כמו שאר טבלאות הפורום/ביקורות.
alter table public.forum_posts enable row level security;
alter table public.forum_post_likes enable row level security;
alter table public.forum_like_points_awarded enable row level security;
alter table public.user_follows enable row level security;
