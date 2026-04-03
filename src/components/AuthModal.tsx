import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ShieldCheck, User, LogIn, Loader2, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  signOut, 
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { UserProfile, PromoCode } from '../types';

import { isTelegramWebApp } from '../lib/telegram';

export default function AuthModal() {
  const { userProfile, isAuthReady, setActivePromoCode, authError } = useAppStore();
  const [nameInput, setNameInput] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsNickname, setNeedsNickname] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'social'>('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const error = localError || authError;
  const setError = setLocalError;

  useEffect(() => {
    if (isAuthReady && auth.currentUser && !userProfile) {
      setNeedsNickname(true);
      setCurrentUser(auth.currentUser);
    } else {
      setNeedsNickname(false);
    }

    // Check for redirect result on mount
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const userDoc = await getDoc(doc(db, 'users', result.user.uid));
          if (!userDoc.exists()) {
            setNeedsNickname(true);
            setCurrentUser(result.user);
          }
        }
      } catch (err: any) {
        console.error('Redirect result error:', err);
        if (err.code === 'auth/unauthorized-domain') {
          setError('Этот домен не добавлен в список разрешенных в консоли Firebase.');
        } else {
          setError('Ошибка при входе через Google (Redirect)');
        }
      }
    };
    checkRedirect();
  }, [isAuthReady, auth.currentUser, userProfile]);

  if (!isAuthReady) return null;
  if (userProfile) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      
      // If inside Telegram Web App, popup might not work reliably, so we can try popup but fallback aggressively
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          setNeedsNickname(true);
          setCurrentUser(user);
        }
      } catch (popupErr: any) {
        console.warn('Popup failed, trying redirect...', popupErr);
        // If user explicitly closed, don't redirect
        if (popupErr.code === 'auth/popup-closed-by-user') {
          setLoading(false);
          return;
        }
        
        if (popupErr.code === 'auth/unauthorized-domain') {
          throw new Error('Домен не авторизован в Firebase Console. Добавьте ваш Vercel домен в Authorized Domains.');
        }
        
        // Fallback to redirect for any other error (especially in Telegram Desktop/Mobile)
        await signInWithRedirect(auth, provider);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ошибка при входе через Google');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (authMode === 'register') {
        if (password !== confirmPassword) {
          setError('Пароли не совпадают');
          setLoading(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        setNeedsNickname(true);
        setCurrentUser(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
          setNeedsNickname(true);
          setCurrentUser(result.user);
        } else {
          // Explicitly set profile in store to ensure UI updates
          useAppStore.getState().setUserProfile(userDoc.data() as UserProfile);
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'Ошибка авторизации';
      if (err.code === 'auth/email-already-in-use') msg = 'Этот email уже используется';
      if (err.code === 'auth/invalid-email') msg = 'Некорректный email';
      if (err.code === 'auth/weak-password') msg = 'Слишком слабый пароль';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Неверный email или пароль';
      if (err.code === 'auth/operation-not-allowed') msg = 'Вход по Email и Паролю не включен в консоли Firebase. Пожалуйста, включите его в разделе Authentication -> Sign-in method.';
      if (err.code === 'auth/too-many-requests') msg = 'Слишком много попыток. Попробуйте позже.';
      setError(`${msg} (${err.code || 'unknown'})`);
    } finally {
      setLoading(false);
    }
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType: operation,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const nickname = nameInput.trim();
    if (nickname.length < 3) {
      setError('Никнейм должен содержать минимум 3 символа');
      return;
    }
    if (nickname.length > 20) {
      setError('Никнейм должен содержать максимум 20 символов');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await runTransaction(db, async (transaction) => {
        const nicknameDocRef = doc(db, 'nicknames', nickname.toLowerCase());
        const nicknameDoc = await transaction.get(nicknameDocRef);
        
        if (nicknameDoc.exists() && nicknameDoc.data().uid !== currentUser.uid) {
          throw new Error('Этот никнейм уже занят');
        }

        const userProfile: UserProfile = {
          uid: currentUser.uid,
          nickname: nickname,
          email: currentUser.email || '',
          role: currentUser.email?.toLowerCase() === 'minerpc2002@gmail.com' ? 'admin' : 'user',
          createdAt: Date.now()
        };

        transaction.set(nicknameDocRef, { uid: currentUser.uid });
        transaction.set(doc(db, 'users', currentUser.uid), userProfile);
      });

      // Handle initial promo code if provided
      if (promoInput.trim()) {
        const promoCode = promoInput.trim().toUpperCase();
        const promoDoc = await getDoc(doc(db, 'promocodes', promoCode));
        if (promoDoc.exists()) {
          const promoData = promoDoc.data() as PromoCode;
          if (promoData.expiresAt > Date.now()) {
            setActivePromoCode(promoData);
          }
        }
      }

      // Force reload to ensure all states are correctly initialized
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('permission')) {
        handleFirestoreError(err, 'write', `users/${currentUser.uid}`);
      }
      setError(err.message || 'Ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    useAppStore.getState().setActivePromoCode(null);
    setNeedsNickname(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md border-none shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <CardHeader className="space-y-3 pb-4">
          <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mb-2 mx-auto">
            {authMode === 'register' ? <UserPlus className="text-blue-400" size={24} /> : <User className="text-blue-400" size={24} />}
          </div>
          <CardTitle className="text-2xl text-center font-display">
            {needsNickname ? 'Завершение регистрации' : 
             authMode === 'register' ? 'Регистрация' : 
             authMode === 'login' ? 'Вход в аккаунт' : 'Авторизация'}
          </CardTitle>
          <CardDescription className="text-center text-base">
            {needsNickname 
              ? 'Выберите уникальный никнейм для вашего профиля' 
              : authMode === 'register' ? 'Создайте аккаунт для доступа к сервису' : 'Пожалуйста, войдите для использования сервиса подбора'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!needsNickname ? (
            <div className="space-y-4">
              {authMode === 'social' ? (
                <div className="grid grid-cols-1 gap-3">
                  <Button 
                    onClick={handleGoogleLogin} 
                    disabled={loading}
                    className="w-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center gap-2"
                    size="lg"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                    Войти через Google
                  </Button>

                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-zinc-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-zinc-950 px-2 text-zinc-500">или</span>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setAuthMode('login')} 
                    disabled={loading}
                    variant="outline"
                    className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-900 flex items-center justify-center gap-2"
                    size="lg"
                  >
                    <Mail size={20} />
                    Войти через Email
                  </Button>
                  
                  <Button 
                    onClick={() => setAuthMode('register')} 
                    disabled={loading}
                    variant="ghost"
                    className="w-full text-zinc-400 hover:text-white text-sm"
                  >
                    Нет аккаунта? Зарегистрироваться
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-zinc-500" size={18} />
                      <Input 
                        type="email"
                        placeholder="example@mail.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Пароль</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-zinc-500" size={18} />
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {authMode === 'register' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Повторите пароль</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 text-zinc-500" size={18} />
                        <Input 
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                          disabled={loading}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                      size="lg"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : 
                       authMode === 'register' ? 'Создать аккаунт' : 'Войти'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setAuthMode('social')}
                      disabled={loading}
                      className="w-full text-zinc-400 hover:text-white"
                    >
                      Назад
                    </Button>
                  </div>
                </form>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-500 text-center">{error}</p>
                </div>
              )}
              <p className="text-xs text-zinc-500 text-center leading-relaxed">
                {authMode === 'social' 
                  ? 'Используйте ваш Google аккаунт для быстрого и безопасного входа.'
                  : 'Ваши данные надежно защищены шифрованием.'}
              </p>
              
              {auth.currentUser?.email?.toLowerCase() === 'minerpc2002@gmail.com' && !userProfile && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <p className="text-[10px] text-blue-400 font-bold uppercase mb-2">Admin Debug</p>
                  <p className="text-[10px] text-zinc-400 break-all">UID: {auth.currentUser.uid}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2 text-[10px] h-8 border-blue-500/30 text-blue-400"
                    onClick={() => setNeedsNickname(true)}
                  >
                    Принудительно открыть регистрацию
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ваш никнейм *</label>
                <Input 
                  placeholder="Например: Alex99" 
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  disabled={loading}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
              
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">Промокод (опционально)</label>
                <Input 
                  placeholder="Введите промокод" 
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="uppercase"
                  disabled={loading}
                />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Промокод увеличивает лимит поисков.
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                  size="lg"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Завершить регистрацию'}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full text-zinc-400 hover:text-white"
                >
                  Отмена
                </Button>
              </div>
            </form>
          )}
          
          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 mt-6">
            <ShieldCheck size={14} />
            <span>Данные защищены M.A.R.A.T Guard</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
