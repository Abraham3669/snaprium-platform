// src/lib/useNotifications.js
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notifications";
import { useBlocked } from "./moderation";

export default function useNotifications(uid) {
  const [rawItems, setItems] = useState([]);
  const { blocked } = useBlocked(uid);
  // Alerts from people you blocked never show (and never count as unread).
  const items = useMemo(
    () => rawItems.filter((n) => !n.fromUid || !blocked.has(n.fromUid)),
    [rawItems, blocked]
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeToNotifications(uid, (rows) => {
      setItems(rows);
      setLoading(false);
    });
  }, [uid]);

  const unread = items.reduce((n, item) => n + (item.read ? 0 : 1), 0);

  const markRead = useCallback(
    (id) => {
      if (!uid) return;
      markNotificationRead(uid, id).catch(() => {});
    },
    [uid]
  );

  const markAllRead = useCallback(() => {
    if (!uid) return;
    markAllNotificationsRead(uid, items).catch(() => {});
  }, [uid, items]);

  return { items, loading, unread, markRead, markAllRead };
}