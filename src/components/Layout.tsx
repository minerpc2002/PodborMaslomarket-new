import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, History, Heart, ShieldCheck, User, Gift, HelpCircle, Info, LayoutDashboard, LogOut, Wrench, X, ChevronDown, Sparkles, Crown } from 'lucide-react';

import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import { setupTelegram } from '../lib/telegram';
import AuthModal from './AuthModal';
import UserMenuModal from './UserMenuModal';
import PromoModal from './PromoModal';
import { auth } from '../firebase';
import FAQModal from './FAQModal';
import HowItWorksModal from './HowItWorksModal';
import SupportChatModal from './SupportChatModal';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { MessageSquare, Loader2 } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

const navItems = [
  { path: '/', icon: Home, label: 'Главная' },
  { path: '/search', icon: Search, label: 'Подбор' },
  { path: '/history', icon: History, label: 'История' },
  { path: '/favorites', icon: Heart, label: 'Избранное' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, activePromoCode, activeSearches, history, maintenanceConfig } = useAppStore();
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isMaintenanceDismissed, setIsMaintenanceDismissed] = useState(false);

  useEffect(() => {
    if (maintenanceConfig?.enabled) {
      setIsMaintenanceDismissed(false);
    }
  }, [maintenanceConfig?.enabled]);

  useEffect(() => {
    setupTelegram();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  const isPromoActive = activePromoCode && activePromoCode.expiresAt > Date.now();
  const isStaff = userProfile?.role === 'admin' || 
                  userProfile?.role === 'moderator' || 
                  userProfile?.email?.toLowerCase() === 'minerpc2002@gmail.com';

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-zinc-50 font-sans transition-colors duration-300">
      <NotificationCenter />
      <AuthModal />
      <UserMenuModal 
        isOpen={isUserMenuOpen} 
        onClose={() => setIsUserMenuOpen(false)} 
        onOpenPromo={() => setIsPromoModalOpen(true)}
      />
      <PromoModal isOpen={isPromoModalOpen} onClose={() => setIsPromoModalOpen(false)} />
      <FAQModal isOpen={isFAQModalOpen} onClose={() => setIsFAQModalOpen(false)} />
      <HowItWorksModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
      <SupportChatModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} />
      
      {/* Maintenance Notification Banner */}
      <AnimatePresence>
        {maintenanceConfig?.enabled && !isMaintenanceDismissed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 border-b border-amber-300 text-amber-950 font-medium px-4 py-2.5 text-xs sm:text-sm z-[60] relative flex items-center justify-between gap-3 shadow-xl"
          >
            <div className="flex items-center gap-2.5 max-w-3xl mx-auto w-full justify-center text-center sm:text-left">
              <div className="p-1 bg-amber-950/10 rounded-lg shrink-0">
                <Wrench className="w-4 h-4 text-amber-950 animate-bounce" />
              </div>
              <span className="font-bold text-amber-950">
                {maintenanceConfig.message || 'Ведутся технические работы. Приложение может работать со сбоями.'}
              </span>
            </div>
            <button
              onClick={() => setIsMaintenanceDismissed(true)}
              className="p-1 hover:bg-amber-950/10 rounded-lg text-amber-950/80 hover:text-amber-950 transition-colors shrink-0"
              title="Скрыть предупреждение"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 w-full liquid-glass border-b border-white/5 shadow-xl"
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 max-w-md mx-auto w-full">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-sm tracking-tight shrink-0">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-blue-500/50 shadow-lg shadow-blue-500/20 bg-zinc-900 flex items-center justify-center"
            >
              {/* Fallback icon if logo.png is missing */}
              <Search size={16} strokeWidth={2.5} className="text-blue-500 absolute z-0" />
              {/* New logo from user */}
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-cover relative z-10"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </motion.div>
            <div className="flex flex-col leading-none">
              <span className="text-zinc-50 text-[13px]">MasloMarket</span>
              <span className="text-[8px] uppercase tracking-widest mt-0.5 font-black">
                ПОДБОР <span className="shimmer-ai">AI</span>
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-1 shrink-0">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsSupportModalOpen(true)}
              className="p-2 text-zinc-400 hover:text-blue-600 transition-colors"
              title="Поддержка"
            >
              <MessageSquare size={20} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsFAQModalOpen(true)}
              className="p-2 text-zinc-400 hover:text-blue-600 transition-colors"
              title="Часто задаваемые вопросы"
            >
              <HelpCircle size={20} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsHowItWorksOpen(true)}
              className="p-2 text-zinc-400 hover:text-blue-600 transition-colors"
              title="Как это работает"
            >
              <Info size={20} />
            </motion.button>

            {activeSearches.length > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-pink-600/30 border border-purple-500/40 rounded-full ml-1 shadow-[0_0_12px_rgba(168,85,247,0.35)]"
              >
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                  ИИ Поиск...
                </span>
              </motion.div>
            )}

            {userProfile ? (
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsUserMenuOpen(true)}
                className="flex items-center gap-2 p-1.5 pl-2 pr-3 bg-gradient-to-r from-zinc-900/80 via-zinc-900/60 to-zinc-800/80 hover:from-zinc-800 hover:to-zinc-700/80 border border-white/10 hover:border-blue-500/30 rounded-full transition-all group ml-1 shadow-md hover:shadow-blue-500/10"
              >
                <div className={cn("relative shrink-0 rounded-full p-0.5", isPromoActive ? "pro-avatar-border" : "bg-zinc-800 border border-white/10")}>
                  <img 
                    src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.nickname}`} 
                    alt="Profile" 
                    className="w-7 h-7 rounded-full object-cover shadow-sm bg-zinc-900"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#000002] rounded-full" />
                </div>
                <div className="flex flex-col items-start leading-none pr-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-zinc-100 group-hover:text-blue-400 transition-colors max-w-[80px] sm:max-w-[120px] truncate">
                      {userProfile.nickname}
                    </span>
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-wider mt-0.5 px-1 py-0.2 rounded-sm",
                    userProfile.role === 'admin' 
                      ? "text-amber-400 bg-amber-400/10" 
                      : isPromoActive 
                        ? "text-purple-400 bg-purple-400/10" 
                        : "text-zinc-400 bg-zinc-800"
                  )}>
                    {userProfile.role === 'admin' ? 'Admin' : isPromoActive ? 'Pro' : 'User'}
                  </span>
                </div>
                <ChevronDown size={12} className="text-zinc-500 group-hover:text-zinc-300 transition-colors ml-0.5" />
              </motion.button>
            ) : null}
          </div>
        </div>
      </motion.header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-8">
        <div className={cn("w-full mx-auto", location.pathname === '/dashboard' ? "max-w-none" : "max-w-md")}>
          <Outlet />
          
          <footer className="mt-12 mb-24 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Конфиденциально и защищено M.A.R.A.T Guard</span>
            </div>
            <p className="text-[10px] text-zinc-500 max-w-[280px] leading-relaxed">
              Проверка идет по official базе данных MasloMarket.
              <br />
              &copy; {new Date().getFullYear()} MasloMarket. Все права защищены.
            </p>
          </footer>
        </div>
      </main>

      <motion.nav 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-6 left-0 right-0 z-50 px-4 pb-safe pointer-events-none"
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="flex h-16 items-center justify-around px-2 liquid-glass-heavy rounded-full nav-shadow border border-white/10">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center w-16 h-full gap-1 text-[10px] font-medium transition-all duration-200 relative",
                    isActive 
                      ? "text-blue-400 scale-105" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <motion.div
                    animate={isActive ? { y: -2 } : { y: 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>
                  <span>{item.label}</span>
                  
                  {item.path === '/history' && activeSearches.length > 0 && (
                    <div className="absolute top-2 right-3 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                  )}
                  
                  {item.path === '/history' && history.some(h => h.isNew) && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#000002]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
