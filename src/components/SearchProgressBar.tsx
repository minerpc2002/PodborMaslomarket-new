import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, Cpu, Database, Wrench, Check } from 'lucide-react';

interface SearchProgressBarProps {
  isSearching: boolean;
  statusText?: string;
  className?: string;
}

export default function SearchProgressBar({
  isSearching,
  statusText = 'Инициализация...',
  className = '',
}: SearchProgressBarProps) {
  const [progress, setProgress] = useState(5);

  // Map status text to target percentage milestones
  const getTargetPercentage = (text: string): number => {
    const lower = text.toLowerCase();
    if (lower.includes('инициализация')) return 15;
    if (lower.includes('поиск') || lower.includes('запрос') || lower.includes('vin')) return 38;
    if (lower.includes('уточнение') || lower.includes('интеллектуальный') || lower.includes('подбор')) return 62;
    if (lower.includes('анализ')) return 84;
    if (lower.includes('генерация') || lower.includes('рекомендаций') || lower.includes('оформление')) return 94;
    return 25;
  };

  useEffect(() => {
    if (!isSearching) {
      setProgress(0);
      return;
    }

    // Set initial small progress when search starts
    setProgress((prev) => (prev === 0 ? 8 : prev));

    const target = getTargetPercentage(statusText);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < target) {
          // Fast smooth approach to target
          const delta = Math.max(0.4, (target - prev) * 0.12);
          return Math.min(target, prev + delta);
        } else if (prev < 97) {
          // Slow continuous creep while waiting for API
          return prev + 0.15;
        }
        return prev;
      });
    }, 70);

    return () => clearInterval(interval);
  }, [isSearching, statusText]);

  if (!isSearching) return null;

  const displayPercent = Math.min(100, Math.floor(progress));

  const steps = [
    { label: 'Данные', mark: 25, icon: Database },
    { label: 'Анализ ИИ', mark: 60, icon: Cpu },
    { label: 'Подбор', mark: 88, icon: Wrench },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className={`w-full p-4 rounded-2xl bg-zinc-900/90 border border-purple-500/30 backdrop-blur-xl shadow-2xl space-y-3 ${className}`}
      >
        {/* Header: Status Title & Glowing Percentage */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center shrink-0 w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-purple-400">
                  Поиск масел ИИ
                </span>
              </div>
              <p className="text-xs font-semibold text-zinc-200 truncate">
                {statusText || 'Обработка запроса...'}
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-2xl font-black font-display tracking-tight bg-gradient-to-r from-blue-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              {displayPercent}
            </span>
            <span className="text-sm font-bold text-purple-400">%</span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="relative w-full h-4 bg-zinc-950/90 rounded-full p-0.5 border border-white/10 overflow-hidden shadow-inner">
          {/* Animated Gradient Fill Bar */}
          <div
            className="h-full rounded-full gradient-progress-fill transition-all duration-200 ease-out relative shadow-[0_0_12px_rgba(168,85,247,0.5)]"
            style={{ width: `${Math.max(4, displayPercent)}%` }}
          >
            {/* Shimmer Light Beam Overlay */}
            <div className="absolute inset-0 progress-shimmer-beam rounded-full opacity-70" />
          </div>
        </div>

        {/* Sub-steps Ticks */}
        <div className="flex items-center justify-between px-1 pt-0.5 text-[10px]">
          {steps.map((step) => {
            const isPassed = displayPercent >= step.mark;
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-1 transition-colors duration-300 ${
                  isPassed ? 'text-purple-300 font-bold' : 'text-zinc-500 font-medium'
                }`}
              >
                {isPassed ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Icon size={11} className="opacity-70" />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
