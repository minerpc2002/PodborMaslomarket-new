import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Quest, QuestType, UserProfile } from '../types';
import { useAppStore } from '../store/useAppStore';

export const updateQuestProgress = async (
  uid: string,
  questType: QuestType,
  incrementBy = 1,
  metadata?: any
) => {
  if (!uid) return;
  
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;

    const userData = userDoc.data() as UserProfile;
    const userQuests = userData.quests || {};

    const questsSnapshot = await getDocs(collection(db, 'quests'));
    const allQuests: Quest[] = [];
    questsSnapshot.forEach(doc => {
      const q = { id: doc.id, ...doc.data() } as Quest;
      if (q.isActive && q.type === questType) {
        allQuests.push(q);
      }
    });

    let updated = false;

    for (const quest of allQuests) {
      let questData: import('../types').UserQuestProgress = userQuests[quest.id] || { questId: quest.id, progress: 0 };
      
      if (questData.progress >= quest.targetCount) {
        continue; // Already completed
      }

      const wasCompleted = questData.progress >= quest.targetCount;

      if (questType === 'daily_logins') {
        const today = new Date().toISOString().split('T')[0];
        const loginDates = questData.loginDates || [];
        if (!loginDates.includes(today)) {
          questData.loginDates = [...loginDates, today];
          questData.lastLoginDate = today;
          questData.progress += 1;
          updated = true;
        }
      } else {
        questData.progress += incrementBy;
        updated = true;
      }

      const isNowCompleted = questData.progress >= quest.targetCount;

      if (!wasCompleted && isNowCompleted) {
        questData.completedAt = Date.now();
        
        // Trigger popup toast notification
        useAppStore.getState().addNotification({
          id: `quest_completed_${quest.id}_${Date.now()}`,
          title: '🎉 Квест выполнен!',
          message: `Вы завершили "${quest.title}". Заберите награду в меню квестов!`,
          type: 'success',
          createdAt: Date.now()
        });
      }
      
      userQuests[quest.id] = questData;
    }

    if (updated) {
      await updateDoc(userRef, { quests: userQuests });
    }
  } catch (err) {
    console.error("Error updating quest progress", err);
  }
};
