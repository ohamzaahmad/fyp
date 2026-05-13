import api from './api.ts';

export type NotificationItem = {
  id: string;
  message: string;
  created_at?: string;
  unread?: boolean;
};

export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await api.get('/notifications/');
    // allow either array or { notifications: [] }
    if (Array.isArray(res.data)) return res.data;
    return res.data.notifications || [];
  } catch (e) {
    // fallback to local sample notifications when backend not present or offline
    return [
      { id: 'local-1', message: 'Welcome to Nexus — check Settings to customize.', created_at: new Date().toISOString(), unread: true },
      { id: 'local-2', message: 'Daily sync completed successfully.', created_at: new Date().toISOString(), unread: false }
    ];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await api.post(`/notifications/${encodeURIComponent(id)}/mark-read/`);
  } catch (e) {
    // ignore errors - best-effort
    return;
  }
}

export default { fetchNotifications, markNotificationRead };
