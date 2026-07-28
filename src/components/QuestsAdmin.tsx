import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Plus, Trash, Check, X, Search, Coins, Target } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Quest, QuestType } from '../types';

export default function QuestsAdmin() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingProgress, setDeletingProgress] = useState(false);

  const [newQuest, setNewQuest] = useState<Partial<Quest>>({
    title: '',
    description: '',
    type: 'registration',
    targetCount: 1,
    rewardDays: 3,
    rewardSearches: 5,
    isActive: true,
    order: 0,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'quests'), (snapshot) => {
      const q: Quest[] = [];
      snapshot.forEach(doc => {
        q.push({ id: doc.id, ...doc.data() } as Quest);
      });
      q.sort((a, b) => a.order - b.order);
      setQuests(q);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async () => {
    if (!newQuest.title || !newQuest.description) return;
    try {
      const questRef = doc(collection(db, 'quests'));
      await setDoc(questRef, {
        ...newQuest,
        createdAt: Date.now()
      });
      setNewQuest({
        title: '',
        description: '',
        type: 'registration',
        targetCount: 1,
        rewardDays: 3,
        rewardSearches: 5,
        isActive: true,
        order: quests.length,
      });
    } catch (err) {
      console.error("Error creating quest", err);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingProgress(true);
    try {
      await deleteDoc(doc(db, 'quests', id));
      setDeletingId(null);
    } catch (err) {
      console.error("Error deleting quest", err);
      alert("Ошибка при удалении квеста");
    } finally {
      setDeletingProgress(false);
    }
  };

  const toggleActive = async (quest: Quest) => {
    try {
      await setDoc(doc(db, 'quests', quest.id), { isActive: !quest.isActive }, { merge: true });
    } catch (err) {
      console.error("Error updating quest", err);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950/50 border-white/5 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <Target className="text-amber-500" /> Управление квестами
          </CardTitle>
          <CardDescription>
            Создавайте и настраивайте одноразовые задания для пользователей
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5 space-y-4 mb-8">
            <h3 className="font-semibold text-white mb-2">Создать новый квест</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Название квеста</label>
                <Input 
                  value={newQuest.title}
                  onChange={(e) => setNewQuest({...newQuest, title: e.target.value})}
                  placeholder="Например: Добро пожаловать"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Описание</label>
                <Input 
                  value={newQuest.description}
                  onChange={(e) => setNewQuest({...newQuest, description: e.target.value})}
                  placeholder="Зарегистрируйтесь в приложении"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Тип задания</label>
                <select 
                  className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={newQuest.type}
                  onChange={(e) => setNewQuest({...newQuest, type: e.target.value as QuestType})}
                >
                  <option value="registration">Регистрация</option>
                  <option value="searches">Поиски машин (VIN/модель)</option>
                  <option value="daily_logins">Заходы в разные дни</option>
                  <option value="custom">Другое (ручное)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Цель (количество)</label>
                <Input 
                  type="number"
                  value={newQuest.targetCount}
                  onChange={(e) => setNewQuest({...newQuest, targetCount: parseInt(e.target.value) || 1})}
                  className="bg-black/40 border-white/10"
                  min="1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Награда: Дней VIP</label>
                <Input 
                  type="number"
                  value={newQuest.rewardDays}
                  onChange={(e) => setNewQuest({...newQuest, rewardDays: parseInt(e.target.value) || 0})}
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Награда: Поисков за раз</label>
                <Input 
                  type="number"
                  value={newQuest.rewardSearches}
                  onChange={(e) => setNewQuest({...newQuest, rewardSearches: parseInt(e.target.value) || 0})}
                  className="bg-black/40 border-white/10"
                />
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full bg-blue-600 hover:bg-blue-500 text-white mt-2">
              <Plus size={16} className="mr-2" /> Добавить квест
            </Button>
          </div>

          <div className="space-y-3">
            {quests.map(quest => (
              <div key={quest.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-blue-400">{quest.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 uppercase tracking-wider">{quest.type} ({quest.targetCount})</span>
                  </div>
                  <p className="text-sm text-zinc-400">{quest.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-amber-400 font-medium">
                    <div className="flex items-center gap-1"><Coins size={14} /> VIP: {quest.rewardDays} дн. ({quest.rewardSearches} поис.)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={`border-white/10 ${quest.isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-400'}`}
                    onClick={() => toggleActive(quest)}
                  >
                    {quest.isActive ? 'Активен' : 'Отключен'}
                  </Button>
                  {deletingId === quest.id ? (
                    <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/30 p-1 rounded-xl">
                      <span className="text-xs text-red-300 font-medium px-1">Удалить?</span>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        disabled={deletingProgress}
                        className="h-7 px-2.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
                        onClick={() => handleDelete(quest.id)}
                      >
                        Да
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        disabled={deletingProgress}
                        className="h-7 px-2 text-xs text-zinc-400 hover:text-white rounded-lg"
                        onClick={() => setDeletingId(null)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10" 
                      onClick={() => setDeletingId(quest.id)}
                      title="Удалить квест"
                    >
                      <Trash size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {quests.length === 0 && !loading && (
              <div className="text-center py-8 text-zinc-500">
                Квестов пока нет
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
