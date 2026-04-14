// Game.js - Keyboard movement for character using ColoredPoints.js logic

// Character position in WebGL clip space
let charX = 0.0;
let charY = 0.0;
const charSpeed = 0.05; // Increased movement step per frame

let characterActive = false;
let gameActive = false;
let gameOver = false;
let gameStartTime = 0;
let currentTime = 0;
let highScore = parseFloat(localStorage.getItem('dodgeHighScore')) || 0;

/**
 * Updates the high score display element with the current best time.
 */
function updateHighScoreDisplay() {
  const el = document.getElementById('highScoreDisplay');
  if (el) {
    el.textContent = highScore > 0 ? 'Best: ' + highScore.toFixed(1) + 's' : '';
  }
}

/**
 * Updates the timer display element with the current elapsed time.
 */
function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (el) {
    el.textContent = 'Time: ' + currentTime.toFixed(1) + 's';
  }
}

/**
 * Resets all game state (positions, velocities, timer) for a new round.
 */
function resetGame() {
  charX = 0.0;
  charY = 0.0;
  monsterX = 0.5;
  monsterY = 0.5;
  monsterVX = 0.015;
  monsterVY = 0.025;
  gameOver = false;
  gameStartTime = performance.now();
  currentTime = 0;
}

// Listen for Draw Character button
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('linkButton');
  if (btn) {
    btn.addEventListener('click', () => {
      characterActive = true;
      animateGame();
    });
  }

  const playBtn = document.getElementById('playGameButton');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (gameOver) {
        resetGame();
        playBtn.textContent = 'Play Game';
      }
      gameActive = true;
      gameStartTime = performance.now();
      document.getElementById('gameMessage').style.display = 'block';
      document.getElementById('gameOverMessage').style.display = 'none';
      document.getElementById('timerDisplay').style.display = 'block';
      updateHighScoreDisplay();
      characterActive = true;
      animateGame();
    });
  }
});

// Update keyboard handler to only move if characterActive and not game over
window.addEventListener('keydown', function(e) {
  if (!characterActive || gameOver) return;
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
      charX -= charSpeed;
      break;
    case 'ArrowRight':
    case 'd':
      charX += charSpeed;
      break;
    case 'ArrowUp':
    case 'w':
      charY += charSpeed;
      break;
    case 'ArrowDown':
    case 's':
      charY -= charSpeed;
      break;
  }
  drawMovingCharacter();
});

/**
 * Draws the player character at its current position using drawLinkArtAt.
 */
function drawMovingCharacter() {
  if (typeof drawLinkArtAt === 'function') {
    drawLinkArtAt(charX, charY);
  }
}

// --- Monster pixel art and palette ---
const MONSTER_RADIUS = 0.08;
const MONSTER_SEGMENTS = 16;
const MONSTER_COLOR = [0.9, 0.15, 0.05, 1.0]; // Fireball red

let monsterX = 0.5; // Start near right
let monsterY = 0.5;
let monsterVX = 0.015; // Velocity
let monsterVY = 0.025;

/**
 * Draws the fireball monster as a red filled circle at the given position.
 * @param {number} x - X coordinate in clip space.
 * @param {number} y - Y coordinate in clip space.
 */
function drawMonsterAt(x, y) {
  const angleStep = (2 * Math.PI) / MONSTER_SEGMENTS;
  for (let i = 0; i < MONSTER_SEGMENTS; i++) {
    const a1 = i * angleStep;
    const a2 = (i + 1) * angleStep;
    gl.uniform4f(u_FragColor, MONSTER_COLOR[0], MONSTER_COLOR[1], MONSTER_COLOR[2], MONSTER_COLOR[3]);
    drawTriangle([
      x, y,
      x + Math.cos(a1) * MONSTER_RADIUS, y + Math.sin(a1) * MONSTER_RADIUS,
      x + Math.cos(a2) * MONSTER_RADIUS, y + Math.sin(a2) * MONSTER_RADIUS
    ]);
  }
}

/**
 * Updates the monster's position and reverses velocity on edge collision.
 */
function updateMonster() {
  monsterX += monsterVX;
  monsterY += monsterVY;
  // Bounce off edges
  if (monsterX > 1 || monsterX < -1) monsterVX *= -1;
  if (monsterY > 1 || monsterY < -1) monsterVY *= -1;
}

/**
 * Checks whether the player character and monster are overlapping.
 * @returns {boolean} True if the character and monster collide.
 */
function checkCollision() {
  const dx = charX - monsterX;
  const dy = charY - monsterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < MONSTER_RADIUS + 0.1;
}

/**
 * Main animation loop. Draws the character and monster each frame,
 * checks for collisions, updates the timer, and handles game over.
 * Only runs after the character has been activated.
 */
function animateGame() {
  if (!characterActive || gameOver) return;
  // Draw player character (this clears canvas and renders g_shapesList)
  if (typeof drawLinkArtAt === 'function') {
    drawLinkArtAt(charX, charY);
  }
  // Draw monster only if game is active
  if (gameActive) {
    updateMonster();
    drawMonsterAt(monsterX, monsterY);
    // Check collision
    if (checkCollision()) {
      gameOver = true;
      gameActive = false;
      // Save high score
      if (currentTime > highScore) {
        highScore = currentTime;
        localStorage.setItem('dodgeHighScore', highScore.toFixed(1));
      }
      document.getElementById('gameMessage').style.display = 'none';
      document.getElementById('gameOverMessage').style.display = 'block';
      document.getElementById('playGameButton').textContent = 'Play Again';
      updateHighScoreDisplay();
      return;
    }
    // Update timer
    currentTime = (performance.now() - gameStartTime) / 1000;
    updateTimerDisplay();
  }
  // Schedule next frame
  requestAnimationFrame(animateGame);
}
