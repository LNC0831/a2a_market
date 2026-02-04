/**
 * 通知系统 Context
 * 为未来的 WebSocket 实时通知做基础设施准备
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// 通知类型
export const NotificationType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

// 创建 Context
const NotificationContext = createContext(null);

/**
 * 通知 Provider
 */
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  // 添加通知
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newNotification = {
      id,
      type: NotificationType.INFO,
      duration: 5000,
      ...notification,
      createdAt: Date.now(),
    };

    setNotifications((prev) => [...prev, newNotification]);

    // 自动移除
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  // 移除通知
  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 清除所有通知
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // 快捷方法
  const notify = {
    info: (message, options = {}) =>
      addNotification({ type: NotificationType.INFO, message, ...options }),
    success: (message, options = {}) =>
      addNotification({ type: NotificationType.SUCCESS, message, ...options }),
    warning: (message, options = {}) =>
      addNotification({ type: NotificationType.WARNING, message, ...options }),
    error: (message, options = {}) =>
      addNotification({ type: NotificationType.ERROR, message, ...options }),
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
        notify,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * 使用通知的 Hook
 */
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

/**
 * 通知显示组件 (可选择性添加到 Layout)
 */
export function NotificationContainer() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) {
    return null;
  }

  const typeStyles = {
    [NotificationType.INFO]: 'bg-blue-50 border-blue-200 text-blue-800',
    [NotificationType.SUCCESS]: 'bg-green-50 border-green-200 text-green-800',
    [NotificationType.WARNING]: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    [NotificationType.ERROR]: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${
            typeStyles[notification.type]
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {notification.title && (
                <div className="font-medium mb-1">{notification.title}</div>
              )}
              <div className="text-sm">{notification.message}</div>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-3 opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationContext;
