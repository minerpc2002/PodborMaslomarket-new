import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface Snowflake {
  id: number;
  x: string;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

export default function Snowfall() {
  const snowflakes = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const count = isMobile ? 20 : 50;
    const flakes: Snowflake[] = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        x: `${Math.random() * 100}%`,
        delay: Math.random() * 10,
        duration: 5 + Math.random() * 10,
        size: 2 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.5,
      });
    }
    return flakes;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {snowflakes.map((flake) => (
        <motion.div
          key={flake.id}
          initial={{ y: -20, opacity: 0 }}
          animate={{ 
            y: '100vh',
            opacity: [0, flake.opacity, flake.opacity, 0],
            x: [`${parseFloat(flake.x)}%`, `${parseFloat(flake.x) + (Math.random() * 10 - 5)}%`]
          }}
          transition={{
            duration: flake.duration,
            repeat: Infinity,
            delay: flake.delay,
            ease: "linear"
          }}
          style={{
            position: 'absolute',
            left: flake.x,
            width: flake.size,
            height: flake.size,
            backgroundColor: 'white',
            borderRadius: '50%',
            filter: 'blur(1px)',
          }}
        />
      ))}
    </div>
  );
}
