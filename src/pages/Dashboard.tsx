import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { collection, getDocs, doc, updateDoc, setDoc, query, orderBy, deleteDoc, getDoc, onSnapshot, addDoc, where } from 'firebase/firestore';
import { UserProfile, PromoCode, UserRole } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Ticket, Plus, Trash2, Shield, ShieldAlert, ShieldCheck, Loader2, User, Search, Crown, Cpu, Power, MessageSquare, Send, Activity, X, Sparkles, ChevronUp, ChevronDown, Check, X as XIcon } from 'lucide-react';
import UserAdminModal from '../components/UserAdminModal';
import { auth, db } from '../firebase';

interface SupportMessage {
  id: string;
  userId: string;
  senderId: string;
  text: string;
  isAdmin: boolean;
  timestamp: number;
}

interface SupportChat {
  userId: string;
  status: 'open' | 'closed';
  closedAt?: number;
  lastMessageAt?: number;
}

import { cn } from '../lib/utils';

export default function Dashboard() {
  const { userProfile, aiModelsConfig, setAiModelsConfig, isSnowfallEnabled, setIsSnowfallEnabled } = useAppStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Support Ban State
  const [banUserId, setBanUserId] = useState<string | null>(null);
  const [banHours, setBanHours] = useState('1');
  const [banMinutes, setBanMinutes] = useState('0');
  const [banReason, setBanReason] = useState('Нарушение правил общения');

  // User list state
  const [userFilter, setUserFilter] = useState<'all' | 'admin' | 'moderator' | 'pro' | 'user'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Promo code form state
  const [newCode, setNewCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [maxAttempts, setMaxAttempts] = useState('10');

  // AI Settings state
  const [isAiSearchEnabled, setIsAiSearchEnabled] = useState(true);
  const [aiLoad, setAiLoad] = useState(0);
  const [aiUsage, setAiUsage] = useState<Record<string, any>>({});
  const [isResettingQuotas, setIsResettingQuotas] = useState(false);

  // Support Chat State
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportChats, setSupportChats] = useState<Record<string, SupportChat>>({});
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [adminReply, setAdminReply] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.email?.toLowerCase() === 'minerpc2002@gmail.com';
  const isStaff = isAdmin || userProfile?.role === 'moderator' || auth.currentUser?.email?.toLowerCase() === 'minerpc2002@gmail.com';

  useEffect(() => {
    if (userProfile || auth.currentUser) {
      fetchData();
    }
  }, [userProfile, auth.currentUser]);

  const fetchData = async () => {
    // Re-calculate isStaff inside fetchData to be sure
    const currentIsStaff = userProfile?.role === 'admin' || 
                          userProfile?.role === 'moderator' || 
                          auth.currentUser?.email?.toLowerCase() === 'minerpc2002@gmail.com';
    
    if (!currentIsStaff) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching dashboard data...');
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersList.sort((a, b) => b.createdAt - a.createdAt));

      const promoSnap = await getDocs(query(collection(db, 'promocodes'), orderBy('createdAt', 'desc')));
      const promoList = promoSnap.docs.map(doc => doc.data() as PromoCode);
      setPromoCodes(promoList);
      console.log(`Fetched ${usersList.length} users and ${promoList.length} promo codes.`);

      // Fetch AI Settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'ai_config'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setIsAiSearchEnabled(data.isAiSearchEnabled ?? true);
        setIsSnowfallEnabled(data.isSnowfallEnabled ?? false);
        if (data.aiModelsConfig) {
          setAiModelsConfig(data.aiModelsConfig);
        }
      } else {
        // Create default settings if not exists
        const defaultConfig = useAppStore.getState().aiModelsConfig;
        await setDoc(doc(db, 'settings', 'ai_config'), {
          isAiSearchEnabled: true,
          isSnowfallEnabled: false,
          aiModelsConfig: defaultConfig,
          updatedAt: Date.now(),
          updatedBy: userProfile?.uid || 'system'
        });
      }

      // Simulate AI load
      setAiLoad(Math.floor(Math.random() * 40) + 10); // Random load between 10-50%

      // Listen to AI Usage
      const usageUnsubscribe = onSnapshot(doc(db, 'settings', 'ai_usage'), (doc) => {
        if (doc.exists()) {
          setAiUsage(doc.data());
        }
      });

      return () => {
        usageUnsubscribe();
      };
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isStaff) return;

    // Clean up old messages (only if chat is closed and closedAt is > 24h ago)
    const cleanupOldMessages = async () => {
      try {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        
        // Find closed chats that were closed more than 24h ago
        const closedChatsQuery = query(
          collection(db, 'support_chats'),
          where('status', '==', 'closed'),
          where('closedAt', '<', twentyFourHoursAgo)
        );
        const closedChatsSnap = await getDocs(closedChatsQuery);
        
        for (const chatDoc of closedChatsSnap.docs) {
          const userId = chatDoc.id;
          console.log('Cleaning up expired support chat for user:', userId);
          
          // Delete all messages for this user
          const msgsQuery = query(collection(db, 'support_messages'), where('userId', '==', userId));
          const msgsSnap = await getDocs(msgsQuery);
          const deleteMsgsPromises = msgsSnap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deleteMsgsPromises);
          
          // Delete the chat status doc
          await deleteDoc(chatDoc.ref);
        }
      } catch (err) {
        console.error('Error cleaning up messages:', err);
      }
    };
    cleanupOldMessages();

    // Listen to all support messages
    const q = query(collection(db, 'support_messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportMessage[];
      setSupportMessages(msgs);
    });

    // Listen to all support chats
    const chatsUnsubscribe = onSnapshot(collection(db, 'support_chats'), (snapshot) => {
      const chats: Record<string, SupportChat> = {};
      snapshot.docs.forEach(doc => {
        chats[doc.id] = doc.data() as SupportChat;
      });
      setSupportChats(chats);
    });

    return () => {
      unsubscribe();
      chatsUnsubscribe();
    };
  }, [isStaff]);

  const handleToggleSnowfall = async () => {
    if (!isAdmin) return;
    setActionLoading('toggle-snow');
    try {
      const newValue = !isSnowfallEnabled;
      await setDoc(doc(db, 'settings', 'ai_config'), {
        isSnowfallEnabled: newValue,
        updatedAt: Date.now(),
        updatedBy: userProfile?.uid
      }, { merge: true });
      setIsSnowfallEnabled(newValue);
    } catch (err) {
      console.error('Error toggling snowfall:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteChat = async (userId: string) => {
    if (!isAdmin) return;
    
    setActionLoading('delete-chat');
    try {
      console.log('Deleting chat for user:', userId);
      // Delete messages
      const msgsQuery = query(collection(db, 'support_messages'), where('userId', '==', userId));
      const msgsSnap = await getDocs(msgsQuery);
      console.log(`Found ${msgsSnap.size} messages to delete`);
      
      const deleteMsgsPromises = msgsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteMsgsPromises);
      
      // Delete chat status
      await deleteDoc(doc(db, 'support_chats', userId));
      console.log('Chat status deleted');
      
      if (activeChatUserId === userId) {
        setActiveChatUserId(null);
      }
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting chat:', err);
      alert('Ошибка при удалении чата. Проверьте консоль.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async () => {
    if (!isAdmin || !banUserId) return;
    
    setActionLoading('ban-user');
    try {
      const durationMs = (parseInt(banHours) * 60 + parseInt(banMinutes)) * 60 * 1000;
      const expiresAt = Date.now() + durationMs;
      
      await updateDoc(doc(db, 'users', banUserId), {
        supportBan: {
          expiresAt,
          reason: banReason,
          bannedAt: Date.now()
        }
      });
      
      // Update local state
      setUsers(users.map(u => u.uid === banUserId ? { 
        ...u, 
        supportBan: { expiresAt, reason: banReason, bannedAt: Date.now() } 
      } : u));
      
      setBanUserId(null);
    } catch (err) {
      console.error('Error banning user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbanUser = async (uid: string) => {
    if (!isAdmin) return;
    setActionLoading(`unban-${uid}`);
    try {
      await updateDoc(doc(db, 'users', uid), {
        supportBan: null
      });
      setUsers(users.map(u => u.uid === uid ? { ...u, supportBan: null } : u));
    } catch (err) {
      console.error('Error unbanning user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAiSearch = async () => {
    if (!isAdmin) return;
    setActionLoading('toggle-ai');
    try {
      const newValue = !isAiSearchEnabled;
      await setDoc(doc(db, 'settings', 'ai_config'), {
        isAiSearchEnabled: newValue,
        updatedAt: Date.now(),
        updatedBy: userProfile?.uid
      }, { merge: true });
      setIsAiSearchEnabled(newValue);
    } catch (err) {
      console.error('Error toggling AI search:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAiModel = async (modelId: string) => {
    if (!isAdmin) return;
    setActionLoading(`toggle-model-${modelId}`);
    try {
      const updatedModels = aiModelsConfig.map(m => 
        m.id === modelId ? { ...m, enabled: !m.enabled } : m
      );
      
      await setDoc(doc(db, 'settings', 'ai_config'), {
        aiModelsConfig: updatedModels,
        updatedAt: Date.now(),
        updatedBy: userProfile?.uid
      }, { merge: true });
      
      setAiModelsConfig(updatedModels);
    } catch (err) {
      console.error('Error toggling AI model:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoveAiModel = async (modelId: string, direction: 'up' | 'down') => {
    if (!isAdmin) return;
    setActionLoading(`move-model-${modelId}`);
    try {
      const index = aiModelsConfig.findIndex(m => m.id === modelId);
      if (index < 0) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === aiModelsConfig.length - 1) return;

      const newModels = [...aiModelsConfig].sort((a, b) => a.priority - b.priority);
      const currentIndex = newModels.findIndex(m => m.id === modelId);
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Swap priorities
      const tempPriority = newModels[currentIndex].priority;
      newModels[currentIndex].priority = newModels[swapIndex].priority;
      newModels[swapIndex].priority = tempPriority;

      // Re-sort
      newModels.sort((a, b) => a.priority - b.priority);

      await setDoc(doc(db, 'settings', 'ai_config'), {
        aiModelsConfig: newModels,
        updatedAt: Date.now(),
        updatedBy: userProfile?.uid
      }, { merge: true });
      
      setAiModelsConfig(newModels);
    } catch (err) {
      console.error('Error moving AI model:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetQuotas = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Вы уверены, что хотите сбросить все счетчики использования ИИ?')) return;
    
    setIsResettingQuotas(true);
    try {
      await setDoc(doc(db, 'settings', 'ai_usage'), {
        last_reset: Date.now(),
        reset_by: userProfile?.uid || 'admin'
      });
      setAiUsage({});
    } catch (err) {
      console.error('Error resetting quotas:', err);
    } finally {
      setIsResettingQuotas(false);
    }
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    if (!isAdmin) return;
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(result);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optional: show a small toast
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !userProfile) return;
    
    setActionLoading('create-promo');
    try {
      const code = newCode.trim().toUpperCase();
      const expiresAt = Date.now() + (parseInt(expiresInDays) * 24 * 60 * 60 * 1000);
      
      const promo: PromoCode = {
        code,
        expiresAt,
        maxAttempts: parseInt(maxAttempts),
        createdBy: userProfile.uid,
        createdAt: Date.now()
      };

      console.log('Creating promo:', promo);
      await setDoc(doc(db, 'promocodes', code), promo);
      setPromoCodes(prev => [promo, ...prev.filter(p => p.code !== code)]);
      setNewCode('');
    } catch (err) {
      console.error('Error creating promo code:', err);
      alert('Ошибка при создании промокода. Проверьте права доступа или соединение.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePromo = async (code: string) => {
    if (!isAdmin) return;
    setActionLoading(code);
    try {
      await deleteDoc(doc(db, 'promocodes', code));
      setPromoCodes(promoCodes.filter(p => p.code !== code));
    } catch (err) {
      console.error('Error deleting promo code:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateUser = (updatedUser: UserProfile) => {
    setUsers(users.map(u => u.uid === updatedUser.uid ? updatedUser : u));
    setSelectedUser(updatedUser);
  };

  const filteredUsers = users.filter(user => {
    // Filter by role/status
    if (userFilter === 'admin' && user.role !== 'admin') return false;
    if (userFilter === 'moderator' && user.role !== 'moderator') return false;
    if (userFilter === 'user' && user.role !== 'user') return false;
    if (userFilter === 'pro') {
      const isPro = user.activePromoCode && user.activePromoCode.expiresAt > Date.now();
      if (!isPro) return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return user.nickname.toLowerCase().includes(query) || 
             user.email.toLowerCase().includes(query) ||
             user.uid.toLowerCase().includes(query);
    }

    return true;
  });

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReply.trim() || !activeChatUserId || !userProfile) return;

    setActionLoading('reply');
    try {
      const timestamp = Date.now();
      
      // Ensure chat is open when admin replies
      await setDoc(doc(db, 'support_chats', activeChatUserId), {
        userId: activeChatUserId,
        status: 'open',
        lastMessageAt: timestamp
      }, { merge: true });

      await addDoc(collection(db, 'support_messages'), {
        userId: activeChatUserId,
        senderId: userProfile.uid,
        text: adminReply.trim(),
        isAdmin: true,
        timestamp
      });
      setAdminReply('');
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseChat = async (userId: string) => {
    if (!isStaff) return;
    setActionLoading('close-chat');
    try {
      await setDoc(doc(db, 'support_chats', userId), {
        status: 'closed',
        closedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error('Error closing chat:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Group messages by user
  const chatsByUser = supportMessages.reduce((acc, msg) => {
    if (!acc[msg.userId]) {
      acc[msg.userId] = [];
    }
    acc[msg.userId].push(msg);
    return acc;
  }, {} as Record<string, SupportMessage[]>);

  const activeChatMessages = activeChatUserId ? chatsByUser[activeChatUserId] || [] : [];

  useEffect(() => {
    if (activeChatUserId) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeChatMessages, activeChatUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Личный кабинет</h1>
          <p className="text-zinc-400 mt-1">Управление профилем и системными настройками</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/10 rounded-2xl border border-blue-500/20 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-semibold uppercase tracking-wider text-blue-400">{userProfile?.role}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-zinc-900/40 p-1 border border-white/5 backdrop-blur-xl rounded-2xl flex w-full sm:w-auto overflow-x-auto no-scrollbar justify-start">
          <TabsTrigger value="profile" className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all whitespace-nowrap">
            <User size={18} />
            <span>Профиль</span>
          </TabsTrigger>
          {isStaff && (
            <>
              <TabsTrigger value="users" className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all whitespace-nowrap">
                <Users size={18} />
                <span>Пользователи ({users.length})</span>
              </TabsTrigger>
              <TabsTrigger value="promo" className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all whitespace-nowrap">
                <Ticket size={18} />
                <span>Промокоды</span>
              </TabsTrigger>
                          <TabsTrigger value="support" className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all whitespace-nowrap relative">
                <MessageSquare size={18} />
                <span>Поддержка</span>
                {Object.values(supportChats).some((c: SupportChat) => c.status === 'open') && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="ai_settings" className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all whitespace-nowrap">
                  <Cpu size={18} />
                  <span>Настройки ИИ</span>
                </TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card className="liquid-glass border-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ваш профиль</CardTitle>
                <CardDescription>Основная информация о вашем аккаунте</CardDescription>
              </div>
            </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Никнейм</p>
                      <p className="text-lg font-bold text-zinc-100">{userProfile?.nickname}</p>
                    </div>
                    <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Email</p>
                      <p className="text-lg font-bold text-zinc-100 truncate" title={userProfile?.email}>{userProfile?.email}</p>
                    </div>
                    <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Роль</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-zinc-100 capitalize">{userProfile?.role}</p>
                        {userProfile?.email?.toLowerCase() === 'minerpc2002@gmail.com' && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase rounded-lg border border-amber-500/30">
                            Владелец
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Регистрация</p>
                      <p className="text-lg font-bold text-zinc-100">
                        {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
          </Card>
        </TabsContent>

        {isStaff && (
          <>
            <TabsContent value="users">
              <Card className="liquid-glass border-none">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Пользователи системы</CardTitle>
                    <CardDescription>Список всех зарегистрированных пользователей</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchData}
                    className="border-white/10 hover:bg-white/5"
                    disabled={loading}
                  >
                    <Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Обновить
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <Input 
                        placeholder="Поиск по имени, email или ID..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-black/20 border-white/10"
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                      <Button 
                        variant={userFilter === 'all' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setUserFilter('all')}
                        className={userFilter === 'all' ? 'bg-blue-600' : 'border-white/10'}
                      >
                        Все
                      </Button>
                      <Button 
                        variant={userFilter === 'admin' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setUserFilter('admin')}
                        className={userFilter === 'admin' ? 'bg-red-600' : 'border-white/10'}
                      >
                        Админ
                      </Button>
                      <Button 
                        variant={userFilter === 'moderator' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setUserFilter('moderator')}
                        className={userFilter === 'moderator' ? 'bg-blue-600' : 'border-white/10'}
                      >
                        Модератор
                      </Button>
                      <Button 
                        variant={userFilter === 'pro' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setUserFilter('pro')}
                        className={userFilter === 'pro' ? 'bg-amber-600 text-white' : 'border-white/10 text-amber-500'}
                      >
                        PRO User
                      </Button>
                      <Button 
                        variant={userFilter === 'user' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setUserFilter('user')}
                        className={userFilter === 'user' ? 'bg-zinc-600' : 'border-white/10'}
                      >
                        Юзер
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredUsers.map((user) => {
                      const isPro = user.activePromoCode && user.activePromoCode.expiresAt > Date.now();
                      return (
                        <div 
                          key={user.uid} 
                          onClick={() => setSelectedUser(user)}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl border cursor-pointer gap-4 ${isPro ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-white/5'}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn("w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden shrink-0", isPro && "pro-avatar-border")}>
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nickname}`} alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-100 text-base">{user.nickname}</span>
                                {isPro && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase rounded border border-amber-500/30">
                                    <Crown size={10} /> PRO
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-zinc-400">{user.email}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg">
                              {user.role === 'admin' && <ShieldAlert size={14} className="text-red-400" />}
                              {user.role === 'moderator' && <ShieldCheck size={14} className="text-blue-400" />}
                              {user.role === 'user' && <Users size={14} className="text-zinc-400" />}
                              <span className={
                                user.role === 'admin' ? 'text-red-400 text-xs font-bold uppercase tracking-wider' : 
                                user.role === 'moderator' ? 'text-blue-400 text-xs font-bold uppercase tracking-wider' : 'text-zinc-400 text-xs font-bold uppercase tracking-wider'
                              }>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <div className="py-8 text-center text-zinc-500">
                        Пользователи не найдены
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="promo" className="space-y-6">
              <Card className="liquid-glass border-none">
                <CardHeader>
                  <CardTitle>Создать промокод</CardTitle>
                  <CardDescription>Генерация нового промокода для пользователей</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreatePromo} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Код (любой длины)</label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="SUMMER2024" 
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                            className="uppercase font-mono"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={generateRandomCode}
                            className="shrink-0 border-zinc-700 hover:bg-zinc-800"
                            title="Сгенерировать 10-значный код"
                          >
                            Ген.
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Дней действия</label>
                        <Input 
                          type="number" 
                          value={expiresInDays}
                          onChange={(e) => setExpiresInDays(e.target.value)}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Попыток поиска</label>
                        <Input 
                          type="number" 
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(e.target.value)}
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-700 px-8"
                        disabled={actionLoading === 'create-promo'}
                      >
                        {actionLoading === 'create-promo' ? <Loader2 className="animate-spin mr-2" size={18} /> : <Plus size={18} className="mr-2" />}
                        Создать промокод
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="liquid-glass border-none">
                <CardHeader>
                  <CardTitle>Активные промокоды</CardTitle>
                  <CardDescription>Список всех созданных промокодов</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {promoCodes.map((promo) => {
                      const isExpired = promo.expiresAt < Date.now();
                      return (
                        <div key={promo.code} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl border border-white/5 gap-4">
                          <div className="flex flex-col">
                            <button 
                              onClick={() => copyToClipboard(promo.code)}
                              className="font-mono font-bold text-blue-400 text-left hover:underline text-lg tracking-widest"
                              title="Копировать"
                            >
                              {promo.code}
                            </button>
                            <span className="text-xs text-zinc-400 mt-1">Истекает: {new Date(promo.expiresAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                            <div className="flex flex-col items-start sm:items-end bg-black/20 px-3 py-1.5 rounded-lg">
                              <span className="text-xs text-zinc-300 font-medium">Попыток: {promo.maxAttempts}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider mt-1 ${
                                isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                              }`}>
                                {isExpired ? 'Истек' : 'Активен'}
                              </span>
                            </div>
                            {isAdmin && (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 bg-white/5 border border-white/5 shrink-0"
                                onClick={() => handleDeletePromo(promo.code)}
                                disabled={actionLoading === promo.code}
                              >
                                {actionLoading === promo.code ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {promoCodes.length === 0 && (
                      <div className="py-8 text-center text-zinc-500">
                        Промокоды не найдены
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="support" className="space-y-6">
              <Card className="liquid-glass border-none h-[600px] flex flex-col">
                <CardHeader className="pb-4 border-b border-white/5">
                  <CardTitle>Чаты поддержки</CardTitle>
                  <CardDescription>Отвечайте на вопросы пользователей. Чаты удаляются через 24 часа.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex overflow-hidden relative">
                  {/* Chat List */}
                  <div className={`w-full md:w-1/3 border-r border-white/5 overflow-y-auto custom-scrollbar ${activeChatUserId ? 'hidden md:block' : 'block'}`}>
                    {Object.keys(chatsByUser).length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-sm">
                        Нет активных чатов
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {Object.entries(chatsByUser).map(([userId, msgs]) => {
                          const lastMsg = (msgs as SupportMessage[])[(msgs as SupportMessage[]).length - 1];
                          const user = users.find(u => u.uid === userId);
                          const nickname = user?.nickname || 'Неизвестный пользователь';
                          const isPro = user?.role === 'pro' || (user?.activePromoCode && user.activePromoCode.expiresAt > Date.now());
                          const chat = supportChats[userId];
                          const isClosed = chat?.status === 'closed';
                          
                          return (
                            <button
                              key={userId}
                              onClick={() => setActiveChatUserId(userId)}
                              className={`p-4 text-left border-b border-white/5 hover:bg-white/5 transition-colors ${activeChatUserId === userId ? 'bg-blue-900/20' : ''} ${isClosed ? 'opacity-50' : ''} ${isPro ? 'bg-amber-500/5' : ''}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-sm truncate ${isPro ? 'text-amber-400' : 'text-zinc-200'}`}>{nickname}</span>
                                  {isPro && (
                                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase font-black flex items-center gap-0.5">
                                      <Crown size={8} /> PRO
                                    </span>
                                  )}
                                  {isClosed && (
                                    <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 uppercase font-black">
                                      Закрыт
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-zinc-500 shrink-0">
                                  {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 truncate">
                                {lastMsg.isAdmin ? 'Вы: ' : ''}{lastMsg.text}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Chat Area */}
                  <div className={`flex-1 flex flex-col bg-black/20 ${activeChatUserId ? 'block' : 'hidden md:flex'}`}>
                    {activeChatUserId ? (
                      <>
                        <div className="p-4 border-b border-white/5 bg-zinc-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button 
                              onClick={() => setActiveChatUserId(null)}
                              className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
                            >
                              <ChevronUp className="-rotate-90" size={24} />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${users.find(u => u.uid === activeChatUserId)?.nickname}`} alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                                {users.find(u => u.uid === activeChatUserId)?.nickname || 'Пользователь'}
                                {(users.find(u => u.uid === activeChatUserId)?.role === 'pro' || (users.find(u => u.uid === activeChatUserId)?.activePromoCode && users.find(u => u.uid === activeChatUserId)!.activePromoCode!.expiresAt > Date.now())) && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-black uppercase">PRO</span>
                                )}
                              </h3>
                              <p className="text-xs text-zinc-500">{users.find(u => u.uid === activeChatUserId)?.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            {users.find(u => u.uid === activeChatUserId)?.supportBan ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnbanUser(activeChatUserId)}
                                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                disabled={actionLoading === `unban-${activeChatUserId}`}
                              >
                                {actionLoading === `unban-${activeChatUserId}` ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="mr-2" />}
                                Разбанить
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBanUserId(activeChatUserId)}
                                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                              >
                                <ShieldAlert size={14} className="mr-2" />
                                Забанить
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowDeleteConfirm(activeChatUserId)}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                              disabled={actionLoading === 'delete-chat'}
                            >
                              {actionLoading === 'delete-chat' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} className="mr-2" />}
                              Удалить
                            </Button>

                            {supportChats[activeChatUserId]?.status !== 'closed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCloseChat(activeChatUserId)}
                                className="border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/10"
                                disabled={actionLoading === 'close-chat'}
                              >
                                {actionLoading === 'close-chat' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} className="mr-2" />}
                                Закрыть
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                          {activeChatMessages.map((msg) => {
                            const isAdminMsg = msg.isAdmin;
                            const user = users.find(u => u.uid === msg.userId);
                            const isPro = user?.role === 'pro' || (user?.activePromoCode && user.activePromoCode.expiresAt > Date.now());
                            
                            return (
                              <div key={msg.id} className={`flex flex-col ${isAdminMsg ? 'items-start' : 'items-end'}`}>
                                <div 
                                  className={`max-w-[85%] sm:max-w-[80%] p-3 rounded-2xl ${
                                    isAdminMsg 
                                      ? 'bg-purple-600 text-white rounded-bl-sm shadow-lg shadow-purple-500/20' 
                                      : isPro
                                        ? 'bg-amber-600 text-white rounded-br-sm shadow-lg shadow-amber-500/30 border border-amber-400/30'
                                        : 'bg-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-500/20'
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                </div>
                                <span className="text-[10px] text-zinc-500 mt-1 px-1">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {!isAdminMsg && isPro && <span className="text-amber-500 ml-1 font-bold">PRO</span>}
                                </span>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 bg-zinc-900/80 border-t border-white/5">
                          <form onSubmit={handleAdminReply} className="flex gap-2">
                            <Input
                              value={adminReply}
                              onChange={(e) => setAdminReply(e.target.value)}
                              placeholder="Ответить пользователю..."
                              className="flex-1 bg-zinc-800/50 border-white/10 focus-visible:ring-blue-500 rounded-xl"
                              disabled={actionLoading === 'reply'}
                            />
                            <Button 
                              type="submit" 
                              disabled={!adminReply.trim() || actionLoading === 'reply'}
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4"
                            >
                              {actionLoading === 'reply' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            </Button>
                          </form>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-zinc-500">
                        Выберите чат для ответа
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ai_settings" className="space-y-6">
              <Card className="liquid-glass border-none">
                <CardHeader>
                  <CardTitle>Настройки нейросетей</CardTitle>
                  <CardDescription>Управление доступом к AI и мониторинг нагрузки</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                            <Sparkles size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-zinc-100">Эффект снега</h3>
                            <p className="text-xs text-zinc-400">Падающий снег для всех пользователей</p>
                          </div>
                        </div>
                        <Button
                          variant={isSnowfallEnabled ? 'default' : 'outline'}
                          className={isSnowfallEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/10'}
                          onClick={handleToggleSnowfall}
                          disabled={actionLoading === 'toggle-snow'}
                        >
                          {actionLoading === 'toggle-snow' ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <Power size={18} className="mr-2" />
                              {isSnowfallEnabled ? 'Включено' : 'Отключено'}
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        Активирует визуальный эффект падающего снега на всех страницах приложения для всех пользователей.
                      </p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                            <Cpu size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-zinc-100">OpenRouter AI (Резерв)</h3>
                            <p className="text-xs text-zinc-400">Резервная нейросеть для подбора</p>
                          </div>
                        </div>
                        <Button
                          variant={isAiSearchEnabled ? 'default' : 'outline'}
                          className={isAiSearchEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}
                          onClick={handleToggleAiSearch}
                          disabled={actionLoading === 'toggle-ai'}
                        >
                          {actionLoading === 'toggle-ai' ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <Power size={18} className="mr-2" />
                              {isAiSearchEnabled ? 'Включено' : 'Отключено'}
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        Этот тумблер позволяет отключить использование резервной нейросети (OpenRouter). 
                        Основная нейросеть (Gemini) продолжит работать в приоритетном режиме.
                      </p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                        <Activity size={18} className="text-blue-400" />
                        Текущая загруженность
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Нагрузка на API</span>
                          <span className="font-bold text-zinc-100">{aiLoad}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${aiLoad > 80 ? 'bg-red-500' : aiLoad > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${aiLoad}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500">
                        * Показатели нагрузки обновляются в реальном времени. Высокая нагрузка может привести к задержкам в ответах нейросети.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-zinc-100 flex items-center gap-2 px-1">
                      <Cpu size={18} className="text-purple-400" />
                      Управление моделями Gemini
                    </h3>
                    <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                      <div className="p-4 border-b border-white/5 bg-zinc-900/50">
                        <p className="text-sm text-zinc-400">
                          Настройте порядок использования моделей. Верхняя модель будет использоваться первой. Если она недоступна (лимит или ошибка), запрос перейдет к следующей включенной модели.
                        </p>
                      </div>
                      <div className="divide-y divide-white/5">
                        {[...aiModelsConfig].sort((a, b) => a.priority - b.priority).map((model, index) => (
                          <div key={model.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => handleMoveAiModel(model.id, 'up')}
                                  disabled={index === 0 || actionLoading !== null}
                                  className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                                >
                                  <ChevronUp size={16} />
                                </button>
                                <button 
                                  onClick={() => handleMoveAiModel(model.id, 'down')}
                                  disabled={index === aiModelsConfig.length - 1 || actionLoading !== null}
                                  className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                              <div>
                                <h4 className="font-bold text-zinc-200 flex items-center gap-2">
                                  {model.name}
                                  {index === 0 && model.enabled && (
                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                                      Основная
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-zinc-500 font-mono mt-1">{model.id}</p>
                              </div>
                            </div>
                            <Button
                              variant={model.enabled ? 'default' : 'outline'}
                              size="sm"
                              className={model.enabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}
                              onClick={() => handleToggleAiModel(model.id)}
                              disabled={actionLoading === `toggle-model-${model.id}`}
                            >
                              {actionLoading === `toggle-model-${model.id}` ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : model.enabled ? (
                                <>
                                  <Check size={14} className="mr-1.5" />
                                  Включена
                                </>
                              ) : (
                                <>
                                  <XIcon size={14} className="mr-1.5" />
                                  Отключена
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-zinc-100 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-400" />
                        Квоты и лимиты моделей
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleResetQuotas}
                        disabled={isResettingQuotas}
                        className="text-[10px] h-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        {isResettingQuotas ? <Loader2 size={12} className="animate-spin mr-1" /> : <Trash2 size={12} className="mr-1" />}
                        Сбросить
                      </Button>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { 
                          name: 'Gemini 3.1 Pro', 
                          key: 'gemini_3_1_pro_preview_usage', 
                          limit: 50, 
                          color: 'purple',
                          desc: 'Умная модель (Анализ)'
                        },
                        { 
                          name: 'Gemini 3.1 Flash', 
                          key: 'gemini_3_1_flash_preview_usage', 
                          limit: 1500, 
                          color: 'blue',
                          desc: 'Основная модель (Быстрая)'
                        },
                        { 
                          name: 'Gemini 3.1 Flash Lite', 
                          key: 'gemini_3_1_flash_lite_preview_usage', 
                          limit: 1500, 
                          color: 'emerald',
                          desc: 'Легкая модель'
                        },
                        { 
                          name: 'Gemini 3.0 Flash', 
                          key: 'gemini_3_flash_preview_usage', 
                          limit: 1500, 
                          color: 'cyan',
                          desc: 'Базовая модель'
                        },
                        { 
                          name: 'Gemini 2.5 Flash', 
                          key: 'gemini_2_5_flash_usage', 
                          limit: 1500, 
                          color: 'amber',
                          desc: 'Резервная модель'
                        }
                      ].map((model) => {
                        const usage = aiUsage[model.key] || 0;
                        const remaining = Math.max(0, model.limit - usage);
                        const percent = Math.min(100, (usage / model.limit) * 100);
                        
                        return (
                          <div key={model.name} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-sm text-zinc-100">{model.name}</h4>
                                <p className="text-[10px] text-zinc-500">{model.desc}</p>
                              </div>
                              <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold bg-${model.color}-500/20 text-${model.color}-400`}>
                                {remaining} ост.
                              </div>
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500">Использовано: {usage}</span>
                                <span className="text-zinc-400">{Math.round(percent)}%</span>
                              </div>
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full bg-${model.color}-500 transition-all duration-1000`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-500 px-1 italic">
                      * Квоты указаны ориентировочно для текущего расчетного периода. При достижении лимита модель может быть временно недоступна.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      {selectedUser && (
        <UserAdminModal
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdateUser={handleUpdateUser}
          isAdmin={isAdmin}
        />
      )}
      {/* Ban Modal */}
      {banUserId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-100">Заблокировать поддержку</h3>
              <button onClick={() => setBanUserId(null)} className="text-zinc-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Причина блокировки</label>
                <Input 
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Напр: Спам, нецензурная лексика..."
                  className="bg-zinc-800/50 border-white/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Часов</label>
                  <Input 
                    type="number"
                    value={banHours}
                    onChange={(e) => setBanHours(e.target.value)}
                    min="0"
                    className="bg-zinc-800/50 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Минут</label>
                  <Input 
                    type="number"
                    value={banMinutes}
                    onChange={(e) => setBanMinutes(e.target.value)}
                    min="0"
                    max="59"
                    className="bg-zinc-800/50 border-white/10"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500 italic">
                Пользователь не сможет отправлять сообщения в поддержку в течение указанного времени.
              </p>
            </div>
            <div className="p-6 bg-zinc-900/50 border-t border-white/5 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 border-white/10"
                onClick={() => setBanUserId(null)}
              >
                Отмена
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleBanUser}
                disabled={actionLoading === 'ban-user'}
              >
                {actionLoading === 'ban-user' ? <Loader2 size={18} className="animate-spin" /> : 'Заблокировать'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-100">Удалить чат?</h3>
              <p className="text-sm text-zinc-400">
                Это действие полностью удалит всю историю переписки для пользователя и для вас. Это действие необратимо.
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 border-white/10"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={actionLoading === 'delete-chat'}
              >
                Отмена
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDeleteChat(showDeleteConfirm)}
                disabled={actionLoading === 'delete-chat'}
              >
                {actionLoading === 'delete-chat' ? <Loader2 size={18} className="animate-spin" /> : 'Удалить'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
