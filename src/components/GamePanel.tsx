import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioService } from '../AudioService';

type Point = { x: number; y: number };
type GameState = 'idle' | 'playing' | 'over';

const GRID_SIZE   = 25;   // 25×25 grid
const CELL_SIZE   = 22;   // 22 px per cell → 550 px canvas
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const FOOD_COUNT      = 5;
const FOODS_PER_LEVEL = 10;

// ── Maze generation ───────────────────────────────────────────────────────────
//
// Layout rule:
//   • Outer border → always wall
//   • A cell (x,y) inside the border is a wall only when BOTH x and y
//     belong to INNER_WALL_POS (the "pillar" positions).
//   • Every other cell is open.
//
// Result: 5 corridor bands per axis (each 3 cells wide), separated by 2-cell
// "pillar" walls.  Every open cell is reachable — no isolated areas.
//
//   corridor columns: 1-3, 6-8, 11-13, 16-18, 21-23
//   pillar columns  : 4-5, 9-10, 14-15, 19-20
//   (same pattern for rows)
//
// Minimum corridor width is 3 cells everywhere.

const INNER_WALL_POS = new Set([4, 5, 9, 10, 14, 15, 19, 20]);

function isMazeWall(x: number, y: number): boolean {
  if (x <= 0 || x >= GRID_SIZE - 1 || y <= 0 || y >= GRID_SIZE - 1) return true;
  return INNER_WALL_POS.has(x) && INNER_WALL_POS.has(y);
}

// Pre-compute wall list and set once at module load.
const WALLS: Point[] = [];
const WALL_SET = new Set<string>();
for (let y = 0; y < GRID_SIZE; y++) {
  for (let x = 0; x < GRID_SIZE; x++) {
    if (isMazeWall(x, y)) {
      WALLS.push({ x, y });
      WALL_SET.add(`${x},${y}`);
    }
  }
}
const isWall = (x: number, y: number) => WALL_SET.has(`${x},${y}`);

const SPAWN: Point[] = [
  { x: 3, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function GamePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore]         = useState(0);
  const [lives, setLives]         = useState(3);
  const [level, setLevel]         = useState(1);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('nibbler-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Game-logic refs (avoid stale closures in the interval callback)
  const snakeRef     = useRef<Point[]>([]);
  const dirRef       = useRef<Point>({ x: 1, y: 0 });
  const nextDirRef   = useRef<Point>({ x: 1, y: 0 });
  const foodsRef     = useRef<Point[]>([]);
  const gameIntervalRef = useRef<number | null>(null);
  const speedRef     = useRef(140);
  const hueRef       = useRef(0);
  const scoreRef     = useRef(0);
  const levelRef     = useRef(1);
  const livesRef     = useRef(3);
  const foodsEatenRef   = useRef(0);
  const gameStateRef = useRef<GameState>('idle');

  // ── Helpers ────────────────────────────────────────────────────────────────

  const placeOneFood = useCallback((snake: Point[], existing: Point[]): Point => {
    let food: Point = { x: 0, y: 0 };
    for (let attempt = 0; attempt < 2000; attempt++) {
      const x = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
      const y = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
      if (isWall(x, y)) continue;
      if (snake.some(s => s.x === x && s.y === y)) continue;
      if (existing.some(f => f.x === x && f.y === y)) continue;
      food = { x, y };
      break;
    }
    return food;
  }, []);

  const resetSnake = useCallback(() => {
    snakeRef.current   = SPAWN.map(p => ({ ...p }));
    dirRef.current     = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
  }, []);

  const spawnFoods = useCallback(() => {
    const foods: Point[] = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      foods.push(placeOneFood(snakeRef.current, foods));
    }
    foodsRef.current = foods;
  }, [placeOneFood]);

  // ── Game lifecycle ──────────────────────────────────────────────────────────

  const handleGameOver = useCallback(() => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    gameStateRef.current = 'over';
    setGameState('over');
    audioService.beepOver();
    const finalScore = scoreRef.current;
    setHighScore(prev => {
      if (finalScore > prev) {
        localStorage.setItem('nibbler-high-score', finalScore.toString());
        return finalScore;
      }
      return prev;
    });
  }, []);

  const step = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    dirRef.current = nextDirRef.current;
    const head    = snakeRef.current[0];
    const newHead = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y };

    // Collision
    if (
      isWall(newHead.x, newHead.y) ||
      snakeRef.current.some(s => s.x === newHead.x && s.y === newHead.y)
    ) {
      const newLives = livesRef.current - 1;
      livesRef.current = newLives;
      setLives(newLives);
      if (newLives <= 0) {
        handleGameOver();
      } else {
        audioService.beepDie();
        resetSnake();
        spawnFoods();
      }
      return;
    }

    const newSnake   = [newHead, ...snakeRef.current];
    const eatenIdx   = foodsRef.current.findIndex(f => f.x === newHead.x && f.y === newHead.y);

    if (eatenIdx >= 0) {
      // Replace eaten food immediately
      const newFoods = foodsRef.current.filter((_, i) => i !== eatenIdx);
      newFoods.push(placeOneFood(newSnake, newFoods));
      foodsRef.current = newFoods;

      const newScore = scoreRef.current + 10 * levelRef.current;
      scoreRef.current = newScore;
      setScore(newScore);
      audioService.beepEat();

      foodsEatenRef.current++;
      if (foodsEatenRef.current >= FOODS_PER_LEVEL) {
        foodsEatenRef.current = 0;
        const newLevel = levelRef.current + 1;
        levelRef.current = newLevel;
        setLevel(newLevel);
        speedRef.current = Math.max(60, 140 - newLevel * 15);
      }
      // Snake grows: don't pop
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  }, [handleGameOver, placeOneFood, resetSnake, spawnFoods]);

  const startGame = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    livesRef.current = 3;
    setLevel(1);
    levelRef.current = 1;
    foodsEatenRef.current = 0;
    speedRef.current = 140;
    resetSnake();
    spawnFoods();
    gameStateRef.current = 'playing';
    setGameState('playing');
    audioService.beepEat();
  }, [resetSnake, spawnFoods]);

  // ── Input handling ──────────────────────────────────────────────────────────

  useEffect(() => {
    let touchStart: Point | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const key = e.key;
      const cur = dirRef.current;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
      }

      if (key === 'ArrowUp'    && cur.y === 0) nextDirRef.current = { x:  0, y: -1 };
      if (key === 'ArrowDown'  && cur.y === 0) nextDirRef.current = { x:  0, y:  1 };
      if (key === 'ArrowLeft'  && cur.x === 0) nextDirRef.current = { x: -1, y:  0 };
      if (key === 'ArrowRight' && cur.x === 0) nextDirRef.current = { x:  1, y:  0 };
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart || gameStateRef.current !== 'playing') return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      const cur = dirRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
          if (dx > 0 && cur.x === 0) nextDirRef.current = { x:  1, y: 0 };
          if (dx < 0 && cur.x === 0) nextDirRef.current = { x: -1, y: 0 };
        }
      } else {
        if (Math.abs(dy) > 30) {
          if (dy > 0 && cur.y === 0) nextDirRef.current = { x: 0, y:  1 };
          if (dy < 0 && cur.y === 0) nextDirRef.current = { x: 0, y: -1 };
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
  }, []);

  // ── Game loop ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameState === 'playing') {
      gameIntervalRef.current = window.setInterval(step, speedRef.current);

      // Speed watcher: reacts to level changes stored in speedRef
      const speedWatcher = window.setInterval(() => {
        const target = Math.max(60, 140 - levelRef.current * 15);
        if (speedRef.current !== target) {
          speedRef.current = target;
          if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
          gameIntervalRef.current = window.setInterval(step, speedRef.current);
        }
      }, 300);

      return () => {
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        clearInterval(speedWatcher);
      };
    }
  }, [gameState, step]);

  // ── Rendering ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      hueRef.current = (hueRef.current + 2) % 360;

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Subtle grid
      ctx.strokeStyle = '#0d0d0d';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE); ctx.stroke();
      }

      // Walls
      WALLS.forEach(w => {
        ctx.fillStyle = '#1a3399';
        ctx.fillRect(w.x * CELL_SIZE, w.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#2299ff';
        ctx.strokeRect(w.x * CELL_SIZE + 2, w.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      });

      // Foods — each with an offset hue for variety
      foodsRef.current.forEach((f, fi) => {
        const foodHue = (hueRef.current + fi * 72) % 360;
        ctx.beginPath();
        ctx.arc(f.x * CELL_SIZE + CELL_SIZE / 2, f.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${foodHue}, 100%, 50%)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.x * CELL_SIZE + CELL_SIZE / 3, f.y * CELL_SIZE + CELL_SIZE / 3, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      });

      // Snake
      snakeRef.current.forEach((s, i) => {
        if (i === 0) {
          ctx.fillStyle = '#ff3333';
          ctx.fillRect(s.x * CELL_SIZE, s.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.fillStyle = '#fff';
          const e = 3, o = 4;
          if      (dirRef.current.x ===  1) {
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - o, s.y * CELL_SIZE + 3, e, e);
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - o, s.y * CELL_SIZE + CELL_SIZE - 6, e, e);
          } else if (dirRef.current.x === -1) {
            ctx.fillRect(s.x * CELL_SIZE + o - e, s.y * CELL_SIZE + 3, e, e);
            ctx.fillRect(s.x * CELL_SIZE + o - e, s.y * CELL_SIZE + CELL_SIZE - 6, e, e);
          } else if (dirRef.current.y ===  1) {
            ctx.fillRect(s.x * CELL_SIZE + 3, s.y * CELL_SIZE + CELL_SIZE - o, e, e);
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - 6, s.y * CELL_SIZE + CELL_SIZE - o, e, e);
          } else {
            ctx.fillRect(s.x * CELL_SIZE + 3, s.y * CELL_SIZE + o - e, e, e);
            ctx.fillRect(s.x * CELL_SIZE + CELL_SIZE - 6, s.y * CELL_SIZE + o - e, e, e);
          }
        } else {
          const alpha = Math.max(0.3, 1 - i / snakeRef.current.length);
          ctx.fillStyle = `rgba(255, 51, 51, ${alpha})`;
          ctx.fillRect(s.x * CELL_SIZE + 1, s.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        }
      });

      // Overlays
      if (gameStateRef.current === 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.textAlign = 'center';
        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = '#ffdd00';
        ctx.fillText('NIBBLER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
        if (Math.floor(Date.now() / 500) % 2 === 0) {
          ctx.font = '10px "Press Start 2P"';
          ctx.fillStyle = '#fff';
          ctx.fillText('PREMI START', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 40);
        }
      }

      if (gameStateRef.current === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.textAlign = 'center';
        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = '#ff2020';
        ctx.fillText('GAME OVER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#fff';
        ctx.fillText(`SCORE: ${scoreRef.current}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState]);

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center bg-black p-8 relative">
      {/* HUD */}
      <div className="w-full max-w-[560px] flex justify-between items-center mb-6 font-press-start text-[10px] text-arcade-yellow">
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

      {/* Canvas */}
      <div className="relative p-2 bg-arcade-border rounded shadow-[0_0_20px_rgba(26,79,255,0.4)]">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block bg-black"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Controls */}
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
