import React from 'react';
import EditorialPanel from './components/EditorialPanel';
import GamePanel from './components/GamePanel';

export default function App() {
  return (
    <div className="relative w-full h-screen flex overflow-hidden bg-black">
      {/* CRT Scanlines Overlay */}
      <div className="scanlines" />

      {/* Main Layout */}
      <div className="flex w-full h-full relative">
        {/* Left Panel: Editorial */}
        <div className="w-1/2 h-full">
          <EditorialPanel />
        </div>

        {/* Electric Blue Divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-arcade-border z-10 shadow-[0_0_15px_rgba(26,79,255,0.8)]" />

        {/* Right Panel: Game */}
        <div className="w-1/2 h-full">
          <GamePanel />
        </div>
      </div>

      {/* Decorative Border Overlay (Cabinet feel) */}
      <div className="pointer-events-none absolute inset-0 border-[12px] border-arcade-black z-50 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />
    </div>
  );
}
