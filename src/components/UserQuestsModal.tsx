import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, Gift, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { useAppStore } from '../store/useAppStore';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Quest, PromoCode } from '../types';

interface UserQuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserQuestsModal({ isOpen, onClose }: UserQuestsModalProps) {
  const { userProfile } = useAppStore();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = onSnapshot(collection(db, 'quests'), (snapshot) => {
      const q: Quest[] = [];
      snapshot.forEach(doc => {
        const quest = { id: doc.id, ...doc.data() } as Quest;
        if (quest.isActive) q.push(quest);
      });
      q.sort((a, b) => a.order - b.order);
      setQuests(q);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleClaimReward = async (quest: Quest) => {
    if (!userProfile?.uid) return;
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userQuests = userData.quests || {};
        
        // Claim reward
        const questData = userQuests[quest.id] || { progress: quest.targetCount };
        
        if (questData.rewardClaimedAt) {
           alert("Награда уже получена!");
           return;
        }
        
        userQuests[quest.id] = {
          ...questData,
          rewardClaimedAt: Date.now()
        };
        
        // Generate promo code for reward
        const additionalTime = quest.rewardDays * 24 * 60 * 60 * 1000;
        
        let finalPromo: PromoCode;
        if (userData.activePromoCode && userData.activePromoCode.expiresAt > Date.now()) {
          finalPromo = {
            ...userData.activePromoCode,
            expiresAt: userData.activePromoCode.expiresAt + additionalTime,
            maxAttempts: Math.max(userData.activePromoCode.maxAttempts, quest.rewardSearches)
          };
        } else {
          finalPromo = {
            code: `QUEST_${quest.id}_${Date.now().toString().slice(-4)}`,
            expiresAt: Date.now() + additionalTime,
            maxAttempts: quest.rewardSearches,
            maxActivations: 1,
            usedCount: 1,
            createdBy: 'system',
            createdAt: Date.now()
          };
        }

        await updateDoc(userRef, { 
          quests: userQuests,
          activePromoCode: finalPromo
        });
        
        alert(`Награда получена! VIP статус на ${quest.rewardDays} дней активирован.`);
      }
    } catch (err) {
      console.error("Error claiming reward", err);
      alert("Ошибка при получении награды.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-hidden touch-none" onClick={onClose}>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md max-h-[90vh] flex flex-col"
      >
        <Card className="border border-white/10 shadow-2xl relative overflow-hidden liquid-glass-heavy rounded-3xl flex flex-col max-h-full">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all z-50 cursor-pointer"
          >
            <X size={18} />
          </button>
          
          <CardHeader className="pb-4 pt-6 relative z-10 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Target size={24} />
              </div>
              <div>
                <CardTitle className="text-xl font-display font-bold text-white">Задания</CardTitle>
                <CardDescription>Выполняйте задания и получайте VIP статус</CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 overflow-y-auto custom-scrollbar pb-6 relative z-10">
            {loading ? (
              <div className="text-center py-8 text-zinc-500">Загрузка...</div>
            ) : (() => {
              const visibleQuests = quests.filter(quest => {
                const userQuestData = userProfile?.quests?.[quest.id];
                return !userQuestData?.rewardClaimedAt;
              });

              if (visibleQuests.length === 0) {
                return <div className="text-center py-8 text-zinc-500">Доступных заданий пока нет.</div>;
              }

              return visibleQuests.map(quest => {
                const userQuestData = userProfile?.quests?.[quest.id];
                const progress = userQuestData?.progress || 0;
                const isCompleted = progress >= quest.targetCount;

                return (
                  <div key={quest.id} className="p-4 bg-zinc-900/60 border border-white/5 rounded-2xl flex flex-col gap-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <h4 className="font-bold text-zinc-200">{quest.title}</h4>
                        <p className="text-xs text-zinc-400 mt-1">{quest.description}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg text-amber-400 text-xs font-bold flex items-center gap-1 shrink-0 ml-2">
                        <Gift size={12} />
                        VIP {quest.rewardDays} дн.
                      </div>
                    </div>
                    
                    <div className="z-10">
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1 font-mono">
                        <span>Прогресс</span>
                        <span>{progress} / {quest.targetCount}</span>
                      </div>
                      <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
                        <div 
                          className={`h-full ${isCompleted ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'} transition-all duration-500`} 
                          style={{ width: `${Math.min(100, (progress / quest.targetCount) * 100)}%` }} 
                        />
                      </div>
                    </div>
                    
                    <div className="z-10 mt-1">
                      {isCompleted ? (
                        <Button 
                          onClick={() => handleClaimReward(quest)}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white border-none shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                        >
                          Забрать награду
                        </Button>
                      ) : (
                        <div className="w-full py-2 bg-white/5 border border-white/5 text-zinc-500 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                          <Clock size={16} /> В процессе
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
