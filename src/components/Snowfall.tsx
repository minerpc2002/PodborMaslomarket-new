import React, { useEffect, useRef, useMemo } from 'react';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  density: number;
  opacity: number;
  angle: number;
  spin: number;
}

interface GarlandLight {
  id: number;
  color: string;
  delay: string;
  duration: string;
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
  { id: 1, top: 5, rotate: -2, droop: 70, lightsCount: 20 },
  { id: 2, top: 35, rotate: 3, droop: 100, lightsCount: 24 },
  { id: 3, top: 65, rotate: -1, droop: 80, lightsCount: 20 },
];

export default function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Detect mobile user agents/platforms
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }, []);

  // Limit Garland strings on mobile to further save rendering performance
  const activeGarlands = useMemo(() => {
    return isMobile ? [GARLAND_STRINGS[0]] : GARLAND_STRINGS; // Omit secondary backgrounds on mobile
  }, [isMobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic scale based on screen width/device
    const maxFlakes = isMobile ? 18 : 55;
    const flakes: Snowflake[] = [];

    // Initialize snowflakes
    for (let i = 0; i < maxFlakes; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        radius: 1.2 + Math.random() * 2.8,
        density: 0.3 + Math.random() * 1.0,
        opacity: 0.35 + Math.random() * 0.45,
        angle: Math.random() * Math.PI * 2,
        spin: 0.008 + Math.random() * 0.02,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < maxFlakes; i++) {
        const f = flakes[i];

        // Draw Snowflake
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`;
        ctx.fill();

        // Update Position
        f.y += f.density;
        f.angle += f.spin;
        f.x += Math.sin(f.angle) * 0.4;

        // Reset when falls off bottom
        if (f.y > height + 5) {
          f.y = -10;
          f.x = Math.random() * width;
        }

        // Wrap around horizontally slightly
        if (f.x > width + 5) {
          f.x = -5;
        } else if (f.x < -5) {
          f.x = width + 5;
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  // Helper to generate garland bulb coordinates
  const generateLights = (config: GarlandStringConfig) => {
    const lights: GarlandLight[] = [];
    const count = isMobile ? Math.floor(config.lightsCount / 1.5) : config.lightsCount;
    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1 || 1);
      const x = progress * 100;
      // Parabolical arc wire droop
      const y = 4 * config.droop * progress * (1 - progress);
      
      lights.push({
        id: i,
        color: GARLAND_COLORS[Math.floor(Math.random() * GARLAND_COLORS.length)],
        delay: `${(Math.random() * 1.5).toFixed(2)}s`,
        duration: `${(1.2 + Math.random() * 1.3).toFixed(2)}s`,
        x,
        y,
        angle: Math.floor(Math.random() * 18) - 9, // Slight visual shift
      });
    }
    return lights;
  };

  return (
    <>
      {/* CSS Stylesheet Injector for Hardware-Accelerated Garland Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bulb-fade {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.82) translate3d(0,0,0);
            box-shadow: 0 0 2px var(--bulb-color);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) translate3d(0,0,0);
            box-shadow: 0 0 12px var(--bulb-color), 0 0 24px var(--bulb-color);
          }
        }
        .bulb-gpu-anim {
          will-change: transform, opacity;
          animation: bulb-fade var(--duration) ease-in-out infinite;
          animation-delay: var(--delay);
          background-color: var(--bulb-color);
        }
      `}} />

      {/* Garlands Background Wire (optimized) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30 mix-blend-screen select-none">
        {activeGarlands.map((config) => {
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
              {/* Connector Wire path */}
              <svg className="absolute top-0 left-0 w-full overflow-visible" style={{ height: config.droop }}>
                <path 
                  d={`M 0 0 Q 50% ${config.droop * 2} 100% 0`} 
                  fill="none" 
                  stroke="#27272a"
                  strokeWidth="1.5"
                />
              </svg>
              
              {/* Individual Light Bulbs */}
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
                  <div className="w-1.5 h-1.5 bg-zinc-700 rounded-t-sm z-10" />
                  <div
                    className="w-2.5 h-3.5 rounded-full -mt-0.5 bulb-gpu-anim"
                    style={{ 
                      '--bulb-color': light.color,
                      '--delay': light.delay,
                      '--duration': light.duration
                    } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Snowfall Container targeting optimized 2D Canvas */}
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
        style={{ width: '100vw', height: '100vh' }}
      />
    </>
  );
}

