import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioService } from '../AudioService';

type Point = { x: number; y: number };
type GameState = 'idle' | 'playing' | 'over';

const GRID_SIZE = 20;
const CELL_SIZE = 16;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;

export default function GamePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('nibbler-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Game logic refs to avoid re-renders during loop
  const snakeRef = useRef<Point[]>([]);
  const dirRef = useRef<Point>({ x: 1, y: 0 });
  const nextDirRef = useRef<Point>({ x: 1, y: 0 });
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const wallsRef = useRef<Point[]>([]);
  const gameIntervalRef = useRef<number | null>(null);
  const speedRef = useRef(140);
  const hueRef = useRef(0);

  // Maze Generation (Deterministic based on level)
  const generateMaze = useCallback((lvl: number) => {
    const walls: Point[] = [];
    // Outer border
    for (let i = 0; i < GRID_SIZE; i++) {
      walls.push({ x: i, y: 0 });
      walls.push({ x: i, y: GRID_SIZE - 1 });
      walls.push({ x: 0, y: i });
      walls.push({ x: GRID_SIZE - 1, y: i });
    }

    // Procedural internal walls (rectangles)
    // Simple deterministic PRNG based on level
    const seed = lvl * 1337;
    const random = () => {
      const x = Math.sin(seed + walls.length) * 10000;
      return x - Math.floor(x);
    };

    const numRects = Math.min(3 + Math.floor(lvl / 2), 6);
    for (let i = 0; i < numRects; i++) {
      const w = 2 + Math.floor(random() * 4);
      const h = 2 + Math.floor(random() * 4);
      const x = 2 + Math.floor(random() * (GRID_SIZE - w - 4));
      const y = 2 + Math.floor(random() * (GRID_SIZE - h - 4));

      // Protected zone (2,2) to (5,5) for spawn
      if (x < 6 && y < 6) continue;

      // Add rectangle perimeter
      for (let rx = x; rx < x + w; rx++) {
        walls.push({ x: rx, y: y });
        walls.push({ x: rx, y: y + h - 1 });
      }
      for (let ry = y; ry < y + h; ry++) {
        walls.push({ x: x, y: ry });
        walls.push({ x: x + w - 1, y: ry });
      }
    }
    return walls;
  }, []);

  const placeFood = useCallback((snake: Point[], walls: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1,
        y: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1,
      };
      const onWall = walls.some(w => w.x === newFood.x && w.y === newFood.y);
      const onSnake = snake.some(s => s.x === newFood.x && s.y === newFood.y);
      if (!onWall && !onSnake) break;
    }
    foodRef.current = newFood;
  }, []);

  const initLevel = useCallback((lvl: number, resetSnake = true) => {
    wallsRef.current = generateMaze(lvl);
    if (resetSnake) {
      snakeRef.current = [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ];
      dirRef.current = { x: 1, y: 0 };
      nextDirRef.current = { x: 1, y: 0 };
    }
    placeFood(snakeRef.current, wallsRef.current);
    speedRef.current = Math.max(60, 140 - lvl * 15);
  }, [generateMaze, placeFood]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameState('playing');
    initLevel(1);
    audioService.beepEat(); // Initial sound to start audio context
  };

  const gameOver = () => {
    setGameState('over');
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    audioService.beepOver();
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('nibbler-high-score', score.toString());
    }
  };

  const die = () => {
    setLives(prev => {
      const next = prev - 1;
      if (next <= 0) {
        gameOver();
      } else {
        audioService.beepDie();
        initLevel(level);
      }
      return next;
    });
  };

  const step = useCallback(() => {
    if (gameState !== 'playing') return;

    dirRef.current = nextDirRef.current;
    const head = snakeRef.current[0];
    const newHead = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y };

    // Collisions
    const hitWall = wallsRef.current.some(w => w.x === newHead.x && w.y === newHead.y);
    const hitSelf = snakeRef.current.some(s => s.x === newHead.x && s.y === newHead.y);

    if (hitWall || hitSelf) {
      die();
      return;
    }

    const newSnake = [newHead, ...snakeRef.current];
    const ateFood = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;

    if (ateFood) {
      setScore(s => s + 10 * level);
      audioService.beepEat();
      placeFood(newSnake, wallsRef.current);
      
      // Level up condition: 50% of free cells occupied
      const freeCells = GRID_SIZE * GRID_SIZE - wallsRef.current.length;
      if (newSnake.length >= freeCells * 0.5) {
        setLevel(l => {
          const next = l + 1;
          initLevel(next);
          return next;
        });
      }
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  }, [gameState, level, initLevel, placeFood]);

  // Input Handling
  useEffect(() => {
    let touchStart: Point | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      const key = e.key;
      const currentDir = dirRef.current;

      if (key === 'ArrowUp' && currentDir.y === 0) nextDirRef.current = { x: 0, y: -1 };
      if (key === 'ArrowDown' && currentDir.y === 0) nextDirRef.current = { x: 0, y: 1 };
      if (key === 'ArrowLeft' && currentDir.x === 0) nextDirRef.current = { x: -1, y: 0 };
      if (key === 'ArrowRight' && currentDir.x === 0) nextDirRef.current = { x: 1, y: 0 };
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart || gameState !== 'playing') return;
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const dx = touchEnd.x - touchStart.x;
      const dy = touchEnd.y - touchStart.y;
      const currentDir = dirRef.current;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
          if (dx > 0 && currentDir.x === 0) nextDirRef.current = { x: 1, y: 0 };
          else if (dx < 0 && currentDir.x === 0) nextDirRef.current = { x: -1, y: 0 };
        }
      } else {
        if (Math.abs(dy) > 30) {
          if (dy > 0 && currentDir.y === 0) nextDirRef.current = { x: 0, y: 1 };
          else if (dy < 0 && currentDir.y === 0) nextDirRef.current = { x: 0, y: -1 };
        }
      }
      touchStart = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState]);

  // Game Loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameIntervalRef.current = window.setInterval(step, speedRef.current);
      
      // Speed watcher (as per PRD 8.3)
      const speedWatcher = window.setInterval(() => {
        const currentSpeed = Math.max(60, 140 - level * 15);
        if (speedRef.current !== currentSpeed) {
          speedRef.current = currentSpeed;
          if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
          gameIntervalRef.current = window.setInterval(step, speedRef.current);
        }
      }, 500);

      return () => {
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        clearInterval(speedWatcher);
      };
    }
  }, [gameState, step, level]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      hueRef.current = (hueRef.current + 2) % 360;
      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Grid effect
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
        ctx.stroke();
      }

      // Walls
      ctx.fillStyle = '#1a3399';
      wallsRef.current.forEach(w => {
        ctx.fillRect(w.x * CELL_SIZE, w.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        // Inner border for walls
        ctx.strokeStyle = '#2299ff';
        ctx.strokeRect(w.x * CELL_SIZE + 2, w.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      });

      // Food
      const f = foodRef.current;
      ctx.beginPath();
      ctx.arc(f.x * CELL_SIZE + CELL_SIZE / 2, f.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hueRef.current}, 100%, 50%)`;
      ctx.fill();
      // Reflection
      ctx.beginPath();
      ctx.arc(f.x * CELL_SIZE + CELL_SIZE / 3, f.y * CELL_SIZE + CELL_SIZE / 3, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Snake
      snakeRef.current.forEach((s, i) => {
        if (i === 0) {
          // Head
          ctx.fillStyle = '#ff3333';
          ctx.fillRect(s.x * CELL_SIZE, s.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          // Eyes
          ctx.fillStyle = '#fff';
          const eyeSize = 3;
          const offset = 4;
          if (dirRef.current.x === 1) {
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - offset, s.y * CELL_SIZE + 3, eyeSize, eyeSize);
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - offset, s.y * CELL_SIZE + CELL_SIZE - 6, eyeSize, eyeSize);
          } else if (dirRef.current.x === -1) {
            ctx.fillRect(s.x * CELL_SIZE + offset - eyeSize, s.y * CELL_SIZE + 3, eyeSize, eyeSize);
            ctx.fillRect(s.x * CELL_SIZE + offset - eyeSize, s.y * CELL_SIZE + CELL_SIZE - 6, eyeSize, eyeSize);
          } else if (dirRef.current.y === 1) {
            ctx.fillRect(s.x * CELL_SIZE + 3, s.y * CELL_SIZE + CELL_SIZE - offset, eyeSize, eyeSize);
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - 6, s.y * CELL_SIZE + CELL_SIZE - offset, eyeSize, eyeSize);
          } else {
            ctx.fillRect(s.x * CELL_SIZE + 3, s.y * CELL_SIZE + offset - eyeSize, eyeSize, eyeSize);
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - 6, s.y * CELL_SIZE + offset - eyeSize, eyeSize, eyeSize);
          }
        } else {
          // Body with gradient
          const alpha = Math.max(0.3, 1 - i / snakeRef.current.length);
          ctx.fillStyle = `rgba(255, 51, 51, ${alpha})`;
          ctx.fillRect(s.x * CELL_SIZE + 1, s.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        }
      });

      // Overlays
      if (gameState === 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = '#ffdd00';
        ctx.textAlign = 'center';
        ctx.fillText('NIBBLER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
        
        if (Math.floor(Date.now() / 500) % 2 === 0) {
          ctx.font = '10px "Press Start 2P"';
          ctx.fillStyle = '#fff';
          ctx.fillText('PREMI START', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 40);
        }
      }

      if (gameState === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = '#ff2020';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#fff';
        ctx.fillText(`SCORE: ${score}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, score]);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* HUD */}
      <div className="w-full max-w-[320px] flex justify-between items-center mb-6 font-press-start text-[10px] text-arcade-yellow">
        <div>
          <p className="mb-1 opacity-60">PUNTEGGIO</p>
          <p className="text-lg">{score.toString().padStart(7, '0')}</p>
        </div>
        <div className="text-center">
          <p className="mb-1 opacity-60">LIVELLO</p>
          <p className="text-lg">{level}</p>
        </div>
        <div className="text-right">
          <p className="mb-1 opacity-60">VITE</p>
          <div className="flex justify-end gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`text-xl ${i < lives ? 'text-arcade-red' : 'text-arcade-red-dark opacity-20'}`}>
                ●
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative p-2 bg-arcade-border rounded shadow-[0_0_20px_rgba(26,79,255,0.4)]">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block bg-black"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Controls / Footer */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          onClick={startGame}
          className="px-8 py-3 bg-arcade-red-dark hover:bg-arcade-red text-white font-press-start text-sm border-b-4 border-black active:border-b-0 active:translate-y-1 transition-all"
        >
          {gameState === 'idle' ? 'START GAME' : 'RESTART'}
        </button>
        
        <div className="text-arcade-white/40 text-[10px] font-press-start text-center leading-loose">
          USE ARROW KEYS TO MOVE<br />
          HIGH SCORE: {highScore.toString().padStart(7, '0')}
        </div>
      </div>
    </div>
  );
}
