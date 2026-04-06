import { Link } from 'react-router-dom';
import { Search, ScanLine, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { motion } from 'motion/react';

export default function Home() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-8"
    >
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="space-y-3 pt-2"
      >
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight leading-[1.1] text-center bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
          Умный подбор<br/>
          <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">масел и жидкостей</span>
        </h1>
        <p className="text-zinc-400 text-sm md:text-base max-w-[280px] mx-auto text-center leading-relaxed">
          Профессиональный сервис для точного подбора технических жидкостей
        </p>
      </motion.div>

      <div className="grid gap-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link to="/search" state={{ tab: 'vin' }} className="block group">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 backdrop-blur-xl border border-white/10 p-[1px] shadow-2xl transition-[shadow,transform] duration-500 hover:shadow-blue-500/10">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 animate-pulse opacity-50" />
              <div className="relative bg-black/40 rounded-[23px] p-6 text-white overflow-hidden">
                <div className="absolute -right-6 -top-6 opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-700">
                  <ScanLine size={120} strokeWidth={1} />
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                      <Sparkles className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-display tracking-tight">По VIN коду</h3>
                      <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-medium">AI Анализ</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-400/10 text-amber-500 text-[9px] font-black uppercase tracking-wider rounded-md border border-amber-500/20">
                    pre-Release
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 max-w-[160px] leading-snug">
                    Мгновенный подбор по VIN номеру
                  </p>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link to="/search" state={{ tab: 'manual' }}>
            <Card className="rounded-3xl border border-white/5 shadow-xl liquid-glass hover:shadow-blue-500/5 transition-[shadow,transform] group overflow-hidden">
              <CardHeader className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-zinc-800/80 text-zinc-300 rounded-2xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-inner">
                    <Search size={24} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg font-display font-bold flex items-center gap-2">
                      По автомобилю
                    </CardTitle>
                    <CardDescription className="text-sm mt-0.5 text-zinc-400">Марка, модель, год, двигатель</CardDescription>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-zinc-100 group-hover:text-zinc-900 transition-all duration-300">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="mt-2 p-5 rounded-3xl liquid-glass shadow-sm"
      >
        <h3 className="font-display font-semibold mb-3 text-sm text-zinc-500 uppercase tracking-wider">Официальные партнеры</h3>
        <div className="flex flex-wrap gap-2">
          {['Ravenol', 'Motul', 'BARDAHL', 'Moly Green'].map((partner, i) => (
            <motion.span 
              key={partner}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + (i * 0.05) }}
              className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-sm font-semibold text-zinc-300"
            >
              {partner}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
