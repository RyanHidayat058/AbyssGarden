import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found!');
  }

  const game = new Game(canvas);

  window.addEventListener('resize', () => {
    game.resize(window.innerWidth, window.innerHeight);
  });

  game.start();
  console.log('🌊 Abyss Garden initialized successfully! Dive deep and cultivate the seabed.');
});
