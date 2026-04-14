import React from 'react';

export default function EditorialPanel() {
  return (
    <div className="p-8 bg-black">
      <header className="mb-12">
        <h1 className="text-4xl mb-2 tracking-tighter">NIBBLER</h1>
        <p className="text-arcade-yellow opacity-80 text-xl">Arcade Web Experience</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl mb-4">01. STORIA</h2>
        <p className="text-arcade-white leading-relaxed">
          Nibbler è un videogioco arcade pubblicato nel 1982 da <span className="text-arcade-yellow">Rock-Ola</span>. 
          È stato il primo gioco a permettere un punteggio di un miliardo di punti. 
          Originariamente distribuito nei bar americani, divenne presto un fenomeno culturale per la sua 
          difficoltà leggendaria e il gameplay ipnotico.
        </p>
      </section>

        <img
          src="/Cabinato.webp"
          alt="Cabinato originale Nibbler Rock-Ola 1982"
          className="w-full rounded-lg border-2 border-arcade-blue shadow-[0_0_20px_rgba(26,79,255,0.4)] mb-10"
        />

      <section className="mb-10">
        <h2 className="text-xl mb-4">02. MECCANICA DI GIOCO</h2>
        <p className="text-arcade-white leading-relaxed">
          Il giocatore controlla un serpente che si muove automaticamente all'interno di un labirinto. 
          L'obiettivo è mangiare tutto il cibo presente per avanzare al livello successivo. 
          Ogni volta che il serpente mangia, cresce in lunghezza, rendendo la navigazione sempre più complessa. 
          La velocità aumenta costantemente, mettendo alla prova i riflessi più pronti.
        </p>
      </section>

        <img
          src="/Screenshot.png"
          alt="Screenshot gameplay Nibbler"
          className="w-full rounded-lg border-2 border-arcade-blue shadow-[0_0_20px_rgba(26,79,255,0.4)] mb-10"
        />

      <section className="mb-10">
        <h2 className="text-xl mb-4">03. VARIANTI E CLONI</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {['C64', 'Atari', 'ZX Spectrum', 'Apple II', 'ColecoVision'].map(platform => (
            <span key={platform} className="px-2 py-1 bg-arcade-wall text-xs font-press-start text-white rounded border border-arcade-blue">
              {platform}
            </span>
          ))}
        </div>
        <p className="text-arcade-white leading-relaxed italic opacity-70">
          Il successo di Nibbler portò a numerose conversioni per home computer, ognuna con le proprie 
          sfumature grafiche e sonore, mantenendo però intatto lo spirito dell'originale.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl mb-4">04. RECORD MONDIALE</h2>
        <div className="p-4 border-2 border-arcade-blue bg-arcade-wall/20 rounded-lg mb-4">
          <h3 className="text-sm mb-2 text-arcade-white">TIM MCVEY: IL MILIARDO</h3>
          <p className="text-arcade-white text-sm leading-relaxed">
            Nel 1984, Tim McVey divenne la prima persona a superare il miliardo di punti in un arcade, 
            giocando per oltre 44 ore consecutive. Questa impresa è celebrata nel documentario 
            <span className="text-arcade-yellow italic"> "Man vs Snake" (2015)</span>.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl mb-4">05. CULTURA POP</h2>
        <p className="text-arcade-white leading-relaxed">
          Nibbler ha lasciato un segno indelebile nell'era d'oro degli arcade (1978-1983). 
          Il suo nome è stato persino ripreso per il personaggio di <span className="text-arcade-yellow">Futurama</span>, 
          un omaggio diretto dei creatori alla storia del videogioco.
        </p>
      </section>

      <footer className="mt-20 pt-8 border-t border-arcade-wall/30 text-xs opacity-50 font-press-start">
        <p>© 2026 NIBBLER WEB EXPERIENCE - CONFIDENTIAL</p>
      </footer>
    </div>
  );
}
