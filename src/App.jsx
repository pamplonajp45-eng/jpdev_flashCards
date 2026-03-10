import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { getJapaneseMeaning, processBulkAI } from "./lib/gemini";
import easySound from "./assets/when clicking easy.mp3";
import finishSound from "./assets/when memorized all and finish studying.mp3";
import resetSound from "./assets/when reset and study again clicked.mp3";
import successIllu from "./assets/watercolor-chinese-style-illustration/7947569.jpg";
import Auth from "./assets/components/Auth";

function loadCardsLocal() {
  try {
    return JSON.parse(localStorage.getItem("jpdeck_cards")) || [];
  } catch {
    return [];
  }
}

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
  const [session, setSession] = useState(null);
  const [cards, setCards] = useState(loadCardsLocal);
  const [section, setSection] = useState("add");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // ✅ ADD THIS — restores session on refresh
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

  // ── Load cards for the logged-in user  ← your existing one stays below
  useEffect(() => {
    if (!session) return;
    // ...
  }, [session]);

  // ── Load cards for the logged-in user
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
    if (section === "study") {
      const queue = cards.filter((c) => c.grade !== "easy");
      setStudyQueue(queue);
      setStudyIndex(0);
      setSessionDone(queue.length === 0);
    }
  }, [section]);

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
      user_id: session.user.id, // ✅ scoped to user
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
      setCards((prev) => prev.map((c) => (c.id === tempId ? data[0] : c)));
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
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, grade } : c)));
    supabase.from("cards").update({ grade }).eq("id", id).then();

    if (grade === "hard" || grade === "medium") {
      const card = studyQueue[studyIndex];
      const newQueue = [...studyQueue.slice(studyIndex + 1), card];
      setStudyQueue(newQueue);
      setStudyIndex(0);
      if (newQueue.length === 0) setSessionDone(true);
    } else {
      const newQueue = studyQueue.filter((c) => c.id !== id);
      setStudyQueue(newQueue);
      setStudyIndex(0);
      if (grade === "easy") playSound(easySound);
      if (newQueue.length === 0) setSessionDone(true);
    }
  }

  async function deleteCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("cards").delete().eq("id", id);
  }

  async function resetGrades() {
    const reset = cards.map((c) => ({ ...c, grade: null }));
    setCards(reset);
    setStudyQueue(reset);
    setStudyIndex(0);
    setSessionDone(false);
    playSound(resetSound);
    await supabase
      .from("cards")
      .update({ grade: null })
      .eq("user_id", session.user.id); // ✅ only reset own cards
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

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setCards([]);
  }

  const currentCard = studyQueue[studyIndex];
  const easyCount = cards.filter((c) => c.grade === "easy").length;
  const pct = cards.length ? Math.round((easyCount / cards.length) * 100) : 0;

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
              <h2 className="section-title">Add a Card</h2>
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
                      placeholder="Paste cards here:&#10;こんにちは, Hello&#10;さようなら, Goodbye&#10;(One card per line, use comma or tab)"
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
                        onClick={handleBulkAdd}
                        disabled={isImporting || isAiLoading}
                        style={{ flex: 1 }}
                      >
                        Process List
                      </button>
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
                          ? "AI is Thinking..."
                          : "✨ AI Auto-fill All"}
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
                      {easyCount}
                    </div>
                    <div className="stat-label">Mastered</div>
                  </div>
                  <div className="stat">
                    <div className="stat-num" style={{ color: "var(--hard)" }}>
                      {cards.filter((c) => c.grade === "hard").length}
                    </div>
                    <div className="stat-label">Hard</div>
                  </div>
                  <div className="stat">
                    <div className="stat-num">
                      {cards.filter((c) => !c.grade).length}
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
                        {c.grade && (
                          <span className={`grade-pill ${c.grade}`}>
                            {c.grade}
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
                        {studyQueue.length} remaining · {easyCount} mastered
                      </span>
                      <span className="progress-pct">{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${pct}%` }}
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
                    {easyCount} of {cards.length} cards mastered
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
body{background:var(--bg);color:var(--text);font-family:var(--font-main);min-height:100dvh;overflow-x:hidden;}
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

.main{flex:1;max-width:800px;width:100%;margin:0 auto;padding:40px 20px 100px;animation:fadeUp .4s cubic-bezier(0.16, 1, 0.3, 1);}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}

.section-title{font-family:var(--font-brand);font-size:24px;font-weight:800;margin-bottom:24px;letter-spacing:-0.5px;}

.form{display:flex;flex-direction:column;gap:12px;margin-bottom:48px;background:var(--surface);padding:24px;border-radius:20px;border:1px solid var(--border);box-shadow:0 10px 30px rgba(0,0,0,0.2);}
.inputs-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
input{width:100%;padding:16px 20px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;color:var(--text);font-family:var(--font-main);font-size:16px;outline:none;transition:all .2s ease;}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.add-btn{padding:16px;border-radius:14px;border:none;background:var(--accent);color:#000;font-family:var(--font-brand);font-size:18px;font-weight:800;cursor:pointer;transition:all .2s cubic-bezier(0.175, 0.885, 0.32, 1.275);}
.add-btn:hover{transform:scale(1.02);filter:brightness(1.1);}
.add-btn:active{transform:scale(0.97);}

.stats-bar{display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:40px;}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px;text-align:center;transition:transform .2s;}
.stat:hover{transform:translateY(-4px);}
.stat-num{font-family:var(--font-brand);font-size:28px;font-weight:900;line-height:1;}
.stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:700;}

.deck-list{display:flex;flex-direction:column;gap:10px;}
.deck-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-radius:16px;background:var(--surface);border:1px solid var(--border);transition:all .2s;}
.deck-item:hover{border-color:var(--accent);background:var(--surface2);}
.deck-content{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
.deck-front{font-family:var(--font-brand);font-weight:800;font-size:16px;color:var(--text);}
.deck-arrow{color:var(--muted);font-size:12px;}
.deck-back{color:var(--accent);font-weight:500;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.deck-right{display:flex;align-items:center;gap:8px;}
.grade-pill{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:3px 8px;border-radius:6px;}
.grade-pill.easy{background:rgba(0,209,160,0.15);color:var(--easy);}
.grade-pill.medium{background:rgba(255,204,102,0.15);color:var(--medium);}
.grade-pill.hard{background:rgba(255,118,117,0.15);color:var(--hard);}
.del-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px 8px;border-radius:6px;transition:color .2s;}
.del-btn:hover{color:var(--hard);}
.empty{color:var(--muted);text-align:center;padding:40px 0;font-size:15px;}

.card-wrapper{perspective:1500px;margin-bottom:30px;}
.card{position:relative;width:100%;min-height:300px;transform-style:preserve-3d;transition:transform .6s cubic-bezier(0.34, 1.56, 0.64, 1);cursor:pointer;}
.card.flipped{transform:rotateY(180deg);}
.card-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:24px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;box-shadow:0 20px 50px rgba(0,0,0,0.3);}
.card-face-label{position:absolute;top:20px;left:24px;font-size:10px;font-weight:800;letter-spacing:2px;color:var(--muted);opacity:0.5;}
.card-hint{position:absolute;bottom:20px;font-size:12px;color:var(--muted);font-weight:600;opacity:0.6;}
.card-front{background:linear-gradient(135deg, var(--surface), var(--surface2));}
.card-back{background:var(--surface2);transform:rotateY(180deg);border-color:var(--accent);}
.card-text{font-family:var(--font-brand);font-size:clamp(28px, 8vw, 48px);font-weight:900;text-align:center;line-height:1.1;letter-spacing:-1px;}

.grade-row{margin-top:24px;animation:fadeUp .3s ease;}
.grade-label{text-align:center;font-size:13px;color:var(--muted);margin-bottom:16px;font-weight:600;}
.grade-btns{display:flex;gap:12px;}
.grade-btn{flex:1;padding:16px;border-radius:16px;border:1px solid var(--border);background:var(--surface);font-family:var(--font-brand);font-size:16px;font-weight:800;cursor:pointer;transition:all .2s;}
.grade-btn.easy{color:var(--easy);border-color:var(--easy);background:rgba(0,209,160,0.05);}
.grade-btn.easy:hover{background:var(--easy);color:#000;}
.grade-btn.medium{color:var(--medium);border-color:var(--medium);background:rgba(255,204,102,0.05);}
.grade-btn.medium:hover{background:var(--medium);color:#000;}
.grade-btn.hard{color:var(--hard);border-color:var(--hard);background:rgba(255,118,117,0.05);}
.grade-btn.hard:hover{background:var(--hard);color:#000;}

.progress{margin-bottom:24px;}
.progress-meta{display:flex;justify-content:space-between;margin-bottom:8px;}
.progress-text{font-size:13px;color:var(--muted);font-weight:600;}
.progress-pct{font-size:13px;color:var(--accent);font-weight:800;}
.progress-bar{height:6px;background:var(--surface2);border-radius:99px;overflow:hidden;}
.progress-fill{height:100%;background:var(--accent);border-radius:99px;transition:width .4s ease;}
.honesty-note{text-align:center;font-size:12px;color:var(--muted);margin-top:16px;opacity:0.6;}

.done-banner{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;background:var(--surface);padding:60px 40px;border-radius:30px;border:1px solid var(--border);box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden;}
.done-banner.highlighted .done-title,.done-banner.highlighted .done-sub,.done-banner.highlighted .done-actions{position:relative;z-index:2;}
.done-title{font-family:var(--font-brand);font-size:26px;font-weight:900;line-height:1.2;color:var(--text);text-shadow:0 2px 10px rgba(0,0,0,0.5);}
.done-sub{color:var(--muted);font-weight:600;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,0.5);}
.done-actions{display:flex;gap:12px;justify-content:center;width:100%;margin-top:8px;}
.medium-btn{width:auto;min-width:160px;padding:14px 24px;font-size:16px;border-radius:14px;}

.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:90;background:rgba(11,11,20,0.9);backdrop-filter:blur(20px);border-top:1px solid var(--border);padding:16px 16px 32px;gap:12px;}

@media(max-width:600px){
  .bottom-nav{display:flex;}
  .header-nav{display:none;}
  .main{padding-bottom:120px;}
  .inputs-row{grid-template-columns:1fr;}
  .stat{padding:16px;}
}
`;
