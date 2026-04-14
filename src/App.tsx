import React from 'react';
import EditorialPanel from './components/EditorialPanel';
import GamePanel from './components/GamePanel';

export default function App() {
  return (
    <div className="relative w-full bg-black">
      {/* CRT Scanlines Overlay */}
      <div className="scanlines" />

      {/* Single Column Layout */}
      <div className="relative max-w-3xl mx-auto">
        <EditorialPanel />

        {/* Horizontal Divider */}
        <div className="w-full h-1 bg-arcade-border shadow-[0_0_15px_rgba(26,79,255,0.8)]" />

        <GamePanel />
      </div>
    </div>
  );
}
