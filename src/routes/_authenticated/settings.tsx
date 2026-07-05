import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/tanstack-react-start";
import { useAuthedFetch } from "@/lib/api-fetch";
import { AppShell } from "@/components/bloomy/AppShell";
import { Camera, Check, Loader2, Moon, Palette, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme, type Theme } from "@/components/ThemeProvider";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Forge" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useUser();
  const authedFetch = useAuthedFetch();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      if (!user) return;
      setEmail(user.primaryEmailAddress?.emailAddress ?? "");
      setUserId(user.id);
      setCreatedAt(user.createdAt ? new Date(user.createdAt).toISOString() : null);
      setAvatarUrl(user.imageUrl ?? null);
      try {
        const res = await authedFetch("/api/profile");
        if (res.ok) {
          const p = await res.json();
          setDisplayName(p.display_name ?? "");
          if (p.avatar_url) setAvatarUrl(p.avatar_url);
        } else {
          // Profile row missing — create it lazily
          await authedFetch("/api/profile", {
            method: "PATCH",
            body: JSON.stringify({ display_name: "" }),
          });
        }
      } catch {
        // ignore — display name just stays empty
      }
      setLoaded(true);
    })();
  }, [user, authedFetch]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      // Upload avatar via the profile API (multipart-aware endpoint would be ideal;
      // for now we base64-encode and store as a data URL in the profile row).
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });

      const res = await authedFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatar_url: dataUrl }),
      });
      if (!res.ok) throw new Error("Failed to save avatar");

      const updated = await res.json();
      const nextUrl = `${updated.avatar_url}?t=${Date.now()}`;
      setAvatarUrl(nextUrl);
      window.dispatchEvent(new Event("forge:avatar-updated"));
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!userId) return;
    setUploadingAvatar(true);
    try {
      const res = await authedFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatar_url: null }),
      });
      if (!res.ok) throw new Error("Failed to remove avatar");
      setAvatarUrl(null);
      window.dispatchEvent(new Event("forge:avatar-updated"));
      toast.success("Profile picture removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove picture.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authedFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      </AppShell>
    );
  }

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "vintage", label: "Vintage", icon: Palette },
  ];

  const initials = (displayName || email || "?").slice(0, 1).toUpperCase();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10 md:py-14">
        <p className="text-[12px] uppercase tracking-[0.18em] text-text-muted">Account</p>
        <h1 className="font-display mt-2 text-[40px] leading-[1.05] tracking-tight md:text-[52px]">
          Settings
        </h1>

        {/* Appearance */}
        <div className="elev-1 mt-10 rounded-2xl border border-border/60 bg-elevated/80 p-6 md:p-8">
          <div className="font-display text-xl">Appearance</div>
          <p className="mt-1 text-sm text-text-muted">Choose how Forge looks on your screen.</p>
          <div className="mt-5 flex gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-6 py-4 text-sm font-medium transition-all ${
                  theme === value
                    ? "border-foreground/40 bg-foreground/5 text-foreground ring-2 ring-foreground/10"
                    : "border-border/60 bg-background/40 text-text-muted hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Profile */}
        <form onSubmit={saveProfile} className="elev-1 mt-6 rounded-2xl border border-border/60 bg-elevated/80 p-6 md:p-8">
          <div className="font-display text-xl">Profile</div>
          <p className="mt-1 text-sm text-text-muted">How you appear inside Forge.</p>

          {/* Avatar upload */}
          <div className="mt-6 flex items-center gap-5">
            <div className="relative">
              {/* Avatar preview */}
              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border/60 bg-elevated">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile picture"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="forge-gradient-bg flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                    {initials}
                  </div>
                )}
              </div>

              {/* Camera overlay button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-border bg-background text-text-muted shadow-sm transition-all hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Change profile picture"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="elev-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                {uploadingAvatar ? "Uploading…" : "Upload photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove photo
                </button>
              )}
              <p className="text-[11px] text-text-muted">JPG, PNG, WebP or GIF · max 5 MB</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Display name
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="forge-input mt-1.5"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Email
              </span>
              <input value={email} disabled className="forge-input mt-1.5 opacity-60" />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="elev-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save changes
            </button>
          </div>
        </form>

        {/* Account info */}
        <div className="elev-1 mt-6 rounded-2xl border border-border/60 bg-elevated/80 p-6 md:p-8">
          <div className="font-display text-xl">Account</div>
          <dl className="mt-4 divide-y divide-divider text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-text-muted">User ID</dt>
              <dd className="font-mono text-[11px]">{email}</dd>
            </div>
            {createdAt && (
              <div className="flex justify-between py-2.5">
                <dt className="text-text-muted">Member since</dt>
                <dd>{new Date(createdAt).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </div>

      </div>
    </AppShell>
  );
}
