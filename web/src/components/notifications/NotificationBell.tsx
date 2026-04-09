import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useNotifications } from "@/hooks/useNotifications";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotifClick = (id: string) => {
    markAsRead(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center rounded-xl p-2 transition-all duration-150",
          "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
          open && "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
        )}
      >
        <Icon name="notifications" className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-0.5 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl shadow-xl",
          "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-xs text-primary hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon name="progress_activity" className="animate-spin text-xl text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Icon name="notifications_off" className="text-2xl text-slate-300 dark:text-slate-600" />
                <span className="text-sm text-slate-400 dark:text-slate-500">Aucune notification</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  to={`/mon-espace/activities/${notif.activity_id}`}
                  onClick={() => handleNotifClick(notif.id)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors duration-100",
                    "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                    !notif.is_read && "bg-primary/5 dark:bg-primary/10"
                  )}
                >
                  <div className="mt-1 shrink-0">
                    {notif.is_read ? (
                      <Icon name="chat" className="text-base text-slate-400 dark:text-slate-500" />
                    ) : (
                      <span className="mt-1.5 block h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm leading-snug",
                      notif.is_read
                        ? "text-slate-600 dark:text-slate-400"
                        : "font-medium text-slate-900 dark:text-slate-100"
                    )}>
                      {notif.message}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {relativeTime(notif.created_at)}
                    </p>
                  </div>
                  <Icon name="chevron_right" className="mt-1 shrink-0 text-base text-slate-300 dark:text-slate-600" />
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
