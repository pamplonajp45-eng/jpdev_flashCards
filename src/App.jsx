import { useState, useEffect } from "react";

const STORAGE_KEY = "jpdeck_cards";

function loadCards() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

// A single flashcard: front/back, flipped state, grade button actions
function Flashcard({ card, onGrade }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={styles.cardWrapper}>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          ...styles.card,
          background: flipped ? "#1a1a2e" : "#16213e",
          cursor: "pointer",
        }}
      >
        <span style={styles.cardLabel}>{flipped ? "BACK" : "FRONT"}</span>
        <p style={styles.cardText}>{flipped ? card.back : card.front}</p>
        <span style={styles.flipHint}>{flipped ? "click to flip back" : "click to reveal answer"}</span>
      </div>

      {flipped && (
        <div style={styles.gradeRow}>
          <span style={styles.gradeLabel}>How did you do?</span>
          <div style={styles.gradeBtns}>
            <button style={{ ...styles.gradeBtn, ...styles.easy }} onClick={() => onGrade(card.id, "easy")}>✅ Easy</button>
            <button style={{ ...styles.gradeBtn, ...styles.medium }} onClick={() => onGrade(card.id, "medium")}>🟡 Medium</button>
            <button style={{ ...styles.gradeBtn, ...styles.hard }} onClick={() => onGrade(card.id, "hard")}>🔴 Hard</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JpDeck() {
  const [cards, setCards] = useState(loadCards);
  const [section, setSection] = useState("add"); // "add" | "study"
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  // Study session state
  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);

  useEffect(() => saveCards(cards), [cards]);

  // Build study queue when entering study section
  useEffect(() => {
    if (section === "study") {
      const queue = cards.filter((c) => c.grade !== "easy");
      setStudyQueue(queue);
      setStudyIndex(0);
      setSessionDone(queue.length === 0);
    }
  }, [section]);

  function addCard() {
    if (!front.trim() || !back.trim()) return;
    const newCard = {
      id: Date.now(),
      front: front.trim(),
      back: back.trim(),
      grade: null, // null | "easy" | "medium" | "hard"
    };
    setCards((prev) => [...prev, newCard]);
    setFront("");
    setBack("");
  }

  function handleGrade(id, grade) {
    // Update the card's grade in persistent storage
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, grade } : c))
    );

    // If hard/medium, push card to end of queue so it repeats
    if (grade === "hard" || grade === "medium") {
      const card = studyQueue[studyIndex];
      const newQueue = [...studyQueue.slice(studyIndex + 1), card];
      setStudyQueue(newQueue);
      setStudyIndex(0);
      if (newQueue.length === 0) setSessionDone(true);
    } else {
      // easy — remove from queue
      const newQueue = studyQueue.filter((c) => c.id !== id);
      if (newQueue.length === 0) {
        setSessionDone(true);
      } else {
        setStudyIndex((i) => Math.min(i, newQueue.length - 1));
        setStudyQueue(newQueue);
      }
    }
  }

  function deleteCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function resetGrades() {
    setCards((prev) => prev.map((c) => ({ ...c, grade: null })));
    setSessionDone(false);
    const queue = cards.map((c) => ({ ...c, grade: null }));
    setStudyQueue(queue);
    setStudyIndex(0);
  }

  const currentCard = studyQueue[studyIndex];
  const easyCount = cards.filter((c) => c.grade === "easy").length;

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>jp<span style={styles.accent}>DECK</span></h1>
        <p style={styles.subtitle}>FLASHCARDS</p>
        <nav style={styles.nav}>
          <button
            onClick={() => setSection("add")}
            style={{ ...styles.navBtn, ...(section === "add" ? styles.navActive : {}) }}
          >
            ＋ Add Cards
          </button>
          <button
            onClick={() => setSection("study")}
            style={{ ...styles.navBtn, ...(section === "study" ? styles.navActive : {}) }}
          >
            📖 Study
          </button>
        </nav>
      </header>

      {/* ADD SECTION */}
      {section === "add" && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Add a New Card</h2>
          <div style={styles.form}>
            <input
              style={styles.input}
              placeholder="Front (e.g. こんにちは)"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCard()}
            />
            <input
              style={styles.input}
              placeholder="Back (e.g. Hello)"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCard()}
            />
            <button style={styles.addBtn} onClick={addCard}>Add Card</button>
          </div>

          <h2 style={{ ...styles.sectionTitle, marginTop: 40 }}>
            Your Deck ({cards.length} cards)
          </h2>
          {cards.length === 0 && (
            <p style={styles.empty}>No cards yet. Add some above!</p>
          )}
          <div style={styles.deckList}>
            {cards.map((c) => (
              <div key={c.id} style={styles.deckItem}>
                <div style={styles.deckItemContent}>
                  <span style={styles.deckFront}>{c.front}</span>
                  <span style={styles.deckArrow}>→</span>
                  <span style={styles.deckBack}>{c.back}</span>
                </div>
                <div style={styles.deckItemRight}>
                  {c.grade && (
                    <span style={{
                      ...styles.gradePill,
                      background: c.grade === "easy" ? "#1a3a2a" : c.grade === "hard" ? "#3a1a1a" : "#3a3a1a",
                      color: c.grade === "easy" ? "#4caf50" : c.grade === "hard" ? "#f44336" : "#ffeb3b",
                    }}>
                      {c.grade}
                    </span>
                  )}
                  <button style={styles.deleteBtn} onClick={() => deleteCard(c.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STUDY SECTION */}
      {section === "study" && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Study Session</h2>

          {cards.length === 0 && (
            <p style={styles.empty}>No cards in your deck. Go add some first!</p>
          )}

          {cards.length > 0 && sessionDone && (
            <div style={styles.doneBanner}>
              <div style={styles.doneEmoji}>🎉</div>
              <h3 style={styles.doneTitle}>All done!</h3>
              <p style={styles.doneSub}>
                {easyCount} of {cards.length} cards marked easy.
              </p>
              <button style={styles.addBtn} onClick={resetGrades}>
                Reset & Study Again
              </button>
            </div>
          )}

          {cards.length > 0 && !sessionDone && currentCard && (
            <>
              <div style={styles.progress}>
                <span style={styles.progressText}>
                  {studyQueue.length} card{studyQueue.length !== 1 ? "s" : ""} remaining • {easyCount} mastered
                </span>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${(easyCount / cards.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <Flashcard key={currentCard.id + studyIndex} card={currentCard} onGrade={handleGrade} />
              <p style={styles.honesty}>
                Be honest — your grades shape how often cards repeat 🙏
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0d0d1a",
    color: "#e0e0f0",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "0 0 60px",
  },
  header: {
    textAlign: "center",
    padding: "40px 20px 20px",
    borderBottom: "1px solid #1e1e3a",
    marginBottom: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: 900,
    margin: 0,
    letterSpacing: "-1px",
    color: "#e0e0f0",
  },
  accent: {
    color: "#7c6af7",
  },
  subtitle: {
    margin: "6px 0 24px",
    color: "#666",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  nav: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  navBtn: {
    padding: "10px 28px",
    borderRadius: 8,
    border: "1px solid #2a2a4a",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  navActive: {
    background: "#7c6af7",
    borderColor: "#7c6af7",
    color: "#fff",
  },
  section: {
    maxWidth: 620,
    margin: "0 auto",
    padding: "0 20px",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 20,
    color: "#c0c0e0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px solid #2a2a4a",
    background: "#13132a",
    color: "#e0e0f0",
    fontSize: 16,
    outline: "none",
  },
  addBtn: {
    padding: "14px",
    borderRadius: 8,
    border: "none",
    background: "#7c6af7",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  deckList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  deckItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "#13132a",
    borderRadius: 8,
    border: "1px solid #1e1e3a",
  },
  deckItemContent: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  deckFront: {
    fontWeight: 600,
    color: "#e0e0f0",
    fontSize: 15,
  },
  deckArrow: {
    color: "#444",
  },
  deckBack: {
    color: "#888",
    fontSize: 15,
  },
  deckItemRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  gradePill: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#555",
    cursor: "pointer",
    fontSize: 16,
    padding: "2px 6px",
  },
  empty: {
    color: "#555",
    textAlign: "center",
    padding: "40px 0",
  },
  cardWrapper: {
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    border: "1px solid #2a2a4a",
    padding: "50px 30px",
    textAlign: "center",
    position: "relative",
    userSelect: "none",
    transition: "background 0.3s",
  },
  cardLabel: {
    position: "absolute",
    top: 16,
    left: 20,
    fontSize: 11,
    letterSpacing: 2,
    color: "#444",
    textTransform: "uppercase",
  },
  cardText: {
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
    color: "#e0e0f0",
  },
  flipHint: {
    position: "absolute",
    bottom: 16,
    right: 20,
    fontSize: 11,
    color: "#444",
    letterSpacing: 1,
  },
  gradeRow: {
    marginTop: 16,
    textAlign: "center",
  },
  gradeLabel: {
    display: "block",
    color: "#666",
    fontSize: 13,
    marginBottom: 10,
  },
  gradeBtns: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  },
  gradeBtn: {
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
  },
  easy: { background: "#1a3a2a", color: "#4caf50" },
  medium: { background: "#3a3a1a", color: "#ffeb3b" },
  hard: { background: "#3a1a1a", color: "#f44336" },
  progress: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 13,
    color: "#666",
    display: "block",
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    background: "#1e1e3a",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#7c6af7",
    borderRadius: 99,
    transition: "width 0.4s ease",
  },
  honesty: {
    textAlign: "center",
    fontSize: 13,
    color: "#444",
    marginTop: 20,
  },
  doneBanner: {
    textAlign: "center",
    padding: "60px 20px",
  },
  doneEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#e0e0f0",
    margin: "0 0 8px",
  },
  doneSub: {
    color: "#666",
    marginBottom: 28,
  },
};