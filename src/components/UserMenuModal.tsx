import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { 
  X, LogOut, Gift, User, ShieldCheck, AlertCircle, Crown, Sparkles, 
  History, Heart, LayoutDashboard, Copy, Check, Zap, ChevronRight, Clock, Shield, Loader2, Target
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface UserMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPromo: () => void;
  onOpenQuests: () => void;
}

export default function UserMenuModal({ isOpen, onClose, onOpenPromo, onOpenQuests }: UserMenuModalProps) {
  const navigate = useNavigate();
  const { userProfile, setUserProfile, activePromoCode, setActivePromoCode, history, favorites, getSearchStatus } = useAppStore();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowConfirmLogout(false);
      setIsLoggingOut(false);
      document.body.style.overflow = '';
    } else {
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPromoActive = Boolean(activePromoCode && activePromoCode.expiresAt > Date.now());
  const isStaff = userProfile?.role === 'admin' || 
                  userProfile?.role === 'moderator' || 
                  userProfile?.email?.toLowerCase() === 'minerpc2002@gmail.com';

  const { remainingAttempts, totalAttempts } = getSearchStatus();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Signout error:', err);
    } finally {
      setUserProfile(null);
      setActivePromoCode(null);
      localStorage.removeItem('googleAuthRedirectStarted');
      sessionStorage.removeItem('googleAuthRedirectStarted');
      onClose();
      window.location.reload();
    }
  };

  const copyUid = () => {
    if (userProfile?.uid) {
      navigator.clipboard.writeText(userProfile.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  // Format promo expiry if active
  const formatPromoExpiry = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 overflow-hidden cursor-pointer touch-none"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-sm my-auto cursor-default max-h-[90vh] flex flex-col touch-none"
      >
        <Card className="border border-white/10 shadow-2xl relative overflow-hidden max-h-[88vh] sm:max-h-[90vh] liquid-glass-heavy rounded-3xl flex flex-col touch-none">
          {/* Ambient Background Lights */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-3.5 top-3.5 p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all z-50 cursor-pointer"
            title="Закрыть"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>

          <CardHeader className="pb-2 pt-5 sm:pt-6 text-center relative z-10 shrink-0">
            {/* Avatar section with status ring */}
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-2 sm:mb-3">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full blur-md opacity-30" />
              <div className={cn(
                "relative w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full p-0.5",
                userProfile?.role === 'admin' 
                  ? "bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500" 
                  : isPromoActive 
                    ? "bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400"
                    : "bg-gradient-to-tr from-blue-500 to-indigo-500"
              )}>
                <img 
                  src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.nickname || 'User'}`} 
                  alt="Profile" 
                  className="w-full h-full rounded-full object-cover bg-zinc-900 border-2 border-zinc-950 shadow-xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-zinc-950 rounded-full shadow-lg" />
              </div>
            </div>

            {/* Nickname & Role Badge */}
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                {userProfile?.nickname || 'Пользователь'}
              </CardTitle>
              
              {userProfile?.role === 'admin' ? (
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase rounded-full flex items-center gap-1 shadow-sm">
                  <Crown size={10} className="text-amber-400" /> Admin
                </span>
              ) : isPromoActive ? (
                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles size={10} className="text-purple-400" /> PRO
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 text-[10px] font-semibold uppercase rounded-full">
                  User
                </span>
              )}
            </div>

            <CardDescription className="text-zinc-400 text-xs truncate max-w-[220px] mx-auto mt-0.5">
              {userProfile?.email}
            </CardDescription>

            {/* Quick UID & Copy */}
            {userProfile?.uid && (
              <button 
                onClick={copyUid}
                className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-zinc-400 font-mono transition-colors mx-auto border border-white/5"
              >
                <span>ID: {userProfile.uid.slice(0, 8)}...</span>
                {copiedUid ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            )}
          </CardHeader>

          <CardContent className="space-y-3 sm:space-y-4 pt-1 pb-4 relative z-10">
            {/* User Activity Stats Bar */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-zinc-900/60 border border-white/5 rounded-2xl text-center">
              <button 
                onClick={() => handleNavigate('/history')}
                className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-1 text-zinc-400 group-hover:text-blue-400 transition-colors">
                  <History size={13} />
                  <span className="text-xs font-bold text-white">{history.length}</span>
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5">История</span>
              </button>

              <button 
                onClick={() => handleNavigate('/favorites')}
                className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-white/5 transition-colors group border-x border-white/5"
              >
                <div className="flex items-center gap-1 text-zinc-400 group-hover:text-pink-400 transition-colors">
                  <Heart size={13} />
                  <span className="text-xs font-bold text-white">{favorites.length}</span>
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5">Избранное</span>
              </button>

              <button 
                onClick={onOpenPromo}
                className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-1 text-amber-400 group-hover:text-amber-300 transition-colors">
                  <Zap size={13} />
                  <span className="text-xs font-bold text-white">
                    {isPromoActive ? '∞' : `${remainingAttempts}/${totalAttempts}`}
                  </span>
                </div>
                <span className="text-[9px] text-zinc-500 mt-0.5">Лимиты ИИ</span>
              </button>
            </div>

            {/* Promo Code Status Widget */}
            {isPromoActive && activePromoCode && (
              <div className="p-2.5 sm:p-3 bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-indigo-950/40 border border-purple-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-xl text-purple-300">
                    <Gift size={16} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-purple-200">
                      Промокод: {activePromoCode.code}
                    </span>
                    <span className="text-[10px] text-purple-300/80 flex items-center gap-1">
                      <Clock size={10} /> До {formatPromoExpiry(activePromoCode.expiresAt)}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => { onClose(); onOpenPromo(); }}
                  className="px-2.5 py-1 text-[10px] font-bold text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg transition-colors"
                >
                  Инфо
                </button>
              </div>
            )}

            {/* Menu Actions */}
            <div className="space-y-1.5">
              {isStaff && (
                <Button 
                  variant="ghost" 
                  className="w-full justify-between h-10 sm:h-11 px-3 rounded-xl hover:bg-amber-500/10 text-amber-300 border border-amber-500/20 transition-all"
                  onClick={() => handleNavigate('/dashboard')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                      <LayoutDashboard size={16} />
                    </div>
                    <span className="text-xs font-bold">Панель управления (Admin)</span>
                  </div>
                  <ChevronRight size={14} className="opacity-60" />
                </Button>
              )}

              <Button 
                variant="ghost" 
                className="w-full justify-between h-10 sm:h-11 px-3 rounded-xl hover:bg-white/5 text-zinc-200 transition-all"
                onClick={() => {
                  onClose();
                  onOpenQuests();
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                    <Target size={16} />
                  </div>
                  <span className="text-xs font-bold">Задания и награды</span>
                </div>
                <ChevronRight size={14} className="opacity-60" />
              </Button>

              <Button 
                variant="ghost" 
                className="w-full justify-between h-10 sm:h-11 px-3 rounded-xl hover:bg-white/5 text-zinc-200 transition-all"
                onClick={() => {
                  onClose();
                  onOpenPromo();
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                    <Gift size={16} />
                  </div>
                  <span className="text-xs font-medium">Активировать промокод</span>
                </div>
                <ChevronRight size={14} className="opacity-40" />
              </Button>

              <Button 
                variant="ghost" 
                disabled={isLoggingOut}
                className="w-full justify-between h-10 sm:h-11 px-3 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all mt-1 disabled:opacity-50"
                onClick={handleLogout}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-red-500/20 rounded-lg text-red-400">
                    {isLoggingOut ? <Loader2 size={16} className="animate-spin text-red-400" /> : <LogOut size={16} />}
                  </div>
                  <span className="text-xs font-semibold">
                    {isLoggingOut ? 'Выход из аккаунта...' : 'Выйти из аккаунта'}
                  </span>
                </div>
                <ChevronRight size={14} className="opacity-40" />
              </Button>
            </div>

            {/* Footer Security Badge */}
            <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-500 border-t border-white/5">
              <div className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>M.A.R.A.T Guard Protected</span>
              </div>
              <span className="font-mono text-[9px] text-zinc-600">v 1.0</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

