/**
 * Notification Service
 * Centralized notification management for workflow actions
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'action';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: Date;
  read: boolean;
  link?: string;
  data?: any;
}

let notifications: Notification[] = [];

export const notificationService = {
  getAll(): Notification[] {
    return notifications;
  },
  getUnread(): Notification[] {
    return notifications.filter(n => !n.read);
  },
  push(type: NotificationType, message: string, link?: string, data?: any) {
    const notification: Notification = {
      id: Math.random().toString(36).slice(2),
      type,
      message,
      createdAt: new Date(),
      read: false,
      link,
      data,
    };
    notifications.unshift(notification);
    return notification;
  },
  markRead(id: string) {
    const n = notifications.find(n => n.id === id);
    if (n) n.read = true;
  },
  clearAll() {
    notifications = [];
  },
};
