import React, { useState, useEffect } from "react";
import "./App.css";
import Game from "./Game";

// PUBLIC_INTERFACE
function App() {
  // Theme switch preserved for example, but game is always modern light themed
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <div className="App">
      <header className="app-header score-header">
        <h1 className="game-title">Flappy Bird</h1>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
      </header>
      <main>
        <Game />
      </main>
      <footer className="footer">
        <span>
          <strong>Controls:</strong> [Space] / [Arrow Up] / Tap
        </span>
        <span className="author-note">
          React {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}

export default App;
