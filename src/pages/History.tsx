import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { History as HistoryIcon, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

export default function History() {
  const { history, clearHistory, markAsViewed } = useAppStore();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <HistoryIcon className="text-blue-500" />
            История
          </h1>
          <p className="text-zinc-400">
            Последние просмотренные автомобили
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="icon" onClick={clearHistory} className="text-red-500 hover:text-red-600 hover:bg-red-950/30">
            <Trash2 size={20} />
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 gap-4 text-zinc-400"
        >
          <HistoryIcon size={48} className="opacity-20" />
          <p>История пуста</p>
          <Link to="/search" className="text-blue-400 font-medium hover:underline">
            Перейти к подбору
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {history.map((car, idx) => (
              <motion.div
                key={`${car.id}-${idx}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
              >
                <Link to={`/result/${car.id}`} onClick={() => markAsViewed(car.id)}>
                  <Card className={`hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden ${car.isNew ? 'border-blue-500/50 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'liquid-glass'}`}>
                    {car.isNew && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg animate-pulse">
                          НОВОЕ
                        </div>
                      </div>
                    )}
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className={`text-lg transition-colors ${car.isNew ? 'text-blue-400' : ''}`}>
                          {car.brand} {car.model}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {car.year_from}-{car.year_to} • {car.engine} ({car.engine_code})
                        </CardDescription>
                      </div>
                      <ChevronRight className={`transition-colors ${car.isNew ? 'text-blue-500' : 'text-zinc-400 group-hover:text-blue-500'}`} />
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
