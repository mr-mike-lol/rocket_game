/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameNotification } from '../types';
import { Shield, Flame, Sparkles, AlertTriangle, CloudSun, Swords } from 'lucide-react';

interface NotificationToastProps {
  notifications: GameNotification[];
  onDismiss: (id: string) => void;
}

export default function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  return (
    <div className="absolute top-4 left-4 z-40 flex flex-col gap-2 w-72 max-w-[calc(100vw-2rem)] pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => {
          // Duration auto-dismiss
          return (
            <ToastItem
              key={notif.id}
              notification={notif}
              onDismiss={onDismiss}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  notification: GameNotification;
  onDismiss: (id: string) => void;
}

function ToastItem({ notification, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const getStyle = () => {
    switch (notification.type) {
      case 'boss':
        return {
          bg: 'bg-red-950/90 border-red-500/70 text-red-200',
          shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
          icon: <Swords className="w-5 h-5 text-red-400 animate-pulse" />,
        };
      case 'achievement':
        return {
          bg: 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200',
          shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
          icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
        };
      case 'powerup':
        return {
          bg: 'bg-amber-950/90 border-amber-500/70 text-amber-100',
          shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
          icon: <Shield className="w-5 h-5 text-amber-400" />,
        };
      case 'season':
        return {
          bg: 'bg-indigo-950/95 border-indigo-400/60 text-indigo-100',
          shadow: 'shadow-[0_0_15px_rgba(129,140,248,0.4)]',
          icon: <CloudSun className="w-5 h-5 text-indigo-400" />,
        };
      case 'boost':
        return {
          bg: 'bg-cyan-950/90 border-cyan-500/70 text-cyan-150',
          shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.4)]',
          icon: <Flame className="w-5 h-5 text-cyan-400" />,
        };
      default:
        return {
          bg: 'bg-slate-900/95 border-slate-700 text-slate-200',
          shadow: 'shadow-lg',
          icon: <AlertTriangle className="w-5 h-5 text-slate-400" />,
        };
    }
  };

  const style = getStyle();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      onClick={() => onDismiss(notification.id)}
      className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md cursor-pointer select-none ${style.bg} ${style.shadow}`}
      id={`notif-${notification.id}`}
    >
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-bold uppercase tracking-wider opacity-60">
          {notification.type}
        </p>
        <p className="text-sm font-sans leading-relaxed">{notification.message}</p>
      </div>
    </motion.div>
  );
}
