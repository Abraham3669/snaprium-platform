// src/lib/useNotifications.js
import { useCallback, useEffect, useState } from "react";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notifications";

export default function useNotifications(uid) {
  const [items, setItems] = useState([]);
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