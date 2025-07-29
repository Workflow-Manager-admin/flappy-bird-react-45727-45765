import React, { useRef, useEffect, useState } from "react";
import "./Game.css";

// Color Constants from style guide:
const COLOR_BG = "#f8f9fa";
const COLOR_PIPE = "#1e90ff";
const COLOR_PIPE_BORDER = "#1280c9";
const COLOR_BIRD = "#ffeb3b";
const COLOR_BIRD_STROKE = "#bfa40d";
const COLOR_ACCENT = "#ff5722";
const COLOR_GROUND = "#ffe0b2";
const COLOR_SCORE = "#ff5722";

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 520;
const GROUND_HEIGHT = 80;

const BIRD_RADIUS = 18;
const BIRD_START_X = CANVAS_WIDTH / 3;
const BIRD_START_Y = CANVAS_HEIGHT / 2;
const GRAVITY = 0.68;
const FLAP_STRENGTH = -8;
const PIPE_WIDTH = 64;
const PIPE_GAP = 140;
const PIPE_VEL = 2.5;
const MIN_PIPE_TOP = 54;

const FPS = 60;
const BIRD_ANIM_PERIOD = 180; // ms to change flap frame

// PUBLIC_INTERFACE
/**
 * Game React component - Flappy Bird logic & UI
 */
export default function Game() {
  const canvasRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(
    () => parseInt(window.localStorage.getItem("bestScore")) || 0
  );

  // Bird state
  const [bird, setBird] = useState({
    x: BIRD_START_X,
    y: BIRD_START_Y,
    vel: 0,
    radius: BIRD_RADIUS,
    rot: 0, // for animation
    animFrame: 0,
    time: 0,
  });

  // Pipes: Array of { x, gapY }
  const [pipes, setPipes] = useState([
    {
      x: CANVAS_WIDTH + 100,
      gapY: getPipeGapY(),
      passed: false,
    },
    {
      x: CANVAS_WIDTH + 100 + (CANVAS_WIDTH + PIPE_WIDTH) / 2,
      gapY: getPipeGapY(),
      passed: false,
    },
  ]);

  /**
   * Helper for random pipe gap vertical position
   */
  function getPipeGapY() {
    // vertical space for pipe gap
    return (
      Math.floor(
        Math.random() * (CANVAS_HEIGHT - PIPE_GAP - GROUND_HEIGHT - MIN_PIPE_TOP * 2)
      ) + MIN_PIPE_TOP
    );
  }

  // Start the game
  function startGame() {
    setGameOver(false);
    setScore(0);

    setBird({
      x: BIRD_START_X,
      y: BIRD_START_Y,
      vel: 0,
      radius: BIRD_RADIUS,
      rot: 0,
      animFrame: 0,
      time: 0,
    });

    setPipes([
      {
        x: CANVAS_WIDTH + 100,
        gapY: getPipeGapY(),
        passed: false,
      },
      {
        x: CANVAS_WIDTH + 100 + (CANVAS_WIDTH + PIPE_WIDTH) / 2,
        gapY: getPipeGapY(),
        passed: false,
      },
    ]);

    setRunning(true);
  }

  // Flap up
  function flap() {
    if (!running) {
      startGame();
    }
    setBird((curr) => ({
      ...curr,
      vel: FLAP_STRENGTH,
      time: 0, // reset for anim
    }));
  }

  // Keyboard and touch controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        if (gameOver) {
          startGame();
        } else {
          flap();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line
  }, [gameOver, running]);

  useEffect(() => {
    const handleTap = (e) => {
      e.preventDefault();
      if (gameOver) {
        startGame();
      } else {
        flap();
      }
    };
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("touchstart", handleTap, { passive: false });
      canvas.addEventListener("mousedown", handleTap, { passive: false });
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTap);
        canvas.removeEventListener("mousedown", handleTap);
      }
    };
    // eslint-disable-next-line
  }, [gameOver, running]);

  // Animation/game loop
  useEffect(() => {
    let reqId = null;
    let lastTimestamp = null;
    let birdAnimAcc = 0;

    const animate = (timestamp) => {
      if (!running) {
        drawToCanvas();
        return;
      }

      if (!lastTimestamp) lastTimestamp = timestamp;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.035); // cap for stability
      lastTimestamp = timestamp;

      // Bird
      setBird((prev) => {
        let vel = prev.vel + GRAVITY;
        let y = prev.y + vel;
        let rot =
          Math.atan2(vel, 7) * (180 / Math.PI); // -90 (up) to ~60 (down)
        let animFrame = prev.animFrame;
        let time = prev.time + (dt * 1000);
        if (time > BIRD_ANIM_PERIOD) {
          animFrame = (animFrame + 1) % 3;
          time = 0;
        }
        return { ...prev, y, vel, rot, animFrame, time };
      });

      // Pipes
      setPipes((prevPipes) => {
        let next = prevPipes.map((pipe) => ({
          ...pipe,
          x: pipe.x - PIPE_VEL,
        }));
        if (next[0].x < -PIPE_WIDTH) {
          next.shift();
          next.push({
            x: next[next.length - 1].x + (CANVAS_WIDTH + PIPE_WIDTH) / 2,
            gapY: getPipeGapY(),
            passed: false,
          });
        }
        return next;
      });

      // Score, Collision, Game over
      setPipes((prevPipes) => {
        let didScore = false;
        let nextPipes = prevPipes.map((pipe) => {
          if (
            !pipe.passed &&
            pipe.x + PIPE_WIDTH < BIRD_START_X
          ) {
            didScore = true;
            return { ...pipe, passed: true };
          }
          return pipe;
        });
        if (didScore) {
          setScore((s) => s + 1);
        }
        return nextPipes;
      });

      // Collision check and game over
      setBird((currBird) => {
        if (
          // Top / bottom ground
          currBird.y + currBird.radius > CANVAS_HEIGHT - GROUND_HEIGHT ||
          currBird.y - currBird.radius < 0
        ) {
          if (!gameOver) finishGame();
          return { ...currBird, vel: 0 };
        }

        // Pipe collision
        for (const pipe of pipes) {
          if (
            BIRD_START_X + currBird.radius > pipe.x &&
            BIRD_START_X - currBird.radius < pipe.x + PIPE_WIDTH
          ) {
            // Check for hit
            if (
              currBird.y - currBird.radius < pipe.gapY ||
              currBird.y + currBird.radius > pipe.gapY + PIPE_GAP
            ) {
              if (!gameOver) finishGame();
              return { ...currBird, vel: 0 };
            }
          }
        }
        return currBird;
      });

      drawToCanvas();
      reqId = requestAnimationFrame(animate);
    };

    if (running) {
      reqId = requestAnimationFrame(animate);
    } else {
      drawToCanvas();
    }
    return () => {
      reqId && cancelAnimationFrame(reqId);
      lastTimestamp = null;
      birdAnimAcc = 0;
    };
    // eslint-disable-next-line
  }, [running, pipes, gameOver]);

  // Draw game state to canvas
  function drawToCanvas() {
    const ctx = canvasRef.current.getContext("2d");
    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pipes
    pipes.forEach((pipe) => drawPipe(ctx, pipe.x, pipe.gapY));

    // Ground
    ctx.fillStyle = COLOR_GROUND;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

    // Bird (animated ellipse, 3 frame wings)
    drawBird(ctx, bird);

    // Score in center (during game)
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "38px Arial Black, Arial, sans-serif";
    ctx.fillStyle = COLOR_SCORE;
    ctx.lineWidth = 4;
    if (!gameOver) {
      ctx.strokeStyle = "#fff";
      ctx.strokeText(`${score}`, CANVAS_WIDTH / 2, 90);
      ctx.fillText(`${score}`, CANVAS_WIDTH / 2, 90);
    } else {
      // Game Over overlays handled by UI
      ctx.strokeStyle = COLOR_SCORE;
      ctx.strokeText(`${score}`, CANVAS_WIDTH / 2, 120);
      ctx.fillText(`${score}`, CANVAS_WIDTH / 2, 120);
    }
    ctx.restore();
  }

  // Pipe drawing
  function drawPipe(ctx, x, gapY) {
    ctx.save();
    // Upper pipe
    ctx.fillStyle = COLOR_PIPE;
    ctx.strokeStyle = COLOR_PIPE_BORDER;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(x, 0, PIPE_WIDTH, gapY);
    ctx.fill();
    ctx.stroke();

    // Lower pipe
    ctx.beginPath();
    ctx.rect(x, gapY + PIPE_GAP, PIPE_WIDTH, CANVAS_HEIGHT - gapY - PIPE_GAP - GROUND_HEIGHT);
    ctx.fill();
    ctx.stroke();

    // Pipe border accent (shadow)
    ctx.restore();
  }

  // Bird drawing (3-frame flapping animation using arc and wings)
  function drawBird(ctx, b) {
    ctx.save();
    ctx.translate(BIRD_START_X, b.y);
    ctx.rotate((b.rot * Math.PI) / 180);

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = COLOR_BIRD;
    ctx.strokeStyle = COLOR_BIRD_STROKE;
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.beginPath();
    ctx.arc(7, -7, 5, 0, Math.PI * 2, false);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -8, 2.2, 0, Math.PI * 2, false);
    ctx.fillStyle = "#222";
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(b.radius - 4, 0);
    ctx.lineTo(b.radius + 8, -6);
    ctx.lineTo(b.radius + 8, 6);
    ctx.closePath();
    ctx.fillStyle = COLOR_ACCENT;
    ctx.strokeStyle = "#c94d1b";
    ctx.fill();
    ctx.stroke();

    // Wings (animated: down, up, middle)
    ctx.save();
    ctx.rotate(-Math.PI / 8);
    ctx.beginPath();
    if (b.animFrame === 0) {
      ctx.ellipse(-2, 8, 14, 6, Math.PI / 12, 0, Math.PI * 2);
    } else if (b.animFrame === 1) {
      ctx.ellipse(-2, 2, 14, 6, -Math.PI / 5, 0, Math.PI * 2);
    } else {
      ctx.ellipse(-2, 12, 12, 5, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#fffd8a";
    ctx.strokeStyle = "#bfa841";
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // Game finished
  function finishGame() {
    setRunning(false);
    setGameOver(true);
    setBestScore((prevBest) => {
      if (score > prevBest) {
        window.localStorage.setItem("bestScore", score);
        return score;
      }
      return prevBest;
    });
  }

  // Restart button on overlay
  function handleRestartClick() {
    startGame();
  }

  return (
    <div className="game-container">
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          tabIndex={0}
          className={`game-canvas${gameOver ? " gameover" : ""}`}
          aria-label="Flappy Bird Game"
        />
        {gameOver && (
          <div className="overlay">
            <div className="gameover-panel">
              <h2 className="gameover-title">Game Over</h2>
              <div className="score-section">
                <div>Your Score: <strong>{score}</strong></div>
                <div>Best: <strong>{bestScore}</strong></div>
              </div>
              <button className="restart-btn" onClick={handleRestartClick}>
                Restart
              </button>
              <div className="play-tip">
                Press [Space], [↑] or Tap to flap & start
              </div>
            </div>
          </div>
        )}
        {!running && !gameOver && (
          <div className="overlay">
            <div className="getready-panel">
              <h2 className="getready-title">Tap / [Space] to Flap!</h2>
              <div className="play-tip">Avoid pipes, get a high score!</div>
              <button
                className="restart-btn"
                onClick={startGame}
                aria-label="Start Game"
              >
                Start
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
