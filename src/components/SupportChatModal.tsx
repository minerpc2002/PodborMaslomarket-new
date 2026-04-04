import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Loader2, ShieldAlert, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

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

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportChatModal({ isOpen, onClose }: SupportChatModalProps) {
  const { userProfile, isAuthReady } = useAppStore();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<SupportChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isBanned = userProfile?.supportBan && userProfile.supportBan.expiresAt > Date.now();
  const banTimeLeft = isBanned ? Math.ceil((userProfile!.supportBan!.expiresAt - Date.now()) / (60 * 1000)) : 0;
  const banHours = Math.floor(banTimeLeft / 60);
  const banMinutes = banTimeLeft % 60;

  useEffect(() => {
    if (!isOpen || !userProfile) return;

    // Clean up old messages (only if chat is closed and closedAt is > 24h ago)
    const cleanupOldMessages = async () => {
      try {
        const chatDoc = await getDocs(query(collection(db, 'support_chats'), where('userId', '==', userProfile.uid)));
        if (chatDoc.empty) return;
        
        const chatData = chatDoc.docs[0].data() as SupportChat;
        if (chatData.status === 'closed' && chatData.closedAt) {
          const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
          if (chatData.closedAt < twentyFourHoursAgo) {
            console.log('Cleaning up closed chat messages for user:', userProfile.uid);
            // Delete all messages
            const q = query(collection(db, 'support_messages'), where('userId', '==', userProfile.uid));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            // Delete chat status doc
            await deleteDoc(chatDoc.docs[0].ref);
          }
        }
      } catch (err) {
        console.error('Error cleaning up messages:', err);
      }
    };
    cleanupOldMessages();

    // Listen to chat status
    const chatUnsubscribe = onSnapshot(doc(db, 'support_chats', userProfile.uid), (snapshot) => {
      if (snapshot.exists()) {
        setChatStatus(snapshot.data() as SupportChat);
      } else {
        setChatStatus(null);
      }
    });

    // Listen to messages
    const q = query(
      collection(db, 'support_messages'),
      where('userId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportMessage[];
      
      // Sort client-side
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => {
      unsubscribe();
      chatUnsubscribe();
    };
  }, [isOpen, userProfile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile || isBanned) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      
      // Ensure chat is open
      await setDoc(doc(db, 'support_chats', userProfile.uid), {
        userId: userProfile.uid,
        status: 'open',
        lastMessageAt: timestamp
      }, { merge: true });

      await addDoc(collection(db, 'support_messages'), {
        userId: userProfile.uid,
        senderId: userProfile.uid,
        text: newMessage.trim(),
        isAdmin: false,
        timestamp
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md h-[92vh] sm:h-auto"
      >
        <Card className="border-none shadow-2xl liquid-glass-heavy overflow-hidden flex flex-col h-full sm:h-[600px] sm:rounded-3xl rounded-t-[2.5rem] sm:rounded-b-3xl relative">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full sm:hidden" />
          
          <CardHeader className="bg-blue-600/20 border-b border-white/10 pb-4 pt-8 px-6 relative shrink-0">
            <button 
              onClick={onClose}
              className="absolute right-4 top-6 p-2 text-zinc-400 hover:text-white rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10"
            >
              <X size={20} />
            </button>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="text-blue-400" />
              Поддержка
              {chatStatus?.status === 'closed' && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 uppercase font-black">
                  Закрыт
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-1 pr-8">
              {chatStatus?.status === 'closed' 
                ? 'Чат закрыт администратором. История будет удалена через 24 часа.' 
                : 'Задайте вопрос, и мы ответим вам в ближайшее время. История чата хранится 24 часа после закрытия.'}
            </p>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar overscroll-contain">
            {isBanned ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 py-10 px-6">
                <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 text-red-400">
                  <ShieldAlert size={48} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-zinc-100">Доступ ограничен</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Вы временно заблокированы в чате поддержки.<br/>
                    <span className="text-red-400/80">Причина: {userProfile?.supportBan?.reason}</span>
                  </p>
                  <div className="flex items-center justify-center gap-2 text-amber-400 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 mt-4">
                    <Clock size={16} />
                    <span className="text-sm font-bold">
                      Осталось: {banHours > 0 ? `${banHours}ч ` : ''}{banMinutes}м
                    </span>
                  </div>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2 py-10">
                <MessageSquare size={48} className="opacity-20" />
                <p className="text-sm text-center">Нет сообщений.<br/>Напишите нам, если у вас возникли проблемы.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isAdminMsg = msg.isAdmin;
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isAdminMsg ? 'items-start' : 'items-end'}`}>
                    <div 
                      className={`max-w-[85%] p-3 px-4 rounded-2xl ${
                        isAdminMsg 
                          ? 'bg-purple-600 text-white rounded-bl-sm shadow-lg shadow-purple-500/20' 
                          : 'bg-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-500/20'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 px-1 opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isAdminMsg && ' • Администратор'}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 sm:p-6 bg-black/40 border-t border-white/10 shrink-0 pb-safe mb-2 sm:mb-0">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={isBanned ? "Чат заблокирован" : "Сообщение..."}
                className="flex-1 bg-zinc-900/50 border-white/10 focus-visible:ring-blue-500 rounded-xl h-11"
                disabled={loading || isBanned}
              />
              <Button 
                type="submit" 
                disabled={!newMessage.trim() || loading || isBanned}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 h-11 w-11 sm:w-auto shrink-0"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </Button>
            </form>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
