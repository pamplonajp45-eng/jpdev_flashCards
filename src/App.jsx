import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import JSZip from "jszip";
import initSqlJs from "sql.js";

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
  const [cards, setCards] = useState(loadCardsLocal);
  const [section, setSection] = useState("add");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef(null);

  // Load from Supabase on mount
  useEffect(() => {
    async function fetchCards() {
      const { data, error } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setCards(data);
      }
    }
    fetchCards();
  }, []);

  useEffect(() => {
    if (section === "study") {
      const queue = cards.filter((c) => c.grade !== "easy");
      setStudyQueue(queue);
      setStudyIndex(0);
      setSessionDone(queue.length === 0);
    }
  }, [section]);

  async function addCard() {
    if (!front.trim() || !back.trim()) return;

    const newCard = { front: front.trim(), back: back.trim(), grade: null };

    // Optimistic UI update
    const tempId = Date.now();
    setCards((prev) => [{ ...newCard, id: tempId }, ...prev]);
    setFront("");
    setBack("");

    const { data, error } = await supabase.from('cards').insert([newCard]).select();
    if (!error && data) {
      // Swap temp ID with real DB UUID
      setCards((prev) => prev.map(c => c.id === tempId ? data[0] : c));
    }
  }

  async function handleGrade(id, grade) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, grade } : c)));

    // Update DB async
    supabase.from('cards').update({ grade }).eq('id', id).then();

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
      if (newQueue.length === 0) setSessionDone(true);
    }
  }

  async function deleteCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('cards').delete().eq('id', id);
  }

  async function resetGrades() {
    const reset = cards.map((c) => ({ ...c, grade: null }));
    setCards(reset);
    setStudyQueue(reset);
    setStudyIndex(0);
    setSessionDone(false);

    // Reset practically un-grades everything; might be heavy for DB but okay for MVP
    await supabase.from('cards').update({ grade: null }).neq('grade', null);
  }

  async function handleImportAnki(e) {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      let dbFile = zipContent.file("collection.anki2");
      if (!dbFile) dbFile = zipContent.file("collection.anki21"); // Handles newer apkg versions
      if (!dbFile) throw new Error("Could not find Anki database in file.");

      const u8array = await dbFile.async("uint8array");

      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });

      const db = new SQL.Database(u8array);
      const res = db.exec("SELECT flds FROM notes");

      if (res.length > 0 && res[0].values) {
        const importedCards = res[0].values.map(row => {
          const fields = row[0].split('\\x1f');
          // Anki uses raw 0x1F unit separator. Let's try matching both typical encodings
          const parts = row[0].split(String.fromCharCode(31));

          return {
            front: parts[0] ? parts[0].trim() : "Unknown",
            back: parts[1] ? parts[1].trim() : (parts[0] || "Unknown"), // fallback
            grade: null
          };
        }).filter(c => c.front && c.back);

        if (importedCards.length > 0) {
          // Upload chunks to Supabase to avoid request payload limits
          const chunkSize = 500;
          const newCardsData = [];

          for (let i = 0; i < importedCards.length; i += chunkSize) {
            const chunk = importedCards.slice(i, i + chunkSize);
            const { data, error } = await supabase.from('cards').insert(chunk).select();
            if (!error && data) newCardsData.push(...data);
          }

          setCards(prev => [...newCardsData, ...prev]);
          alert(`Successfully imported ${importedCards.length} cards from Anki!`);
        } else {
          alert("No Flashcards found inside this Anki deck format.");
        }
      }
      db.close();
    } catch (err) {
      console.error(err);
      alert("Error importing Anki deck: " + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
    }
  }

  const currentCard = studyQueue[studyIndex];
  const easyCount = cards.filter((c) => c.grade === "easy").length;
  const pct = cards.length ? Math.round((easyCount / cards.length) * 100) : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="header">
          <div className="logo">
            jp<span>DECK</span>
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
              📖 Study
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
                  <input
                    placeholder="Back (e.g. Hello)"
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCard()}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="add-btn" onClick={addCard} style={{ flex: 1 }}>
                    Add Card
                  </button>
                  <button
                    className="add-btn"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', flex: 1 }}
                    disabled={isImporting}
                  >
                    {isImporting ? "Importing..." : "📥 Import Anki (.apkg)"}
                  </button>
                  <input
                    type="file"
                    accept=".apkg"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleImportAnki}
                  />
                </div>
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

              <h2 className="section-title">Your Deck</h2>
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
                <div className="done-banner">
                  <h3 className="done-title">Don't forget to take breaks, CONGRATS!</h3>
                  <p className="done-sub">
                    {easyCount} of {cards.length} cards mastered
                  </p>
                  <button className="add-btn reset-btn" onClick={resetGrades}>
                    Reset &amp; Study Again
                  </button>
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
        </nav>
      </div>
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#08080f;--surface:#0f0f1e;--surface2:#14142a;
  --border:#1e1e3a;--accent:#6c5ce7;--accent2:#a29bfe;
  --text:#e8e8f4;--muted:#5a5a7a;
  --easy:#00b894;--medium:#fdcb6e;--hard:#e17055;
}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100dvh;overflow-x:hidden;}
.app{display:flex;flex-direction:column;min-height:100dvh;}

/* HEADER */
.header{position:sticky;top:0;z-index:100;background:rgba(8,8,15,0.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:60px;}
.logo{font-family:'Syne',sans-serif;font-size:22px;font-weight:900;letter-spacing:-1px;}
.logo span{color:var(--accent2);}
.header-nav{display:flex;gap:8px;}
.nav-btn{padding:8px 20px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap;}
.nav-btn:hover{border-color:var(--accent);color:var(--accent2);}
.nav-btn.active{background:var(--accent);border-color:var(--accent);color:#fff;}

/* MAIN */
.main{flex:1;max-width:720px;width:100%;margin:0 auto;padding:28px 20px 80px;animation:fadeUp .3s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}

.section-title{font-family:'Syne',sans-serif;font-size:19px;font-weight:800;margin-bottom:18px;}

/* FORM */
.form{display:flex;flex-direction:column;gap:10px;margin-bottom:36px;}
.inputs-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
input{width:100%;padding:13px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;transition:border-color .2s;-webkit-appearance:none;}
input:focus{border-color:var(--accent);}
input::placeholder{color:var(--muted);}
.add-btn{padding:13px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-family:'Syne',sans-serif;font-size:16px;font-weight:800;cursor:pointer;transition:opacity .2s,transform .1s;-webkit-tap-highlight-color:transparent;}
.add-btn:active{opacity:.8;transform:scale(.98);}
.reset-btn{display:block;max-width:260px;margin:0 auto;}

/* STATS */
.stats-bar{display:flex;gap:10px;margin-bottom:28px;flex-wrap:wrap;}
.stat{flex:1;min-width:72px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;text-align:center;}
.stat-num{font-family:'Syne',sans-serif;font-size:22px;font-weight:900;}
.stat-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-top:2px;}

/* DECK LIST */
.deck-list{display:flex;flex-direction:column;gap:8px;}
.deck-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;border-radius:10px;background:var(--surface);border:1px solid var(--border);}
.deck-content{display:flex;align-items:center;gap:8px;min-width:0;flex:1;overflow:hidden;}
.deck-front{font-weight:600;font-size:14px;white-space:nowrap;}
.deck-arrow{color:var(--border);flex-shrink:0;font-size:12px;}
.deck-back{color:var(--muted);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.deck-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.grade-pill{font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:1px;}
.grade-pill.easy{background:#00302a;color:var(--easy);}
.grade-pill.medium{background:#302a00;color:var(--medium);}
.grade-pill.hard{background:#301400;color:var(--hard);}
.del-btn{background:transparent;border:none;color:var(--muted);font-size:15px;cursor:pointer;padding:4px 6px;border-radius:6px;transition:color .2s;-webkit-tap-highlight-color:transparent;}
.del-btn:hover{color:var(--hard);}
.empty{color:var(--muted);text-align:center;padding:50px 0;font-size:15px;}

/* PROGRESS */
.progress{margin-bottom:24px;}
.progress-meta{display:flex;justify-content:space-between;margin-bottom:8px;}
.progress-text{font-size:13px;color:var(--muted);}
.progress-pct{font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:var(--accent2);}
.progress-bar{height:5px;background:var(--border);border-radius:999px;overflow:hidden;}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:999px;transition:width .5s ease;}

/* CARD */
.card-wrapper{perspective:1200px;margin-bottom:20px;}
.card{position:relative;width:100%;min-height:220px;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.4,0,.2,1);cursor:pointer;border-radius:18px;-webkit-tap-highlight-color:transparent;user-select:none;}
.card.flipped{transform:rotateY(180deg);}
.card-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:18px;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;}
.card-front{background:var(--surface);}
.card-back{background:var(--surface2);transform:rotateY(180deg);}
.card-face-label{position:absolute;top:16px;left:18px;font-size:10px;letter-spacing:2px;color:var(--muted);font-weight:600;text-transform:uppercase;}
.card-text{font-family:'Syne',sans-serif;font-size:clamp(22px,6vw,38px);font-weight:800;text-align:center;line-height:1.2;}
.card-hint{position:absolute;bottom:14px;right:18px;font-size:11px;color:var(--muted);}

/* GRADE */
.grade-row{text-align:center;}
.grade-label{font-size:13px;color:var(--muted);margin-bottom:12px;display:block;}
.grade-btns{display:flex;gap:10px;justify-content:center;}
.grade-btn{flex:1;max-width:140px;padding:12px 10px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .2s,transform .1s;-webkit-tap-highlight-color:transparent;}
.grade-btn:active{opacity:.75;transform:scale(.96);}
.grade-btn.easy{background:#00302a;color:var(--easy);}
.grade-btn.medium{background:#302a00;color:var(--medium);}
.grade-btn.hard{background:#301400;color:var(--hard);}

/* DONE */
.done-banner{text-align:center;padding:60px 20px;}
.done-emoji{font-size:64px;margin-bottom:16px;}
.done-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:900;margin-bottom:8px;}
.done-sub{color:var(--muted);margin-bottom:28px;font-size:15px;}

.honesty-note{text-align:center;font-size:12px;color:var(--muted);margin-top:16px;}

/* BOTTOM NAV — mobile only */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(8,8,15,.96);backdrop-filter:blur(18px);border-top:1px solid var(--border);padding:10px 16px 18px;gap:10px;}

@media(max-width:560px){
  .bottom-nav{display:flex;}
  .header-nav{display:none;}
  .main{padding-bottom:100px;}
  .bottom-nav .nav-btn{flex:1;text-align:center;padding:12px 8px;font-size:15px;}
  .inputs-row{grid-template-columns:1fr;}
}
`;
