import api from './api.ts';

export type NotificationItem = {
  id: string;
  message: string;
  created_at?: string;
  unread?: boolean;
};

export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await api.get('/analytics/summary/');
    const feed = Array.isArray(res.data?.feed) ? res.data.feed : [];
    return feed.map((item: any, idx: number) => ({
      id: String(item?.id ?? `feed-${idx}`),
      message: String(item?.message ?? item?.event_type ?? 'Notification'),
      created_at: item?.created_at,
      unread: false,
    }));
  } catch (e) {
    // fallback to local sample notifications when backend not present or offline
    return [
      { id: 'local-1', message: 'Welcome to Nexus — check Settings to customize.', created_at: new Date().toISOString(), unread: true },
      { id: 'local-2', message: 'Daily sync completed successfully.', created_at: new Date().toISOString(), unread: false }
    ];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  // No backend endpoint currently exists for read-tracking; keep this best-effort no-op.
  void id;
  return;
}

export default { fetchNotifications, markNotificationRead };
