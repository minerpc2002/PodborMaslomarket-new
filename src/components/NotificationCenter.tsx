import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotificationCenter() {
  const { notifications, removeNotification, markAsViewed } = useAppStore();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    if (notification.carId) {
      markAsViewed(notification.carId);
      navigate(`/result/${notification.carId}`);
    }
    removeNotification(notification.id);
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-[320px] pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="pointer-events-auto"
          >
            <div 
              onClick={() => handleNotificationClick(notification)}
              className="liquid-glass-heavy border border-white/10 rounded-2xl p-4 shadow-2xl cursor-pointer group hover:border-blue-500/50 transition-all active:scale-95"
            >
              <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                  {notification.type === 'success' && <CheckCircle2 className="text-green-400" size={20} />}
                  {notification.type === 'error' && <AlertCircle className="text-red-400" size={20} />}
                  {notification.type === 'info' && <Info className="text-blue-400" size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-zinc-100 truncate">
                      {notification.title}
                    </h4>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  {notification.carId && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 mt-2 uppercase tracking-wider">
                      Посмотреть результат
                      <ChevronRight size={10} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
