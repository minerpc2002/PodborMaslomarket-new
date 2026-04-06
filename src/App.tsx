/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import { useAppStore } from './store/useAppStore';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from './types';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Result = lazy(() => import('./pages/Result'));
const Favorites = lazy(() => import('./pages/Favorites'));
const History = lazy(() => import('./pages/History'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Snowfall = lazy(() => import('./components/Snowfall'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="ai-loader w-8 h-8" />
  </div>
);

export default function App() {
  const { setUserProfile, setAuthReady, userProfile, setAuthError, setIsAiSearchEnabled, isSnowfallEnabled, setIsSnowfallEnabled } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.add('dark');

    // Listen to AI settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'ai_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAiSearchEnabled(data.isAiSearchEnabled ?? true);
        setIsSnowfallEnabled(data.isSnowfallEnabled ?? false);
      }
    });

    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (user) {
        setAuthError(null);
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            // Sync active promo code from profile if it exists, otherwise clear it
            if (profile.activePromoCode !== undefined) {
              useAppStore.getState().setActivePromoCode(profile.activePromoCode);
            } else {
              useAppStore.getState().setActivePromoCode(null);
            }
          } else {
            setUserProfile(null);
            useAppStore.getState().setActivePromoCode(null);
          }
          setAuthReady(true);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          setAuthError(`Ошибка профиля: ${error.message}`);
          setUserProfile(null);
          useAppStore.getState().setActivePromoCode(null);
          setAuthReady(true);
        });
      } else {
        setUserProfile(null);
        useAppStore.getState().setActivePromoCode(null);
        setAuthReady(true);
        setAuthError(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      unsubSettings();
    };
  }, [setUserProfile, setAuthReady, setAuthError, setIsAiSearchEnabled]);

  const isStaff = userProfile?.role === 'admin' || 
                  userProfile?.role === 'moderator' || 
                  userProfile?.email?.toLowerCase() === 'minerpc2002@gmail.com' ||
                  auth.currentUser?.email?.toLowerCase() === 'minerpc2002@gmail.com';

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        {isSnowfallEnabled && <Snowfall />}
      </Suspense>
      <div className="bg-blobs">
        <div className="blob w-[800px] h-[800px] bg-blue-600/50 -top-[10%] -left-[10%]" />
        <div className="blob w-[900px] h-[900px] bg-indigo-500/40 -bottom-[10%] -right-[10%] animation-delay-2000" />
        <div className="blob w-[600px] h-[600px] bg-fuchsia-500/40 top-[20%] right-[10%] animation-delay-4000" />
        <div className="blob w-[700px] h-[700px] bg-cyan-500/30 bottom-[20%] left-[10%] animation-delay-3000" />
      </div>
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={
              <Suspense fallback={<PageLoader />}>
                <Home />
              </Suspense>
            } />
            <Route path="search" element={
              <Suspense fallback={<PageLoader />}>
                <Search />
              </Suspense>
            } />
            <Route path="result/:id" element={
              <Suspense fallback={<PageLoader />}>
                <Result />
              </Suspense>
            } />
            <Route path="favorites" element={
              <Suspense fallback={<PageLoader />}>
                <Favorites />
              </Suspense>
            } />
            <Route path="history" element={
              <Suspense fallback={<PageLoader />}>
                <History />
              </Suspense>
            } />
            <Route 
              path="dashboard" 
              element={
                <Suspense fallback={<PageLoader />}>
                  {isStaff ? <Dashboard /> : <Navigate to="/" replace />}
                </Suspense>
              } 
            />
            <Route path="*" element={
              <Suspense fallback={<PageLoader />}>
                <Home />
              </Suspense>
            } />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
