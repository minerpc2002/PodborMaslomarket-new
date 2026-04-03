import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';

interface SupportMessage {
  id: string;
  userId: string;
  senderId: string;
  text: string;
  isAdmin: boolean;
  timestamp: number;
}

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportChatModal({ isOpen, onClose }: SupportChatModalProps) {
  const { userProfile, isAuthReady } = useAppStore();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !userProfile) return;

    // Clean up old messages (older than 24 hours)
    const cleanupOldMessages = async () => {
      try {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const q = query(
          collection(db, 'support_messages'),
          where('userId', '==', userProfile.uid)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
          if (docSnap.data().timestamp < twentyFourHoursAgo) {
            await deleteDoc(docSnap.ref);
          }
        });
      } catch (err) {
        console.error('Error cleaning up messages:', err);
      }
    };
    cleanupOldMessages();

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

    return () => unsubscribe();
  }, [isOpen, userProfile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'support_messages'), {
        userId: userProfile.uid,
        senderId: userProfile.uid,
        text: newMessage.trim(),
        isAdmin: false,
        timestamp: Date.now()
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl liquid-glass-heavy overflow-hidden flex flex-col h-[80vh] sm:h-[600px]">
          <CardHeader className="bg-blue-600/20 border-b border-white/10 pb-4 relative">
            <button 
              onClick={onClose}
              className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-white rounded-full bg-black/20 hover:bg-black/40 transition-colors"
            >
              <X size={20} />
            </button>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="text-blue-400" />
              Поддержка
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-1">
              Задайте вопрос, и мы ответим вам в ближайшее время. История чата хранится 24 часа.
            </p>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                <MessageSquare size={48} className="opacity-20" />
                <p className="text-sm text-center">Нет сообщений.<br/>Напишите нам, если у вас возникли проблемы.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === userProfile?.uid;
                const isAdminMsg = msg.isAdmin;
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isAdminMsg ? 'items-start' : 'items-end'}`}>
                    <div 
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        isAdminMsg 
                          ? 'bg-purple-600 text-white rounded-bl-sm shadow-lg shadow-purple-500/20' 
                          : 'bg-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-500/20'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isAdminMsg && ' • Администратор'}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 bg-black/20 border-t border-white/10">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Сообщение..."
                className="flex-1 bg-zinc-900/50 border-white/10 focus-visible:ring-blue-500 rounded-xl"
                disabled={loading}
              />
              <Button 
                type="submit" 
                disabled={!newMessage.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4"
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
