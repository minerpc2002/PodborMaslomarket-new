import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Sparkles, Loader2, Check, RotateCcw, Wand2, Send, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { useAppStore } from '../store/useAppStore';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { defaultPrompts } from '../lib/defaultPrompts';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';

interface AiPromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

type PromptKey = 'vinNoData' | 'vinWithData' | 'manualNoData' | 'manualWithData';

export default function AiPromptsModal({ isOpen, onClose, isAdmin }: AiPromptsModalProps) {
  const { aiPrompts, setAiPrompts, userProfile } = useAppStore();
  const [editingPrompts, setEditingPrompts] = useState(aiPrompts);
  const [isPromptsChanged, setIsPromptsChanged] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PromptKey>('vinNoData');

  // Assistant State
  const [assistantRequest, setAssistantRequest] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEditingPrompts(aiPrompts);
      setIsPromptsChanged(false);
      setAssistantResult(null);
      setAssistantError(null);
    }
  }, [isOpen, aiPrompts]);

  const handlePromptChange = (key: PromptKey, value: string) => {
    setEditingPrompts(prev => ({ ...prev, [key]: value }));
    setIsPromptsChanged(true);
  };

  const handleSavePrompts = async () => {
    if (!isAdmin) return;
    setActionLoading('save-prompts');
    try {
      await setDoc(doc(db, 'settings', 'ai_config'), {
        aiPrompts: editingPrompts,
        updatedAt: Date.now(),
        updatedBy: auth.currentUser?.uid || userProfile?.uid || 'admin'
      }, { merge: true });
      setAiPrompts(editingPrompts);
      setIsPromptsChanged(false);
    } catch (err) {
      console.error('Error saving AI prompts:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPrompts = async () => {
    if (!isAdmin) return;
    setActionLoading('reset-prompts');
    try {
      await setDoc(doc(db, 'settings', 'ai_config'), {
        aiPrompts: defaultPrompts,
        updatedAt: Date.now(),
        updatedBy: auth.currentUser?.uid || userProfile?.uid || 'admin'
      }, { merge: true });
      setAiPrompts(defaultPrompts);
      setEditingPrompts(defaultPrompts);
      setIsPromptsChanged(false);
    } catch (err) {
      console.error('Error resetting AI prompts:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssistantSubmit = async () => {
    if (!assistantRequest.trim()) return;
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const currentPrompt = editingPrompts[activeTab];
      
      const systemInstruction = `You are an expert in prompt engineering for automotive oil selection systems. 
Your task is to modify the provided system prompt based on the user's request in Russian.
The system prompt is in English and uses placeholders like {{VIN}}, {{RAVENOL_DATA}}, {{MILEAGE}}, {{CONDITIONS}}, {{POWER}}, {{HAND_DRIVE}}, {{FUEL_TYPE}}, {{VEHICLE_HINT}}, {{VEHICLE_HINT_SECTION}}, {{QUERY}}, {{CAR_DETAILS}}.
You MUST preserve these placeholders exactly as they are.
The output should be the full updated prompt in English. 
Be precise and technical. 
Return ONLY the updated prompt text, no explanations.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Current Prompt:\n${currentPrompt}\n\nUser Request (Russian):\n${assistantRequest}`,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      const result = response.text;
      if (result) {
        setAssistantResult(result);
      } else {
        throw new Error('Не удалось получить ответ от ИИ');
      }
    } catch (err: any) {
      console.error('Assistant error:', err);
      setAssistantError(err.message || 'Произошла ошибка при работе помощника');
    } finally {
      setAssistantLoading(false);
    }
  };

  const applyAssistantResult = () => {
    if (assistantResult) {
      handlePromptChange(activeTab, assistantResult);
      setAssistantResult(null);
      setAssistantRequest('');
    }
  };

  if (!isOpen) return null;

  const tabs: { key: PromptKey; label: string }[] = [
    { key: 'vinNoData', label: 'VIN (без каталога)' },
    { key: 'vinWithData', label: 'VIN (с каталогом)' },
    { key: 'manualNoData', label: 'Ручной (без каталога)' },
    { key: 'manualWithData', label: 'Ручной (с каталогом)' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl bg-zinc-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl">
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Управление промптами ИИ</h2>
              <p className="text-xs text-zinc-400">Тонкая настройка логики ответов нейросети</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 p-1 bg-black/20 rounded-2xl border border-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === tab.key 
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Editor Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Редактор промпта</h3>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    isPromptsChanged ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                  )} />
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">
                    {isPromptsChanged ? 'Есть изменения' : 'Сохранено'}
                  </span>
                </div>
              </div>
              
              <div className="relative group">
                <textarea
                  value={editingPrompts[activeTab]}
                  onChange={(e) => handlePromptChange(activeTab, e.target.value)}
                  className="w-full h-[400px] bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-zinc-300 font-mono focus:outline-none focus:border-blue-500/50 resize-none transition-all custom-scrollbar"
                  placeholder="Введите текст промпта..."
                />
                <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const el = document.querySelector('textarea');
                      if (el) el.scrollTop = 0;
                    }}
                    className="h-8 w-8 p-0 rounded-lg bg-zinc-900 border-white/10"
                  >
                    <ChevronUp size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSavePrompts}
                  disabled={!isPromptsChanged || actionLoading !== null}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11 rounded-xl shadow-lg shadow-emerald-900/20"
                >
                  {actionLoading === 'save-prompts' ? (
                    <Loader2 size={18} className="animate-spin mr-2" />
                  ) : (
                    <Check size={18} className="mr-2" />
                  )}
                  Сохранить изменения
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetPrompts}
                  disabled={actionLoading !== null}
                  className="flex-1 border-white/10 hover:bg-white/5 h-11 rounded-xl text-zinc-400"
                >
                  {actionLoading === 'reset-prompts' ? (
                    <Loader2 size={18} className="animate-spin mr-2" />
                  ) : (
                    <RotateCcw size={18} className="mr-2" />
                  )}
                  Сбросить
                </Button>
              </div>
            </div>

            {/* Assistant Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Sparkles size={18} className="text-purple-400" />
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">ИИ-Помощник</h3>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-6 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-zinc-300">
                    Опишите, что вы хотите изменить или добавить в промпт. ИИ сам составит правильные инструкции на английском.
                  </p>
                  <p className="text-[10px] text-zinc-500 italic">
                    Пример: "Добавь более строгие правила для поиска антифриза, чтобы он всегда указывал цвет и стандарт G11/G12"
                  </p>
                </div>

                <div className="relative">
                  <textarea
                    value={assistantRequest}
                    onChange={(e) => setAssistantRequest(e.target.value)}
                    placeholder="Что нужно изменить?..."
                    className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-purple-500/50 resize-none transition-all"
                  />
                  <Button
                    onClick={handleAssistantSubmit}
                    disabled={assistantLoading || !assistantRequest.trim()}
                    className="absolute bottom-3 right-3 bg-purple-600 hover:bg-purple-700 text-white h-9 px-4 rounded-lg shadow-lg shadow-purple-900/20"
                  >
                    {assistantLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Wand2 size={16} className="mr-2" />
                        Сгенерировать
                      </>
                    )}
                  </Button>
                </div>

                <AnimatePresence mode="wait">
                  {assistantError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
                    >
                      <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400">{assistantError}</p>
                    </motion.div>
                  )}

                  {assistantResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Результат генерации</span>
                        <span className="text-[10px] text-zinc-500">Проверьте placeholders перед внедрением</span>
                      </div>
                      <div className="bg-black/60 border border-purple-500/20 rounded-xl p-4 max-h-[200px] overflow-y-auto custom-scrollbar">
                        <pre className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                          {assistantResult}
                        </pre>
                      </div>
                      <Button
                        onClick={applyAssistantResult}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white h-10 rounded-xl"
                      >
                        <Check size={18} className="mr-2" />
                        Внедрить в редактор
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> Доступные переменные:
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {['{{VIN}}', '{{RAVENOL_DATA}}', '{{MILEAGE}}', '{{QUERY}}', '{{CAR_DETAILS}}'].map(v => (
                    <code key={v} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded text-[10px] font-mono">
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-zinc-900/80 backdrop-blur-sm flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
          >
            Закрыть окно
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
