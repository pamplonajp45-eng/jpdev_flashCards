import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { getJapaneseMeaning, processBulkAI } from "./lib/gemini";
import { loadLessonFromExcel } from "./lib/excelLoader";
import finishSound from "./assets/when memorized all and finish studying.mp3";
import resetSound from "./assets/when reset and study again clicked.mp3";
import successIllu from "./assets/watercolor-chinese-style-illustration/7947569.jpg";
import Auth from "./assets/components/Auth";

function Flashcard({ card, onGrade }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="card-wrapper">
      <div
        className={`card ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="card-face card-front">
          <span className="card-face-label">FRONT</span>
          <p className="card-text">{card.front}</p>
          <span className="card-hint">tap to reveal ↓</span>
        </div>
        <div className="card-face card-back">
          <span className="card-face-label">BACK</span>
          <p className="card-text">{card.back}</p>
          <span className="card-hint">tap to flip back ↑</span>
        </div>
      </div>

      {flipped && (
        <div className="grade-row">
          <p className="grade-label">Be honest — how did you do?</p>
          <div className="grade-btns">
            <button
              className="grade-btn easy"
              onClick={() => onGrade(card.id, "easy")}
            >
              ✅ Easy
            </button>
            <button
              className="grade-btn medium"
              onClick={() => onGrade(card.id, "medium")}
            >
              🟡 Medium
            </button>
            <button
              className="grade-btn hard"
              onClick={() => onGrade(card.id, "hard")}
            >
              🔴 Hard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JpDeck() {
  const [autoFlip, setAutoFlip] = useState(false);
  const [session, setSession] = useState(null);
  const [cards, setCards] = useState([]);
  const [section, setSection] = useState("add");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [bulkText, setBulkText] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    async function fetchCards() {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error(
          "Supabase Fetch Error:",
          error.message,
          error.details,
          error.hint,
        );
        alert(
          `Supabase Error: ${error.message}. Please check if the 'cards' table exists in your dashboard.`,
        );
      }
      if (!error && data) {
        console.log("App Core Loaded: v2.2-auth");
        console.log("Database Connected: Fetched", data.length, "cards");
        setCards(data);
      }
    }
    fetchCards();
  }, [session]);

  useEffect(() => {
    if (section !== "study") {
      setSessionStarted(false);
      return;
    }
    if (!sessionStarted && !sessionDone) {
      const today = new Date().toISOString().split("T")[0];
      const queue = cards.filter((c) => !c.due_date || c.due_date <= today);
      setStudyQueue(queue);
      setStudyIndex(0);
      setSessionDone(queue.length === 0);
      setSessionStarted(true);
    }
  }, [section, sessionStarted, sessionDone]);

  useEffect(() => {
    if (sessionDone && section === "study" && cards.length > 0) {
      const audio = new Audio(finishSound);
      audio.volume = 0.6;
      audio.play().catch((e) => console.log("Audio play blocked:", e));
    }
  }, [sessionDone]);

  const playSound = (src) => {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch((e) => console.log("Audio play blocked:", e));
  };

  async function addCard() {
    if (!front.trim() || !back.trim()) return;

    const newCard = {
      front: front.trim(),
      back: back.trim(),
      grade: null,
      user_id: session.user.id,
    };

    const tempId = Date.now();
    setCards((prev) => [{ ...newCard, id: tempId }, ...prev]);
    setFront("");
    setBack("");

    const { data, error } = await supabase
      .from("cards")
      .insert([newCard])
      .select();

    if (!error && data) {
      setCards((prev) => {
        const tempExists = prev.some((c) => c.id === tempId);
        if (!tempExists) return prev;
        return prev.map((c) => (c.id === tempId ? data[0] : c));
      });
    }
  }

  async function handleAiSuggest() {
    if (!front.trim()) {
      alert("Please enter Japanese text in the Front field first!");
      return;
    }
    setIsAiLoading(true);
    const suggestion = await getJapaneseMeaning(front);
    if (suggestion) setBack(suggestion);
    setIsAiLoading(false);
  }

  async function handleGrade(id, grade) {
    const card = studyQueue[studyIndex];

    // SM-2 calculations
    let newInterval = card.interval || 1;
    let newEase = card.ease_factor || 2.5;

    if (grade === "hard") {
      // Forgot it — reset
      newInterval = 1;
      newEase = Math.max(1.3, newEase - 0.2);
    } else if (grade === "medium") {
      // Struggled — grow slowly
      newInterval = Math.max(1, Math.round(newInterval * 1.2));
      newEase = Math.max(1.3, newEase - 0.15);
    } else if (grade === "easy") {
      // Got it — grow normally
      newInterval = Math.round(newInterval * newEase);
      newEase = Math.min(3.0, newEase + 0.1);
    }

    // Calculate next due date
    const due = new Date();
    due.setDate(due.getDate() + newInterval);
    const dueDateStr = due.toISOString().split("T")[0];

    // Update local state
    setCards((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
            ...c,
            interval: newInterval,
            ease_factor: newEase,
            due_date: dueDateStr,
          }
          : c,
      ),
    );

    // Sync to Supabase
    const { error } = await supabase
      .from("cards")
      .update({
        interval: newInterval,
        ease_factor: newEase,
        due_date: dueDateStr,
      })
      .eq("id", id);

    if (error) console.error("Grade sync failed:", error.message);

    // Queue management
    if (grade === "hard" || grade === "medium") {
      const newQueue = [...studyQueue.slice(studyIndex + 1), card];
      setStudyQueue(newQueue);
      setStudyIndex(0);
      if (newQueue.length === 0) setSessionDone(true);
      if (newQueue.length === 1) {
        setTimeout(() => setAutoFlip(true), 600);
      } else {
        setAutoFlip(false);
      }
    } else {
      // Easy — card is done for today
      if (grade === "easy");
      const newQueue = studyQueue.filter((c) => c.id !== id);
      setStudyQueue(newQueue);
      setStudyIndex(0);
      if (newQueue.length === 0) setSessionDone(true);
      setAutoFlip(false);
    }
  }

  async function resetGrades() {
    const today = new Date().toISOString().split("T")[0];
    const reset = cards.map((c) => ({
      ...c,
      interval: 1,
      ease_factor: 2.5,
      due_date: today,
    }));
    setCards(reset);
    setStudyQueue(reset);
    setStudyIndex(0);
    setSessionDone(false);
    setSessionStarted(false);
    playSound(resetSound);
    await supabase
      .from("cards")
      .update({ interval: 1, ease_factor: 2.5, due_date: today })
      .eq("user_id", session.user.id);
  }

  const handleNuclearReset = async () => {
    if (
      !window.confirm(
        "This will clear all branding caches and restart the app. Continue?",
      )
    )
      return;
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    window.location.reload(true);
  };

  async function clearAllCards() {
    if (
      !window.confirm(
        "⚠️ ARE YOU SURE?\nThis will permanently delete ALL your cards. This cannot be undone.",
      )
    )
      return;

    const { error } = await supabase
      .from("cards")
      .delete()
      .eq("user_id", session.user.id); // ✅ only delete own cards

    if (error) {
      alert("Error clearing deck: " + error.message);
    } else {
      setCards([]);
      if (section === "study") setSection("add");
    }
  }

  async function deleteCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("cards").delete().eq("id", id);
  }

  async function handleBulkAdd() {
    if (!bulkText.trim()) return;

    const lines = bulkText.split("\n");
    const newCards = [];

    lines.forEach((line) => {
      const parts = line.split(/[,\t]/);
      if (parts.length >= 2) {
        newCards.push({
          front: parts[0].trim(),
          back: parts[1].trim(),
          grade: null,
          user_id: session.user.id, // ✅ scoped to user
        });
      }
    });

    if (newCards.length === 0) {
      alert(
        "No valid cards found. Use 'Front, Back' or 'Front [Tab] Back' format.",
      );
      return;
    }

    setIsImporting(true);
    const { data, error } = await supabase
      .from("cards")
      .insert(newCards)
      .select();
    setIsImporting(false);

    if (!error && data) {
      setCards((prev) => [...data, ...prev]);
      setBulkText("");
      setShowBulkAdd(false);
      alert(`Imported ${newCards.length} cards!`);
    } else {
      alert("Error saving cards: " + (error?.message || "Unknown error"));
    }
  }

  async function handleBulkAiAdd() {
    if (!bulkText.trim()) {
      alert("Please paste a list of Japanese words first!");
      return;
    }

    setIsAiLoading(true);
    try {
      const aiCards = await processBulkAI(bulkText);
      if (aiCards.length === 0) {
        alert(
          "AI could not extract any cards from your text. Try a clearer list.",
        );
        return;
      }

      const aiCardsWithUser = aiCards.map((c) => ({
        ...c,
        user_id: session.user.id, // ✅ scoped to user
      }));

      const { data, error } = await supabase
        .from("cards")
        .insert(aiCardsWithUser)
        .select();
      if (!error && data) {
        setCards((prev) => [...data, ...prev]);
        setBulkText("");
        setShowBulkAdd(false);
        alert(
          `AI successfully generated and imported ${aiCards.length} cards!`,
        );
      } else {
        alert("Error saving AI cards: " + (error?.message || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("AI Processing failed: " + (e.message || "Unknown error"));
    } finally {
      setIsAiLoading(false);
    }
  }

  async function handleLessonGenerate(lessonFile, lessonName) {
    if (!window.confirm(`Are you sure you want to generate ${lessonName} flashcards? This will use the pre-defined vocabulary from the excel file.`)) {
      return;
    }

    setIsAiLoading(true);
    try {
      const lessonCards = await loadLessonFromExcel(lessonFile);
      if (lessonCards.length === 0) {
        alert("No cards found in the excel file.");
        return;
      }

      const cardsWithUser = lessonCards.map((c) => ({
        ...c,
        user_id: session.user.id,
      }));

      const { data, error } = await supabase
        .from("cards")
        .insert(cardsWithUser)
        .select();

      if (!error && data) {
        setCards((prev) => [...data, ...prev]);
        alert(`Successfully generated ${lessonCards.length} cards for ${lessonName}!`);
      } else {
        alert("Error saving lesson cards: " + (error?.message || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load lesson: " + (e.message || "Unknown error"));
    } finally {
      setIsAiLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setCards([]);
  }

  const currentCard = studyQueue[studyIndex];
  const today = new Date().toISOString().split("T")[0];
  const dueCount = cards.filter(
    (c) => !c.due_date || c.due_date <= today,
  ).length;

  // ── Guard: show auth screen if not logged in
  if (!session) return <Auth onLogin={(s) => setSession(s)} />;

  return (
    <>
      <style>{CSS}</style>
      <div className="app-bg">
        <img src={successIllu} alt="" />
      </div>
      <div className="app">
        <header className="header">
          <div className="logo">
            <span id="brand-fix-check" className="logo-jp">
              JP
            </span>
            <span className="logo-deck">DECK</span>
            <button
              onClick={handleNuclearReset}
              style={{
                fontSize: "8px",
                opacity: 0.1,
                marginLeft: "8px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                cursor: "help",
              }}
            >
              (v2.2 • Auth)
            </button>
          </div>
          <nav className="header-nav">
            <button
              className={`nav-btn ${section === "add" ? "active" : ""}`}
              onClick={() => setSection("add")}
            >
              ＋ Add Cards
            </button>
            <button
              className={`nav-btn ${section === "study" ? "active" : ""}`}
              onClick={() => setSection("study")}
            >
              Study
            </button>
            <button className="nav-btn logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </nav>
        </header>

        <main className="main">
          {section === "add" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", gap: "10px", flexWrap: "wrap" }}>
                <h2 className="section-title" style={{ margin: 0 }}>Add a Card</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select 
                    className="nav-btn" 
                    onChange={(e) => {
                      if (e.target.value) {
                        handleLessonGenerate(e.target.value, e.target.options[e.target.selectedIndex].text);
                        e.target.value = ""; // reset
                      }
                    }}
                    style={{ background: "var(--surface2)", padding: "10px 15px" }}
                  >
                    <option value="">📚 Select Lesson</option>
                    <option value="minna_nihongo_lesson1_v2 (1).xlsx">Minna no Nihongo Lesson 1</option>
                  </select>
                </div>
              </div>
              <div className="form">
                <div className="inputs-row">
                  <input
                    placeholder="Front (e.g. こんにちは)"
                    value={front}
                    onChange={(e) => setFront(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCard()}
                  />
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      placeholder="Back (e.g. Hello)"
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCard()}
                      style={{ paddingRight: "45px" }}
                    />
                    <button
                      onClick={handleAiSuggest}
                      disabled={isAiLoading}
                      title="AI Smart Fill"
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "var(--accent)",
                        border: "none",
                        fontSize: "18px",
                        cursor: "pointer",
                        opacity: isAiLoading ? 0.5 : 1,
                        padding: "4px",
                      }}
                    >
                      {isAiLoading ? "⌛" : "✨"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    className="add-btn"
                    onClick={addCard}
                    style={{ flex: "1 1 120px" }}
                  >
                    Add Card
                  </button>
                  <button
                    className={`nav-btn ${showBulkAdd ? "active" : ""}`}
                    onClick={() => setShowBulkAdd(!showBulkAdd)}
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      flex: "1 1 120px",
                      borderRadius: "10px",
                      color: "var(--text)",
                    }}
                  >
                    📝 Bulk Import
                  </button>
                </div>

                {showBulkAdd && (
                  <div
                    className="bulk-add"
                    style={{ marginTop: "16px", animation: "fadeUp .2s" }}
                  >
                    <textarea
                      placeholder="You can just paste nihongo text only in here:&#10;こんにちは,&#10;さようなら, &#10;(One card per line, use comma or tab)"
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      style={{
                        width: "100%",
                        height: "150px",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "12px",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontSize: "14px",
                        resize: "vertical",
                      }}
                    />
                    <div
                      style={{ display: "flex", gap: "8px", marginTop: "10px" }}
                    >
                      <button
                        className="add-btn"
                        onClick={handleBulkAiAdd}
                        disabled={isImporting || isAiLoading}
                        style={{
                          flex: 1,
                          background: "var(--accent)",
                          color: "#000",
                          fontWeight: "800",
                        }}
                      >
                        {isAiLoading
                          ? "jp DECK is Thinking..."
                          : "Auto Fill"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {cards.length > 0 && (
                <div className="stats-bar">
                  <div className="stat">
                    <div className="stat-num">{cards.length}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat">
                    <div className="stat-num" style={{ color: "var(--easy)" }}>
                      {dueCount}
                    </div>
                    <div className="stat-label">Due Today</div>
                  </div>
                  <div className="stat">
                    <div
                      className="stat-num"
                      style={{ color: "var(--medium)" }}
                    >
                      {
                        cards.filter(
                          (c) => c.interval > 1 && c.due_date > today,
                        ).length
                      }
                    </div>
                    <div className="stat-label">Learning</div>
                  </div>
                  <div className="stat">
                    <div className="stat-num">
                      {
                        cards.filter((c) => !c.due_date || c.interval === 1)
                          .length
                      }
                    </div>
                    <div className="stat-label">New</div>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h2 className="section-title" style={{ margin: 0 }}>
                  Your Deck
                </h2>
                {cards.length > 0 && (
                  <button
                    onClick={clearAllCards}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--hard)",
                      cursor: "pointer",
                      fontSize: "12px",
                      opacity: 0.7,
                    }}
                  >
                    🗑️ Clear All
                  </button>
                )}
              </div>
              {cards.length === 0 ? (
                <p className="empty">No cards yet — add some above!</p>
              ) : (
                <div className="deck-list">
                  {cards.map((c) => (
                    <div key={c.id} className="deck-item">
                      <div className="deck-content">
                        <span className="deck-front">{c.front}</span>
                        <span className="deck-arrow">→</span>
                        <span className="deck-back">{c.back}</span>
                      </div>
                      <div className="deck-right">
                        {c.due_date && c.due_date > today && (
                          <span className="grade-pill easy">
                            📅 {c.due_date}
                          </span>
                        )}
                        <button
                          className="del-btn"
                          onClick={() => deleteCard(c.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {section === "study" && (
            <>
              <h2 className="section-title">Study Session</h2>
              {cards.length === 0 && (
                <p className="empty">No cards yet — go add some first!</p>
              )}
              {cards.length > 0 && !sessionDone && currentCard && (
                <>
                  <div className="progress">
                    <div className="progress-meta">
                      <span className="progress-text">
                        {studyQueue.length} remaining ·{" "}
                        {cards.length - studyQueue.length} done
                      </span>
                      <span className="progress-pct">
                        {cards.length
                          ? Math.round(
                            ((cards.length - studyQueue.length) /
                              cards.length) *
                            100,
                          )
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${cards.length ? Math.round(((cards.length - studyQueue.length) / cards.length) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Flashcard
                    key={currentCard.id + "-" + studyIndex}
                    card={currentCard}
                    onGrade={handleGrade}
                  />
                  <p className="honesty-note">
                    Be honest — your grades shape how often cards repeat 🙏
                  </p>
                </>
              )}
              {cards.length > 0 && sessionDone && (
                <div className="done-banner highlighted">
                  <h3 className="done-title">
                    Don't forget to take breaks, CONGRATS!
                  </h3>
                  <p className="done-sub">
                    {cards.length - dueCount} of {cards.length} cards reviewed
                    today
                  </p>
                  <div className="done-actions">
                    <button
                      className="add-btn medium-btn reset-btn"
                      onClick={resetGrades}
                    >
                      Study Again
                    </button>
                    <button
                      className="add-btn medium-btn rest-btn"
                      onClick={() => setSection("add")}
                    >
                      Rest
                    </button>
                  </div>
                  <p
                    style={{
                      marginTop: "20px",
                      fontSize: "10px",
                      opacity: 0.3,
                      color: "var(--text)",
                    }}
                  >
                    by-jpdev
                  </p>
                </div>
              )}
            </>
          )}
        </main>

        <nav className="bottom-nav">
          <button
            className={`nav-btn ${section === "add" ? "active" : ""}`}
            onClick={() => setSection("add")}
          >
            ＋ Add
          </button>
          <button
            className={`nav-btn ${section === "study" ? "active" : ""}`}
            onClick={() => setSection("study")}
          >
            📖 Study
          </button>
          <button className="nav-btn logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </nav>
      </div>
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0b0b14;--surface:#131325;--surface2:#1a1a35;
  --border:#25254a;--accent:#a29bfe;--accent-glow:rgba(162,155,254,0.3);
  --text:#f0f0f7;--muted:#7c7c9c;
  --easy:#00d1a0;--medium:#ffcc66;--hard:#ff7675;
  --font-brand: 'Syne', sans-serif;
  --font-main: 'Inter', sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-main);min-height:100dvh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;}
.app{position:relative;display:flex;flex-direction:column;min-height:100dvh;z-index:1;}
.app-bg{position:fixed;inset:0;z-index:0;opacity:0.25;pointer-events:none;background:var(--bg);}
.app-bg img{width:100%;height:100%;object-fit:cover;mix-blend-mode:luminosity;filter:brightness(0.7);animation:slowZoom 30s infinite alternate ease-in-out;}
@keyframes slowZoom{from{transform:scale(1);}to{transform:scale(1.15);}}

.header{position:sticky;top:0;z-index:100;background:rgba(11,11,20,0.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:70px;}
.logo{display:flex;align-items:center;gap:4px;font-family:var(--font-brand);font-weight:900;font-size:26px;letter-spacing:-1px;}
.logo-jp{background:#fff;color:#000;padding:0 8px;border-radius:6px;line-height:1;display:inline-block;font-family:var(--font-brand);font-weight:900;}
.logo-deck{color:var(--accent);font-style:italic;transform:skewX(-5deg);display:inline-block;}

.header-nav{display:flex;gap:12px;}
.nav-btn{padding:10px 22px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-family:var(--font-brand);font-size:14px;font-weight:700;cursor:pointer;transition:all .25s ease;white-space:nowrap;}
.nav-btn:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-1px);}
.nav-btn.active{background:var(--accent);border-color:var(--accent);color:#000;box-shadow:0 0 20px var(--accent-glow);}
.logout-btn{color:var(--hard);border-color:var(--hard);}
.logout-btn:hover{background:var(--hard);color:#000;border-color:var(--hard);}

.main{flex:1;max-width:900px;width:100%;margin:0 auto;padding:40px 20px 100px;animation:fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1);}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}

.section-title{font-family:var(--font-brand);font-size:24px;font-weight:800;margin-bottom:24px;letter-spacing:-0.5px;}

.form{display:flex;flex-direction:column;gap:12px;margin-bottom:40px;background:var(--surface);padding:20px;border-radius:20px;border:1px solid var(--border);box-shadow:0 10px 30px rgba(0,0,0,0.2);}
.inputs-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
input{width:100%;padding:14px 18px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;color:var(--text);font-family:var(--font-main);font-size:16px;outline:none;transition:all .2s ease;}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.add-btn{padding:16px;border-radius:14px;border:none;background:var(--accent);color:#000;font-family:var(--font-brand);font-size:18px;font-weight:800;cursor:pointer;transition:all .2s cubic-bezier(0.175, 0.885, 0.32, 1.275);-webkit-user-select:none;user-select:none;}
.add-btn:hover{transform:scale(1.02);filter:brightness(1.1);}
.add-btn:active{transform:scale(0.97);}

.stats-bar{display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;margin-bottom:40px;}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px;text-align:center;transition:transform .2s;}
.stat:hover{transform:translateY(-4px);}
.stat-num{font-family:var(--font-brand);font-size:24px;font-weight:900;line-height:1;}
.stat-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:6px;font-weight:700;}

.deck-list{display:flex;flex-direction:column;gap:10px;}
.deck-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-radius:16px;background:var(--surface);border:1px solid var(--border);transition:all .2s;}
.deck-item:hover{border-color:var(--accent);background:var(--surface2);}
.deck-content{display:flex;align-items:center;gap:10px;min-width:0;flex:1;}
.deck-front{font-family:var(--font-brand);font-weight:800;font-size:15px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.deck-arrow{color:var(--muted);font-size:10px;flex-shrink:0;}
.deck-back{color:var(--accent);font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.deck-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.grade-pill{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;padding:3px 7px;border-radius:6px;white-space:nowrap;}
.grade-pill.easy{background:rgba(0,209,160,0.15);color:var(--easy);}
.grade-pill.medium{background:rgba(255,204,102,0.15);color:var(--medium);}
.grade-pill.hard{background:rgba(255,118,117,0.15);color:var(--hard);}
.del-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:6px 10px;border-radius:6px;transition:color .2s;}
.del-btn:hover{color:var(--hard);}
.empty{color:var(--muted);text-align:center;padding:40px 0;font-size:15px;}

.card-wrapper{perspective:1500px;margin-bottom:30px;width:100%;max-width:500px;margin-left:auto;margin-right:auto;}
.card{position:relative;width:100%;min-height:320px;transform-style:preserve-3d;transition:transform .6s cubic-bezier(0.34, 1.56, 0.64, 1);cursor:pointer;-webkit-user-select:none;user-select:none;}
.card.flipped{transform:rotateY(180deg);}
.card-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:28px;border:2px solid var(--border); overflow-y:auto; display:flex;flex-direction:column;align-items:center;justify-content:safe center;padding:30px;box-shadow:0 15px 40px rgba(0,0,0,0.4);}
.card-face::-webkit-scrollbar { width: 6px; }
.card-face::-webkit-scrollbar-track { background: transparent; }
.card-face::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
.card-face::-webkit-scrollbar-thumb:hover { background: var(--accent); }
.card-face-label{position:absolute;top:20px;left:24px;font-size:10px;font-weight:800;letter-spacing:2px;color:var(--muted);opacity:0.4;text-transform:uppercase;}
.card-hint{position:absolute;bottom:24px;font-size:11px;color:var(--muted);font-weight:700;opacity:0.5;letter-spacing:1px;text-transform:uppercase;}
.card-front{background:linear-gradient(145deg, var(--surface), var(--surface2));}
.card-back{background:var(--surface2);transform:rotateY(180deg);border-color:var(--accent);}
.card-text{font-family:var(--font-brand);font-size:clamp(20px, 8vw, 44px);font-weight:900;text-align:center;line-height:1.2;letter-spacing:-1px;word-break:break-word;max-width:100%;}

.grade-row{margin-top:30px;animation:fadeUp .3s ease;width:100%;max-width:500px;margin-left:auto;margin-right:auto;}
.grade-label{text-align:center;font-size:13px;color:var(--muted);margin-bottom:18px;font-weight:600;letter-spacing:0.5px;}
.grade-btns{display:flex;gap:12px;}
.grade-btn{flex:1;padding:16px 12px;border-radius:18px;border:1px solid var(--border);background:var(--surface);font-family:var(--font-brand);font-size:15px;font-weight:800;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:6px;}
.grade-btn.easy{color:var(--easy);border-color:var(--easy);background:rgba(0,209,160,0.05);}
.grade-btn.easy:hover{background:var(--easy);color:#000;transform:translateY(-2px);}
.grade-btn.medium{color:var(--medium);border-color:var(--medium);background:rgba(255,204,102,0.05);}
.grade-btn.medium:hover{background:var(--medium);color:#000;transform:translateY(-2px);}
.grade-btn.hard{color:var(--hard);border-color:var(--hard);background:rgba(255,118,117,0.05);}
.grade-btn.hard:hover{background:var(--hard);color:#000;transform:translateY(-2px);}

.progress{margin-bottom:28px;max-width:500px;margin-left:auto;margin-right:auto;}
.progress-meta{display:flex;justify-content:space-between;margin-bottom:10px;align-items:baseline;}
.progress-text{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}
.progress-pct{font-size:14px;color:var(--accent);font-weight:900;font-family:var(--font-brand);}
.progress-bar{height:8px;background:var(--surface2);border-radius:99px;overflow:hidden;border:1px solid var(--border);}
.progress-fill{height:100%;background:var(--accent);border-radius:99px;transition:width .6s cubic-bezier(0.34, 1.56, 0.64, 1);}
.honesty-note{text-align:center;font-size:11px;color:var(--muted);margin-top:24px;opacity:0.5;font-weight:500;}

.done-banner{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px;background:var(--surface);padding:60px 30px;border-radius:32px;border:1px solid var(--border);box-shadow:0 20px 60px rgba(0,0,0,0.4);max-width:500px;margin:20px auto;}
.done-title{font-family:var(--font-brand);font-size:24px;font-weight:900;line-height:1.2;color:var(--text);}
.done-sub{color:var(--muted);font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.done-actions{display:flex;gap:12px;justify-content:center;width:100%;margin-top:10px;flex-wrap:wrap;}
.medium-btn{flex:1;min-width:140px;padding:16px 20px;font-size:16px;border-radius:16px;}

.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:90;background:rgba(18,18,34,0.95);backdrop-filter:blur(24px);border-top:1px solid var(--border);padding:12px 16px env(safe-area-inset-bottom, 24px);gap:10px;box-shadow:0 -10px 40px rgba(0,0,0,0.3);}
.bottom-nav .nav-btn{flex:1;padding:12px;font-size:13px;}

@media(max-width:768px){
  .main{padding-top:24px;padding-bottom:140px;}
  .stats-bar{grid-template-columns:1fr 1fr;}
  .inputs-row{grid-template-columns:1fr;}
}

@media(max-width:600px){
  .header{height:64px;padding:0 16px;}
  .logo{font-size:22px;}
  .section-title{font-size:20px;margin-bottom:16px;}
  .bottom-nav{display:flex;}
  .header-nav{display:none;}
  .form{padding:16px;margin-bottom:32px;}
  .add-btn{font-size:16px;padding:14px;}
  .grade-btn{font-size:14px;padding:14px 8px;}
  .card-face{padding:24px;}
  .card{min-height:280px;}
  .done-banner{padding:40px 24px;}
}

@media(max-width:400px){
  .stats-bar{grid-template-columns:1fr;}
  .grade-btns{gap:8px;}
  .grade-btn{font-size:13px;padding:12px 4px;}
  .deck-content{gap:6px;}
  .deck-front,.deck-back{font-size:13px;}
}
\`;
`;
