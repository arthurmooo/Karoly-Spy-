import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotifications,
  getUnreadCount,
  markAsRead as markAsReadRepo,
  markAllAsRead as markAllAsReadRepo,
  type Notification,
} from "@/repositories/notification.repository";

export function useNotifications() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, []);

  // Initial fetch when auth is ready
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setIsLoading(true);
    refresh().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [authLoading, user?.id, refresh]);

  // Refresh on window focus (pragmatic polling — sufficient for a coaching tool)
  useEffect(() => {
    const handleFocus = () => { void refresh(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markAsReadRepo(id);
    } catch (err) {
      console.error("markAsRead failed:", err);
      await refresh(); // revert optimistic update on error
    }
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllAsReadRepo();
    } catch (err) {
      console.error("markAllAsRead failed:", err);
      await refresh();
    }
  }, [refresh]);

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refresh };
}
