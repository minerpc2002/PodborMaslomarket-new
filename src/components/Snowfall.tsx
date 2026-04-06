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

interface GarlandLight {
  id: number;
  color: string;
  delay: number;
  x: number;
  y: number;
  angle: number;
}

interface GarlandStringConfig {
  id: number;
  top: number;
  rotate: number;
  droop: number;
  lightsCount: number;
}

const GARLAND_COLORS = [
  '#ef4444', // red-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#eab308', // yellow-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
];

const GARLAND_STRINGS: GarlandStringConfig[] = [
  { id: 1, top: 5, rotate: -2, droop: 80, lightsCount: 25 },
  { id: 2, top: 35, rotate: 3, droop: 120, lightsCount: 35 },
  { id: 3, top: 65, rotate: -1, droop: 90, lightsCount: 28 },
];

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

  const generateLights = (config: GarlandStringConfig) => {
    const lights: GarlandLight[] = [];
    for (let i = 0; i < config.lightsCount; i++) {
      const progress = i / (config.lightsCount - 1);
      const x = progress * 100;
      // Parabola equation for the wire droop
      const y = 4 * config.droop * progress * (1 - progress);
      
      lights.push({
        id: i,
        color: GARLAND_COLORS[Math.floor(Math.random() * GARLAND_COLORS.length)],
        delay: Math.random() * 2,
        x,
        y,
        angle: (Math.random() * 20) - 10, // Slight random dangle
      });
    }
    return lights;
  };

  return (
    <>
      {/* Garlands - Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40 mix-blend-screen">
        {GARLAND_STRINGS.map((config) => {
          const lights = generateLights(config);
          return (
            <div 
              key={config.id} 
              className="absolute w-[110%] -left-[5%]"
              style={{ 
                top: `${config.top}%`, 
                transform: `rotate(${config.rotate}deg)` 
              }}
            >
              {/* Wire */}
              <svg className="absolute top-0 left-0 w-full overflow-visible" style={{ height: config.droop }}>
                <path 
                  d={`M 0 0 Q 50% ${config.droop * 2} 100% 0`} 
                  fill="none" 
                  stroke="#27272a"
                  strokeWidth="2"
                />
              </svg>
              
              {/* Lights */}
              {lights.map((light) => (
                <div 
                  key={light.id} 
                  className="absolute flex flex-col items-center"
                  style={{ 
                    left: `${light.x}%`, 
                    top: `${light.y}px`,
                    transform: `translate(-50%, -2px) rotate(${light.angle}deg)`,
                  }}
                >
                  {/* Bulb Base */}
                  <div className="w-1.5 h-2 bg-zinc-700 rounded-t-sm z-10" />
                  {/* Light bulb */}
                  <motion.div
                    animate={{
                      opacity: [0.3, 1, 0.3],
                      scale: [0.8, 1.2, 0.8],
                      boxShadow: [
                        `0 0 5px ${light.color}`,
                        `0 0 20px ${light.color}, 0 0 40px ${light.color}`,
                        `0 0 5px ${light.color}`,
                      ],
                    }}
                    transition={{
                      duration: 1.5 + Math.random(),
                      repeat: Infinity,
                      delay: light.delay,
                      ease: "easeInOut"
                    }}
                    className="w-2.5 h-3.5 rounded-full -mt-0.5"
                    style={{ backgroundColor: light.color }}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Snowflakes - Foreground */}
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
    </>
  );
}

