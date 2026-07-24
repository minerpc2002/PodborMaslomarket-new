import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CarData, UserProfile, PromoCode, AiModelConfig, Notification, BackgroundSearch, AiPromptsConfig, MaintenanceConfig } from '../types';
import { defaultPrompts } from '../lib/defaultPrompts';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AppState {
  favorites: CarData[];
  history: CarData[];
  dynamicCars: CarData[];
  userProfile: UserProfile | null;
  isAuthReady: boolean;
  activePromoCode: PromoCode | null;
  searchTimestamps: number[];
  authError: string | null;
  isAiSearchEnabled: boolean;
  aiModelsConfig: AiModelConfig[];
  isSnowfallEnabled: boolean;
  aiTemperature: number;
  aiPrompts: AiPromptsConfig;
  maintenanceConfig: MaintenanceConfig;
  activeSearches: BackgroundSearch[];
  notifications: Notification[];
  
  addFavorite: (car: CarData) => void;
  removeFavorite: (carId: string) => void;
  addToHistory: (car: CarData, isNew?: boolean) => void;
  markAsViewed: (carId: string) => void;
  clearHistory: () => void;
  addDynamicCar: (car: CarData) => void;
  
  setUserProfile: (profile: UserProfile | null) => void;
  setAuthReady: (ready: boolean) => void;
  setActivePromoCode: (promo: PromoCode | null) => void;
  setAuthError: (error: string | null) => void;
  setIsAiSearchEnabled: (enabled: boolean) => void;
  setAiModelsConfig: (config: AiModelConfig[]) => void;
  setIsSnowfallEnabled: (enabled: boolean) => void;
  setAiTemperature: (temperature: number) => void;
  setAiPrompts: (prompts: AiPromptsConfig) => void;
  setMaintenanceConfig: (config: MaintenanceConfig) => void;
  addActivatedPromoCode: (code: string) => void;
  
  addActiveSearch: (search: BackgroundSearch) => void;
  removeActiveSearch: (searchId: string) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  
  recordSearch: () => void;
  getSearchStatus: () => { remainingAttempts: number; totalAttempts: number; minutesUntilReset: number };
  canSearch: () => { allowed: boolean; remainingMinutes: number };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      favorites: [],
      history: [],
      dynamicCars: [],
      userProfile: null,
      isAuthReady: false,
      activePromoCode: null,
      searchTimestamps: [],
      authError: null,
      isAiSearchEnabled: true,
      aiModelsConfig: [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', enabled: true, priority: 1 },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', enabled: true, priority: 2 }
      ],
      isSnowfallEnabled: false,
      aiTemperature: 0.4,
      aiPrompts: defaultPrompts,
      maintenanceConfig: {
        enabled: false,
        message: 'Ведутся технические работы. Приложение может работать со сбоями.'
      },
      activeSearches: [],
      notifications: [],
      
      addFavorite: (car) => set((state) => ({ 
        favorites: state.favorites.some(f => f.id === car.id) 
          ? state.favorites 
          : [...state.favorites, car] 
      })),
      removeFavorite: (carId) => set((state) => ({ 
        favorites: state.favorites.filter(f => f.id !== carId) 
      })),
      addToHistory: (car, isNew = false) => set((state) => {
        const newHistory = state.history.filter(h => h.id !== car.id);
        const carWithStatus = { ...car, isNew };
        return { history: [carWithStatus, ...newHistory].slice(0, 10) };
      }),
      markAsViewed: (carId) => set((state) => ({
        history: state.history.map(h => h.id === carId ? { ...h, isNew: false } : h)
      })),
      clearHistory: () => set({ history: [] }),
      addDynamicCar: (car) => set((state) => {
        const newDynamic = state.dynamicCars.filter(c => c.id !== car.id);
        return { dynamicCars: [car, ...newDynamic].slice(0, 20) };
      }),
      
      setUserProfile: (profile) => set({ userProfile: profile }),
      setAuthReady: (ready) => set({ isAuthReady: ready }),
      setActivePromoCode: (promo) => set({ activePromoCode: promo }),
      setAuthError: (error) => set({ authError: error }),
      setIsAiSearchEnabled: (enabled) => set({ isAiSearchEnabled: enabled }),
      setAiModelsConfig: (config) => set({ aiModelsConfig: config }),
      setIsSnowfallEnabled: (enabled) => set({ isSnowfallEnabled: enabled }),
      setAiTemperature: (temperature) => {
        const val = typeof temperature === 'string' ? parseFloat(temperature) : temperature;
        set({ aiTemperature: isNaN(val) ? 0.4 : val });
      },
      setAiPrompts: (prompts) => set({ aiPrompts: prompts }),
      setMaintenanceConfig: (config) => set({ maintenanceConfig: config }),
      addActivatedPromoCode: (code) => set((state) => ({
        userProfile: state.userProfile ? {
          ...state.userProfile,
          activatedPromoCodes: [...(state.userProfile.activatedPromoCodes || []), code]
        } : null
      })),

      addActiveSearch: (search) => set((state) => ({
        activeSearches: [...state.activeSearches, search]
      })),
      removeActiveSearch: (searchId) => set((state) => ({
        activeSearches: state.activeSearches.filter(s => s.id !== searchId)
      })),
      addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 5)
      })),
      removeNotification: (notificationId) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== notificationId)
      })),
      clearNotifications: () => set({ notifications: [] }),
      
      recordSearch: () => set((state) => {
        const now = Date.now();
        const twentyMinsAgo = now - 20 * 60 * 1000;
        const recentSearches = state.searchTimestamps.filter(t => t > twentyMinsAgo);
        return { searchTimestamps: [...recentSearches, now] };
      }),
      
      getSearchStatus: () => {
        const state = get();
        const now = Date.now();
        const twentyMinsAgo = now - 20 * 60 * 1000;
        const recentSearches = state.searchTimestamps.filter(t => t > twentyMinsAgo);
        
        let limit = 2; // Default limit
        if (state.activePromoCode) {
          if (state.activePromoCode.expiresAt > now) {
            limit = state.activePromoCode.maxAttempts;
          }
        } else if (state.userProfile?.role === 'admin' || 
                   state.userProfile?.role === 'moderator' || 
                   state.userProfile?.email?.toLowerCase() === 'minerpc2002@gmail.com') {
          limit = 100; // Unlimited for staff
        }
        
        const remainingAttempts = Math.max(0, limit - recentSearches.length);
        
        let minutesUntilReset = 0;
        if (recentSearches.length > 0) {
          const oldestSearch = recentSearches[0];
          const timeUntilNext = (oldestSearch + 20 * 60 * 1000) - now;
          minutesUntilReset = Math.ceil(timeUntilNext / 60000);
        }
        
        return { remainingAttempts, totalAttempts: limit, minutesUntilReset };
      },

      canSearch: () => {
        const status = get().getSearchStatus();
        if (status.remainingAttempts > 0) {
          return { allowed: true, remainingMinutes: 0 };
        }
        return { allowed: false, remainingMinutes: status.minutesUntilReset };
      }
    }),
    {
      name: 'oil-selector-storage-v2',
      partialize: (state) => ({ 
        favorites: state.favorites, 
        history: state.history,
        dynamicCars: state.dynamicCars,
        searchTimestamps: state.searchTimestamps,
        activePromoCode: state.activePromoCode,
        aiModelsConfig: state.aiModelsConfig,
        isSnowfallEnabled: state.isSnowfallEnabled,
        aiTemperature: state.aiTemperature,
        aiPrompts: state.aiPrompts
      }),
      version: 6,
      migrate: (persistedState: any, version: number) => {
        if (version < 6) {
          // Force reset prompts to defaults to apply prompt improvements
          persistedState.aiPrompts = defaultPrompts;
        }
        if (version < 5) {
          persistedState.aiModelsConfig = [
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', enabled: true, priority: 1 },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', enabled: true, priority: 2 }
          ];
        }
        return persistedState;
      }
    }
  )
);
