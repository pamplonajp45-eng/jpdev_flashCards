import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { getJapaneseMeaning, processBulkAI } from "./lib/gemini";
import { loadLessonFromExcel } from "./lib/excelLoader";
import finishSound from "./assets/when memorized all and finish studying.mp3";
import resetSound from "./assets/when reset and study again clicked.mp3";
import successIllu from "./assets/watercolor-chinese-style-illustration/7947569.jpg";
import Auth from "./assets/components/Auth";


const CHART_KANAS = new Set([
  "あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ", "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と", "な", "に", "ぬ", "ね", "の", "は", "ひ", "ふ", "へ", "ほ", "ま", "み", "む", "め", "も", "や", "ゆ", "よ", "ら", "り", "る", "れ", "ろ", "わ", "を", "ん", "が", "ぎ", "ぐ", "げ", "ご", "ざ", "じ", "ず", "ぜ", "ぞ", "だ", "ぢ", "づ", "で", "ど", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ", "きゃ", "きゅ", "きょ", "しゃ", "しゅ", "しょ", "ちゃ", "ちゅ", "ちょ", "にゃ", "にゅ", "にょ", "ひゃ", "ひゅ", "ひょ", "みゃ", "みゅ", "みょ", "りゃ", "りゅ", "りょ", "ぎゃ", "ぎゅ", "ぎょ", "じゃ", "じゅ", "じょ", "びゃ", "びゅ", "びょ", "ぴゃ", "ぴゅ", "ぴョ",
  "ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ", "ス", "セ", "ソ", "タ", "チ", "ツ", "テ", "ト", "ナ", "ニ", "ヌ", "ネ", "ノ", "ハ", "ヒ", "フ", "ヘ", "ホ", "マ", "ミ", "ム", "メ", "モ", "ヤ", "ユ", "ヨ", "ラ", "リ", "ル", "レ", "ロ", "ワ", "ヲ", "ン", "ガ", "ギ", "グ", "ゲ", "ゴ", "ザ", "ジ", "ズ", "ゼ", "ゾ", "ダ", "ヂ", "ヅ", "デ", "ド", "バ", "ビ", "ブ", "ベ", "ボ", "パ", "ピ", "プ", "ペ", "ポ", "キャ", "キュ", "キョ", "シャ", "シュ", "ショ", "チャ", "チュ", "チョ", "ニャ", "ニュ", "ニョ", "ヒャ", "ヒュ", "ヒョ", "ミャ", "ミュ", "ミョ", "リャ", "リュ", "リョ", "ギャ", "ギュ", "ギョ", "ジャ", "ジュ", "ジョ", "ビャ", "ビュ", "ビョ", "ピャ", "ピュ", "ピョ"
]);

const getCardDeck = (front) => {
  if (CHART_KANAS.has(front) || CHART_KANAS.has(front[0])) {
    if (/^[\u3040-\u309F]+$/.test(front)) return "Hiragana";
    if (/^[\u30A0-\u30FF]+$/.test(front)) return "Katakana";
  }
  return "Vocabulary";
};

const DECK_META = {
  Hiragana: { icon: "あ", color: "#a29bfe", glow: "rgba(162,155,254,0.18)" },
  Katakana: { icon: "ア", color: "#fd79a8", glow: "rgba(253,121,168,0.18)" },
  Vocabulary: { icon: "語", color: "#00cec9", glow: "rgba(0,206,201,0.18)" },
};

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
            <button className="grade-btn easy" onClick={() => onGrade(card.id, "easy")}>✅ Easy</button>
            <button className="grade-btn medium" onClick={() => onGrade(card.id, "medium")}>🟡 Medium</button>
            <button className="grade-btn hard" onClick={() => onGrade(card.id, "hard")}>🔴 Hard</button>
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
  const [deckFilter, setDeckFilter] = useState("all");
  const [studyDeckFilter, setStudyDeckFilter] = useState("all");
  const [studyTotalCards, setStudyTotalCards] = useState(0);
  const deckRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    async function fetchCards() {
      const { data, error } = await supabase
        .from("cards").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (error) { console.error("Supabase Fetch Error:", error.message); alert(`Supabase Error: ${error.message}.`); }
      if (!error && data) { console.log("App Core Loaded: v2.3-layout"); setCards(data); }
    }
    fetchCards();
  }, [session]);

  useEffect(() => {
    if (section !== "study") { setSessionStarted(false); return; }
    if (!sessionStarted && !sessionDone) {
      const today = new Date().toISOString().split("T")[0];

      let filteredCards = cards;
      if (studyDeckFilter !== "all") {
        filteredCards = cards.filter(c => getCardDeck(c.front) === studyDeckFilter);
      }

      const queue = filteredCards.filter((c) => !c.due_date || c.due_date <= today);

      // Fisher-Yates shuffle algorithm to randomize the study queue explicitly
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }

      setStudyQueue(queue); setStudyIndex(0); setSessionDone(queue.length === 0); setSessionStarted(true);

      // Keep track of the actual total cards in the active deck to show realistic progress
      setStudyTotalCards(filteredCards.length);
    }
  }, [section, sessionStarted, sessionDone, studyDeckFilter]);

  useEffect(() => {
    if (sessionDone && section === "study" && cards.length > 0) {
      const audio = new Audio(finishSound); audio.volume = 0.6;
      audio.play().catch((e) => console.log("Audio play blocked:", e));
    }
  }, [sessionDone]);

  const playSound = (src) => { const audio = new Audio(src); audio.volume = 0.5; audio.play().catch(() => { }); };

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    const newCard = { front: front.trim(), back: back.trim(), grade: null, user_id: session.user.id };
    const tempId = Date.now();
    setCards((prev) => [{ ...newCard, id: tempId }, ...prev]);
    setFront(""); setBack("");
    const { data, error } = await supabase.from("cards").insert([newCard]).select();
    if (!error && data) setCards((prev) => prev.map((c) => (c.id === tempId ? data[0] : c)));
  }

  async function handleAiSuggest() {
    if (!front.trim()) { alert("Please enter Japanese text in the Front field first!"); return; }
    setIsAiLoading(true);
    const suggestion = await getJapaneseMeaning(front);
    if (suggestion) setBack(suggestion);
    setIsAiLoading(false);
  }

  async function handleGrade(id, grade) {
    const card = studyQueue[studyIndex];
    let newInterval = card.interval || 1;
    let newEase = card.ease_factor || 2.5;
    if (grade === "hard") { newInterval = 1; newEase = Math.max(1.3, newEase - 0.2); }
    else if (grade === "medium") { newInterval = Math.max(1, Math.round(newInterval * 1.2)); newEase = Math.max(1.3, newEase - 0.15); }
    else if (grade === "easy") { newInterval = Math.round(newInterval * newEase); newEase = Math.min(3.0, newEase + 0.1); }
    const due = new Date(); due.setDate(due.getDate() + newInterval);
    const dueDateStr = due.toISOString().split("T")[0];
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, interval: newInterval, ease_factor: newEase, due_date: dueDateStr } : c));
    await supabase.from("cards").update({ interval: newInterval, ease_factor: newEase, due_date: dueDateStr }).eq("id", id).eq("user_id", session.user.id);
    if (grade === "hard" || grade === "medium") {
      const newQueue = [...studyQueue.slice(studyIndex + 1), card];
      setStudyQueue(newQueue); setStudyIndex(0);
      if (newQueue.length === 0) setSessionDone(true);
      setAutoFlip(newQueue.length === 1);
    } else {
      const newQueue = studyQueue.filter((c) => c.id !== id);
      setStudyQueue(newQueue); setStudyIndex(0);
      if (newQueue.length === 0) setSessionDone(true);
      setAutoFlip(false);
    }
  }

  async function resetGrades() {
    const today = new Date().toISOString().split("T")[0];
    const reset = cards.map((c) => ({ ...c, interval: 1, ease_factor: 2.5, due_date: today }));
    setCards(reset); setStudyQueue(reset); setStudyIndex(0); setSessionDone(false); setSessionStarted(false);
    playSound(resetSound);
    await supabase.from("cards").update({ interval: 1, ease_factor: 2.5, due_date: today }).eq("user_id", session.user.id);
  }

  const handleNuclearReset = async () => {
    if (!window.confirm("This will clear all branding caches and restart the app. Continue?")) return;
    if ("caches" in window) { const names = await caches.keys(); await Promise.all(names.map((n) => caches.delete(n))); }
    if ("serviceWorker" in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
    window.location.reload(true);
  };

  async function clearAllCards() {
    if (!window.confirm("⚠️ ARE YOU SURE?\nThis will permanently delete ALL your cards. This cannot be undone.")) return;
    const { error } = await supabase.from("cards").delete().eq("user_id", session.user.id);
    if (error) { alert("Error clearing deck: " + error.message); }
    else { setCards([]); if (section === "study") setSection("add"); }
  }

  async function deleteCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("cards").delete().eq("id", id).eq("user_id", session.user.id);
  }

  async function deleteDeck(deckName) {
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete ALL cards in the ${deckName} deck?`)) return;
    const deckCards = cards.filter(c => getCardDeck(c.front) === deckName);
    const cardIds = deckCards.map(c => c.id);
    if (cardIds.length === 0) return;

    const { error } = await supabase.from("cards").delete().in("id", cardIds).eq("user_id", session.user.id);
    if (error) { alert("Error deleting deck: " + error.message); }
    else {
      setCards(prev => prev.filter(c => !cardIds.includes(c.id)));
      if (studyDeckFilter === deckName) setStudyDeckFilter("all");
    }
  }

  async function handleBulkAdd() {
    if (!bulkText.trim()) return;
    const lines = bulkText.split("\n");
    if (lines.length > 200) { alert("Security Limit: Please import a maximum of 200 cards at once to prevent server overload."); return; }
    const newCards = [];
    lines.forEach((line) => {
      const parts = line.split(/[,\t]/);
      if (parts.length >= 2) newCards.push({ front: parts[0].trim(), back: parts[1].trim(), grade: null, user_id: session.user.id });
    });
    if (newCards.length === 0) { alert("No valid cards found. Use 'Front, Back' or 'Front [Tab] Back' format."); return; }
    setIsImporting(true);
    const { data, error } = await supabase.from("cards").insert(newCards).select();
    setIsImporting(false);
    if (!error && data) { setCards((prev) => [...data, ...prev]); setBulkText(""); setShowBulkAdd(false); alert(`Imported ${newCards.length} cards!`); }
    else alert("Error saving cards: " + (error?.message || "Unknown error"));
  }

  async function handleBulkAiAdd() {
    if (!bulkText.trim()) { alert("Please paste a list of Japanese words first!"); return; }
    if (bulkText.split("\n").length > 200) { alert("Security Limit: Please evaluate a maximum of 200 items at once via AI to prevent server API limits."); return; }
    setIsAiLoading(true);
    try {
      const aiCards = await processBulkAI(bulkText);
      if (aiCards.length === 0) { alert("AI could not extract any cards from your text. Try a clearer list."); return; }
      const aiCardsWithUser = aiCards.map((c) => ({ ...c, user_id: session.user.id }));
      const { data, error } = await supabase.from("cards").insert(aiCardsWithUser).select();
      if (!error && data) { setCards((prev) => [...data, ...prev]); setBulkText(""); setShowBulkAdd(false); alert(`AI successfully generated and imported ${aiCards.length} cards!`); }
      else alert("Error saving AI cards: " + (error?.message || "Unknown error"));
    } catch (e) { console.error(e); alert("AI Processing failed: " + (e.message || "Unknown error")); }
    finally { setIsAiLoading(false); }
  }

  async function handleLessonGenerate(lessonFile, lessonName) {
    if (!window.confirm(`Are you sure you want to generate ${lessonName} flashcards?`)) return;
    setIsAiLoading(true);
    try {
      const lessonCards = await loadLessonFromExcel(lessonFile);
      if (lessonCards.length === 0) { alert("No cards found in the excel file."); return; }

      const normalizeString = (str) => {
        if (!str) return "";
        // Remove all normal spaces, full-width Japanese spaces, and invisible characters
        return String(str).replace(/[\s\u3000]+/g, "").trim().toLowerCase();
      };

      const existingFronts = new Set(cards.map(c => normalizeString(c.front)));
      const newCards = lessonCards.filter(c => !existingFronts.has(normalizeString(c.front)));

      if (newCards.length === 0) {
        alert(`Warning: The entire ${lessonName} lesson is already downloaded in your deck! No duplicates were added.`);
        return;
      }

      if (newCards.length < lessonCards.length) {
        const duplicates = lessonCards.length - newCards.length;
        if (!window.confirm(`Warning: ${duplicates} cards from this lesson are already in your deck. Do you want to download the remaining ${newCards.length} new cards?`)) {
          return;
        }
      }

      const cardsWithUser = newCards.map((c) => ({ ...c, user_id: session.user.id }));
      const { data, error } = await supabase.from("cards").insert(cardsWithUser).select();
      if (!error && data) { setCards((prev) => [...data, ...prev]); alert(`Successfully generated ${newCards.length} new cards for ${lessonName}!`); }
      else alert("Error saving lesson cards: " + (error?.message || "Unknown error"));
    } catch (e) { console.error(e); alert("Failed to load lesson: " + (e.message || "Unknown error")); }
    finally { setIsAiLoading(false); }
  }

  async function handleLogout() { await supabase.auth.signOut(); setSession(null); setCards([]); }

  const currentCard = studyQueue[studyIndex];
  const today = new Date().toISOString().split("T")[0];
  const dueCount = cards.filter((c) => !c.due_date || c.due_date <= today).length;

  const hiraganaCards = cards.filter(c => getCardDeck(c.front) === "Hiragana");
  const katakanaCards = cards.filter(c => getCardDeck(c.front) === "Katakana");
  const vocabCards = cards.filter(c => getCardDeck(c.front) === "Vocabulary");

  const decks = [
    { title: "Hiragana", data: hiraganaCards },
    { title: "Katakana", data: katakanaCards },
    { title: "Vocabulary", data: vocabCards },
  ].filter(d => d.data.length > 0);

  // ── Filter helper
  const filterCards = (data) => {
    if (deckFilter === "due") return data.filter(c => c.due_date && c.due_date <= today);
    if (deckFilter === "learning") return data.filter(c => c.due_date && c.due_date > today);
    if (deckFilter === "new") return data.filter(c => !c.due_date);
    return data;
  };

  if (!session) return <Auth onLogin={(s) => setSession(s)} />;

  return (
    <>
      <style>{CSS}</style>
      <div className="app-bg"><img src={successIllu} alt="" /></div>
      <div className="app">

        {/* ── HEADER ── */}
        <header className="header">
          <div className="logo">
            <span id="brand-fix-check" className="logo-jp">JP</span>
            <span className="logo-deck">DECK</span>
            <button onClick={handleNuclearReset} className="version-btn">(v2.3 • Auth)</button>
          </div>
          <nav className="header-nav">
            <button className={`nav-btn ${section === "add" ? "active" : ""}`} onClick={() => setSection("add")}>＋ Add</button>
            <button className={`nav-btn ${section === "stats" ? "active" : ""}`} onClick={() => setSection("stats")}>📊 Stats</button>
            <button className={`nav-btn ${section === "study" ? "active" : ""}`} onClick={() => setSection("study")}>📖 Study</button>
            <button className="nav-btn logout-btn" onClick={handleLogout}>Sign Out</button>
          </nav>
        </header>

        <main className="main">

          {/* ════════════════════════════════════
              ADD SECTION
          ════════════════════════════════════ */}
          {section === "add" && (
            <>
              {/* Top row: title + lesson select */}
              <div className="add-header">
                <h2 className="section-title">Add a Card</h2>
                <select
                  className="lesson-select"
                  onChange={(e) => {
                    if (e.target.value) { handleLessonGenerate(e.target.value, e.target.options[e.target.selectedIndex].text); e.target.value = ""; }
                  }}
                >
                  <option value="">📚 Add Lesson</option>
                  <optgroup label="Hiragana">
                    <option value="hiragana_chart.xlsx">Hiragana</option>
                  </optgroup>
                  <optgroup label="Katakana">
                    <option value="katakana_chart.xlsx">Katakana</option>
                  </optgroup>
                  <optgroup label="Vocabulary">
                    <option value="minna_nihongo_lesson1_v2 (1).xlsx">Minna no Nihongo Lesson 1</option>
                  </optgroup>
                </select>
              </div>

              {/* Form */}
              <div className="form">
                <div className="inputs-row">
                  <input placeholder="Front (e.g. こんにちは)" value={front} onChange={(e) => setFront(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCard()} />
                  <div style={{ position: "relative", flex: 1 }}>
                    <input placeholder="Back (e.g. Hello)" value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCard()} style={{ paddingRight: "45px" }} />
                    <button onClick={handleAiSuggest} disabled={isAiLoading} title="AI Smart Fill" className="ai-btn">
                      {isAiLoading ? "⌛" : "✨"}
                    </button>
                  </div>
                </div>
                <div className="form-actions">
                  <button className="add-btn" onClick={addCard}>Add Card</button>
                  <button className={`bulk-toggle-btn ${showBulkAdd ? "active" : ""}`} onClick={() => setShowBulkAdd(!showBulkAdd)}>📝 Bulk Import</button>
                </div>

                {showBulkAdd && (
                  <div className="bulk-add">
                    <textarea
                      placeholder={"Paste nihongo text only:\nこんにちは,\nさようなら,\n(One card per line, comma or tab)"}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      className="bulk-textarea"
                    />
                    <button className="add-btn" onClick={handleBulkAiAdd} disabled={isImporting || isAiLoading} style={{ background: "var(--accent)", color: "#000", fontWeight: "800" }}>
                      {isAiLoading ? "jp DECK is Thinking..." : "✨ Auto Fill"}
                    </button>
                  </div>
                )}
              </div>

              {/* ── OVERVIEW STATS (all decks combined) ── */}
              {cards.length > 0 && (
                <>
                  <h2 className="section-title" style={{ marginBottom: "16px", marginTop: "16px" }}>Overview</h2>
                  <div className="overview-stats">
                    {[
                      { label: "Total", value: cards.length, color: "var(--accent)" },
                      { label: "Due Today", value: cards.filter(c => c.due_date && c.due_date <= today).length, color: "var(--easy)" },
                      { label: "Learning", value: cards.filter(c => c.due_date && c.due_date > today).length, color: "var(--medium)" },
                      { label: "New", value: cards.filter(c => !c.due_date).length, color: "var(--muted)" },
                    ].map(s => (
                      <div key={s.label} className="overview-stat">
                        <div className="overview-stat-num" style={{ color: s.color }}>{s.value}</div>
                        <div className="overview-stat-label">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ════════════════════════════════════
              STATS & DECK SECTION
          ════════════════════════════════════ */}
          {section === "stats" && (
            <>


              {/* ── PER-DECK STATS CARDS ── */}
              {decks.length > 0 && (
                <>
                  <h2 className="section-title" style={{ marginBottom: "16px", marginTop: "36px" }}>Deck Stats</h2>
                  <div className="deck-stats-grid">
                    {decks.map(deck => {
                      const meta = DECK_META[deck.title];
                      const dueC = deck.data.filter(c => c.due_date && c.due_date <= today).length;
                      const learning = deck.data.filter(c => c.due_date && c.due_date > today).length;
                      const newC = deck.data.filter(c => !c.due_date).length;
                      return (
                        <div key={deck.title} className="deck-stat-card" style={{ "--deck-color": meta.color, "--deck-glow": meta.glow }}>
                          <div className="deck-stat-header">
                            <span className="deck-stat-icon">{meta.icon}</span>
                            <span className="deck-stat-title">{deck.title}</span>
                            <span className="deck-stat-total">{deck.data.length}</span>
                            <button
                              className="del-btn"
                              title="Delete Deck"
                              onClick={() => deleteDeck(deck.title)}
                              style={{ marginLeft: "8px", padding: "4px" }}
                            >
                              ✕
                            </button>
                          </div>
                          <div className="deck-stat-row">
                            <span className="deck-stat-item">
                              <span className="ds-dot" style={{ background: "var(--easy)" }}></span>
                              <span className="ds-val">{dueC}</span>
                              <span className="ds-lbl">Due</span>
                            </span>
                            <span className="deck-stat-item">
                              <span className="ds-dot" style={{ background: "var(--medium)" }}></span>
                              <span className="ds-val">{learning}</span>
                              <span className="ds-lbl">Learning</span>
                            </span>
                            <span className="deck-stat-item">
                              <span className="ds-dot" style={{ background: "var(--muted)" }}></span>
                              <span className="ds-val">{newC}</span>
                              <span className="ds-lbl">New</span>
                            </span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="deck-stat-bar">
                            {deck.data.length > 0 && <>
                              <div className="dsb-fill dsb-learning" style={{ width: `${(learning / deck.data.length) * 100}%` }} />
                              <div className="dsb-fill dsb-due" style={{ width: `${(dueC / deck.data.length) * 100}%` }} />
                            </>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── FILTER TABS ── */}
              {cards.length > 0 && (
                <div className="filter-tabs" ref={deckRef}>
                  {["all", "due", "learning", "new"].map(f => (
                    <button key={f} className={`filter-tab ${deckFilter === f ? "active" : ""}`} onClick={() => setDeckFilter(f)}>
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                  {cards.length > 0 && (
                    <button onClick={clearAllCards} className="clear-btn">🗑️ Clear All</button>
                  )}
                </div>
              )}

              {/* ── DECK SECTIONS ── */}
              {cards.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <p className="empty" style={{ marginBottom: "16px" }}>No cards yet!</p>
                  <button className="add-btn" style={{ padding: "12px 24px" }} onClick={() => setSection("add")}>
                    Go to Add Cards
                  </button>
                </div>
              ) : (
                <div className="deck-sections">
                  {decks.map(deck => {
                    const meta = DECK_META[deck.title];
                    const filtered = filterCards(deck.data);
                    if (filtered.length === 0 && deckFilter !== "all") return null;
                    return (
                      <div key={deck.title} className="deck-section">
                        {/* Section header */}
                        <div className="deck-section-header" style={{ "--deck-color": meta.color }}>
                          <span className="dsh-icon">{meta.icon}</span>
                          <span className="dsh-title">{deck.title}</span>
                          <span className="dsh-count">{filtered.length} cards</span>
                        </div>

                        {/* Sub-groups shown only when filter = all */}
                        {deckFilter === "all" ? (
                          <div className="sub-groups">
                            {[
                              { key: "due", label: "Due Today", icon: "📅", color: "var(--easy)", items: deck.data.filter(c => c.due_date && c.due_date <= today) },
                              { key: "learning", label: "Learning", icon: "🟡", color: "var(--medium)", items: deck.data.filter(c => c.due_date && c.due_date > today) },
                              { key: "new", label: "New", icon: "🆕", color: "var(--muted)", items: deck.data.filter(c => !c.due_date) },
                            ].map(group => (
                              <div key={group.key} className="sub-group">
                                <div className="sub-group-header">
                                  <span>{group.icon}</span>
                                  <span className="sub-group-label" style={{ color: group.color }}>{group.label}</span>
                                  <span className="count-pill">{group.items.length}</span>
                                </div>
                                {group.items.length > 0 ? (
                                  <div className="deck-list">
                                    {group.items.map(c => <CardRow key={c.id} c={c} onDelete={deleteCard} />)}
                                  </div>
                                ) : (
                                  <p className="empty-sub">Nothing here</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="deck-list" style={{ marginTop: "12px" }}>
                            {filtered.length > 0
                              ? filtered.map(c => <CardRow key={c.id} c={c} onDelete={deleteCard} />)
                              : <p className="empty-sub">No {deckFilter} cards in {deck.title}</p>
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════
              STUDY SECTION
          ════════════════════════════════════ */}
          {section === "study" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 className="section-title" style={{ margin: 0 }}>Study Session</h2>
                {cards.length > 0 && (
                  <select
                    className="lesson-select"
                    value={studyDeckFilter}
                    onChange={(e) => {
                      setStudyDeckFilter(e.target.value);
                      setSessionStarted(false);
                      setSessionDone(false);
                    }}
                  >
                    <option value="all">📚 All Decks</option>
                    {decks.map(d => (
                      <option key={d.title} value={d.title}>{DECK_META[d.title]?.icon} {d.title}</option>
                    ))}
                  </select>
                )}
              </div>

              {cards.length === 0 && <p className="empty">No cards yet — go add some first!</p>}

              {cards.length > 0 && sessionDone && studyTotalCards > 0 && studyQueue.length === 0 && studyDeckFilter !== "all" && cards.filter(c => getCardDeck(c.front) === studyDeckFilter).length === 0 && (
                <p className="empty">You have no {studyDeckFilter} cards yet.</p>
              )}

              {cards.length > 0 && !sessionDone && currentCard && (
                <>
                  <div className="progress">
                    <div className="progress-meta">
                      <span className="progress-text">{studyQueue.length} remaining · {studyTotalCards - studyQueue.length} done</span>
                      <span className="progress-pct">{studyTotalCards ? Math.round(((studyTotalCards - studyQueue.length) / studyTotalCards) * 100) : 0}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${studyTotalCards ? Math.round(((studyTotalCards - studyQueue.length) / studyTotalCards) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <Flashcard key={currentCard.id + "-" + studyIndex} card={currentCard} onGrade={handleGrade} />
                  <p className="honesty-note">Be honest — your grades shape how often cards repeat 🙏</p>
                </>
              )}
              {cards.length > 0 && sessionDone && (!currentCard) && (
                <div className="done-banner">
                  <h3 className="done-title">Don't forget to take breaks, CONGRATS!</h3>
                  <p className="done-sub">
                    {studyDeckFilter !== "all" ? studyDeckFilter : "All"} cards reviewed for today
                  </p>
                  <div className="done-actions">
                    <button className="add-btn medium-btn reset-btn" onClick={() => {
                      setSessionStarted(false);
                      setSessionDone(false);
                    }}>Study Again</button>
                    <button className="add-btn medium-btn rest-btn" onClick={() => setSection("add")}>Rest</button>
                  </div>
                  <p style={{ marginTop: "20px", fontSize: "10px", opacity: 0.3 }}>by-jpdev</p>
                </div>
              )}
            </>
          )}
        </main>

        {/* ── BOTTOM NAV (mobile) ── */}
        <nav className="bottom-nav">
          <button className={`nav-btn ${section === "add" ? "active" : ""}`} onClick={() => setSection("add")}>＋ Add</button>
          <button className={`nav-btn ${section === "study" ? "active" : ""}`} onClick={() => setSection("study")}>📖 Study</button>
          <button className={`nav-btn ${section === "stats" ? "active" : ""}`} onClick={() => setSection("stats")}>📊 Stats</button>
          <button className="nav-btn logout-btn" onClick={handleLogout}>Sign Out</button>
        </nav>
      </div>
    </>
  );
}

// ── Extracted card row component ──
function CardRow({ c, onDelete }) {
  return (
    <div className="deck-item">
      <div className="deck-content">
        <span className="deck-front">{c.front}</span>
        <span className="deck-arrow">→</span>
        <span className="deck-back">{c.back}</span>
      </div>
      <button className="del-btn" onClick={() => onDelete(c.id)}>✕</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  CSS
// ══════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0b0b14;--surface:#131325;--surface2:#1a1a35;
  --border:#25254a;--accent:#a29bfe;--accent-glow:rgba(162,155,254,0.3);
  --text:#f0f0f7;--muted:#7c7c9c;
  --easy:#00d1a0;--medium:#ffcc66;--hard:#ff7675;
  --font-brand:'Syne',sans-serif;
  --font-main:'Inter',sans-serif;
  --radius-sm:10px;--radius-md:16px;--radius-lg:22px;--radius-xl:28px;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-main);min-height:100dvh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;}
.app{position:relative;display:flex;flex-direction:column;min-height:100dvh;z-index:1;}
.app-bg{position:fixed;inset:0;z-index:0;opacity:0.25;pointer-events:none;background:var(--bg);}
.app-bg img{width:100%;height:100%;object-fit:cover;mix-blend-mode:luminosity;filter:brightness(0.7);animation:slowZoom 30s infinite alternate ease-in-out;}
@keyframes slowZoom{from{transform:scale(1);}to{transform:scale(1.15);}}

/* HEADER */
.header{position:sticky;top:0;z-index:100;background:rgba(11,11,20,0.88);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:70px;}
.logo{display:flex;align-items:center;gap:4px;font-family:var(--font-brand);font-weight:900;font-size:26px;letter-spacing:-1px;}
.logo-jp{background:#fff;color:#000;padding:0 8px;border-radius:6px;line-height:1;display:inline-block;font-family:var(--font-brand);font-weight:900;}
.logo-deck{color:var(--accent);font-style:italic;transform:skewX(-5deg);display:inline-block;}
.version-btn{font-size:8px;opacity:0.1;margin-left:8px;background:transparent;border:none;color:var(--text);cursor:help;}
.header-nav{display:flex;gap:12px;}
.nav-btn{padding:10px 22px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-family:var(--font-brand);font-size:14px;font-weight:700;cursor:pointer;transition:all .25s ease;white-space:nowrap;}
.nav-btn:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-1px);}
.nav-btn.active{background:var(--accent);border-color:var(--accent);color:#000;box-shadow:0 0 20px var(--accent-glow);}
.logout-btn{color:var(--hard);border-color:var(--hard);}
.logout-btn:hover{background:var(--hard);color:#000;border-color:var(--hard);}

/* MAIN */
.main{flex:1;max-width:960px;width:100%;margin:0 auto;padding:40px 24px 120px;animation:fadeUp .4s cubic-bezier(0.16,1,0.3,1);}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
.section-title{font-family:var(--font-brand);font-size:24px;font-weight:800;margin-bottom:24px;letter-spacing:-0.5px;}

/* ADD HEADER */
.add-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px;flex-wrap:wrap;}
.add-header .section-title{margin-bottom:0;}
.lesson-select{padding:10px 16px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-brand);font-size:13px;font-weight:700;cursor:pointer;outline:none;}
.lesson-select:hover{border-color:var(--accent);}

/* FORM */
.form{display:flex;flex-direction:column;gap:12px;margin-bottom:40px;background:var(--surface);padding:20px;border-radius:var(--radius-xl);border:1px solid var(--border);box-shadow:0 10px 30px rgba(0,0,0,0.2);}
.inputs-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
input{width:100%;padding:14px 18px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text);font-family:var(--font-main);font-size:16px;outline:none;transition:all .2s ease;}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.ai-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:var(--accent);border:none;font-size:18px;cursor:pointer;padding:4px;border-radius:6px;}
.ai-btn:disabled{opacity:0.5;}
.form-actions{display:flex;gap:8px;flex-wrap:wrap;}
.add-btn{flex:1;min-width:120px;padding:16px;border-radius:var(--radius-md);border:none;background:var(--accent);color:#000;font-family:var(--font-brand);font-size:17px;font-weight:800;cursor:pointer;transition:all .2s cubic-bezier(0.175,0.885,0.32,1.275);}
.add-btn:hover{transform:scale(1.02);filter:brightness(1.1);}
.add-btn:active{transform:scale(0.97);}
.bulk-toggle-btn{flex:1;min-width:120px;padding:16px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:var(--font-brand);font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
.bulk-toggle-btn:hover,.bulk-toggle-btn.active{border-color:var(--accent);color:var(--accent);}
.bulk-add{display:flex;flex-direction:column;gap:10px;animation:fadeUp .2s;}
.bulk-textarea{width:100%;height:150px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;color:var(--text);font-family:inherit;font-size:14px;resize:vertical;outline:none;}
.bulk-textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}

/* ── OVERVIEW STATS ── */
.overview-stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:12px;
  margin-bottom:12px;
}
.overview-stat{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:20px 16px;
  text-align:center;
  transition:transform .2s,border-color .2s;
}
.overview-stat:hover{transform:translateY(-3px);border-color:var(--accent);}
.overview-stat-num{font-family:var(--font-brand);font-size:28px;font-weight:900;line-height:1.1;}
.overview-stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;margin-top:6px;font-weight:700;}

/* ── DECK STATS GRID ── */
.deck-stats-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:14px;
  margin-bottom:36px;
}
.deck-stat-card{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  padding:20px;
  transition:transform .2s,box-shadow .2s;
  border-top:3px solid var(--deck-color,var(--accent));
}
.deck-stat-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px var(--deck-glow,var(--accent-glow));}
.deck-stat-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.deck-stat-icon{font-size:22px;font-family:var(--font-brand);font-weight:900;color:var(--deck-color,var(--accent));min-width:28px;text-align:center;}
.deck-stat-title{font-family:var(--font-brand);font-weight:800;font-size:15px;flex:1;}
.deck-stat-total{font-family:var(--font-brand);font-size:20px;font-weight:900;color:var(--deck-color,var(--accent));}
.deck-stat-row{display:flex;gap:6px;justify-content:space-between;margin-bottom:14px;}
.deck-stat-item{display:flex;align-items:center;gap:5px;flex:1;justify-content:center;background:var(--surface2);border-radius:var(--radius-sm);padding:8px 4px;min-width:0;}
.ds-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.ds-val{font-family:var(--font-brand);font-weight:800;font-size:16px;}
.ds-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;white-space:nowrap;}
.deck-stat-bar{height:5px;background:var(--surface2);border-radius:99px;overflow:hidden;display:flex;}
.dsb-fill{height:100%;border-radius:99px;transition:width .5s;}
.dsb-due{background:var(--easy);}
.dsb-learning{background:var(--medium);}

/* ── FILTER TABS ── */
.filter-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:24px;padding:16px;background:var(--surface);border-radius:var(--radius-lg);border:1px solid var(--border);}
.filter-tab{padding:8px 18px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:var(--font-brand);font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;}
.filter-tab:hover{border-color:var(--accent);color:var(--accent);}
.filter-tab.active{background:var(--accent);border-color:var(--accent);color:#000;}
.clear-btn{margin-left:auto;background:transparent;border:none;color:var(--hard);cursor:pointer;font-size:12px;padding:6px 10px;border-radius:6px;opacity:0.7;transition:opacity .2s;}
.clear-btn:hover{opacity:1;}

/* ── DECK SECTIONS ── */
.deck-sections{display:flex;flex-direction:column;gap:32px;margin-bottom:40px;}
.deck-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden;}
.deck-section-header{
  display:flex;align-items:center;gap:12px;padding:16px 20px;
  background:linear-gradient(90deg,rgba(var(--deck-color-raw,162,155,254),0.08) 0%,transparent 100%);
  border-bottom:1px solid var(--border);
}
.dsh-icon{font-size:20px;font-family:var(--font-brand);font-weight:900;color:var(--deck-color,var(--accent));}
.dsh-title{font-family:var(--font-brand);font-weight:800;font-size:17px;flex:1;color:var(--deck-color,var(--accent));}
.dsh-count{font-size:12px;color:var(--muted);font-weight:700;background:var(--surface2);padding:3px 10px;border-radius:20px;}

.sub-groups{display:flex;flex-direction:column;gap:0;}
.sub-group{padding:16px 20px;border-bottom:1px solid var(--border);}
.sub-group:last-child{border-bottom:none;}
.sub-group-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.sub-group-label{font-size:13px;font-weight:700;font-family:var(--font-brand);letter-spacing:.3px;}
.count-pill{background:var(--surface2);color:var(--muted);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;margin-left:4px;}
.empty-sub{color:var(--muted);font-size:13px;padding:8px 0;opacity:0.5;}
.empty{color:var(--muted);text-align:center;padding:48px 0;font-size:15px;}

/* DECK LIST ITEMS */
.deck-list{display:flex;flex-direction:column;gap:8px;}
.deck-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-radius:var(--radius-sm);background:var(--surface2);border:1px solid transparent;transition:all .2s;}
.deck-item:hover{border-color:var(--accent);background:var(--surface);}
.deck-content{display:flex;align-items:center;gap:10px;min-width:0;flex:1;}
.deck-front{font-family:var(--font-brand);font-weight:800;font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%;}
.deck-arrow{color:var(--muted);font-size:10px;flex-shrink:0;}
.deck-back{color:var(--accent);font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.del-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:5px 8px;border-radius:6px;transition:color .2s;flex-shrink:0;}
.del-btn:hover{color:var(--hard);}

/* STUDY / FLASHCARD */
.card-wrapper{perspective:1500px;margin-bottom:30px;width:100%;max-width:500px;margin-left:auto;margin-right:auto;}
.card{position:relative;width:100%;min-height:320px;transform-style:preserve-3d;transition:transform .6s cubic-bezier(0.34,1.56,0.64,1);cursor:pointer;-webkit-user-select:none;user-select:none;}
.card.flipped{transform:rotateY(180deg);}
.card-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:var(--radius-xl);border:2px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:safe center;padding:30px;box-shadow:0 15px 40px rgba(0,0,0,0.4);}
.card-face::-webkit-scrollbar{width:6px;}
.card-face::-webkit-scrollbar-track{background:transparent;}
.card-face::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px;}
.card-face-label{position:absolute;top:20px;left:24px;font-size:10px;font-weight:800;letter-spacing:2px;color:var(--muted);opacity:0.4;text-transform:uppercase;}
.card-hint{position:absolute;bottom:24px;font-size:11px;color:var(--muted);font-weight:700;opacity:0.5;letter-spacing:1px;text-transform:uppercase;}
.card-front{background:linear-gradient(145deg,var(--surface),var(--surface2));}
.card-back{background:var(--surface2);transform:rotateY(180deg);border-color:var(--accent);}
.card-text{font-family:var(--font-brand);font-size:clamp(20px,8vw,44px);font-weight:900;text-align:center;line-height:1.2;letter-spacing:-1px;word-break:break-word;max-width:100%;}
.grade-row{margin-top:30px;animation:fadeUp .3s ease;width:100%;max-width:500px;margin-left:auto;margin-right:auto;}
.grade-label{text-align:center;font-size:13px;color:var(--muted);margin-bottom:18px;font-weight:600;letter-spacing:.5px;}
.grade-btns{display:flex;gap:12px;}
.grade-btn{flex:1;padding:16px 12px;border-radius:var(--radius-lg);border:1px solid var(--border);background:var(--surface);font-family:var(--font-brand);font-size:15px;font-weight:800;cursor:pointer;transition:all .2s;}
.grade-btn.easy{color:var(--easy);border-color:var(--easy);background:rgba(0,209,160,.05);}
.grade-btn.easy:hover{background:var(--easy);color:#000;transform:translateY(-2px);}
.grade-btn.medium{color:var(--medium);border-color:var(--medium);background:rgba(255,204,102,.05);}
.grade-btn.medium:hover{background:var(--medium);color:#000;transform:translateY(-2px);}
.grade-btn.hard{color:var(--hard);border-color:var(--hard);background:rgba(255,118,117,.05);}
.grade-btn.hard:hover{background:var(--hard);color:#000;transform:translateY(-2px);}
.progress{margin-bottom:28px;max-width:500px;margin-left:auto;margin-right:auto;}
.progress-meta{display:flex;justify-content:space-between;margin-bottom:10px;align-items:baseline;}
.progress-text{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.progress-pct{font-size:14px;color:var(--accent);font-weight:900;font-family:var(--font-brand);}
.progress-bar{height:8px;background:var(--surface2);border-radius:99px;overflow:hidden;border:1px solid var(--border);}
.progress-fill{height:100%;background:var(--accent);border-radius:99px;transition:width .6s cubic-bezier(0.34,1.56,0.64,1);}
.honesty-note{text-align:center;font-size:11px;color:var(--muted);margin-top:24px;opacity:.5;font-weight:500;}
.done-banner{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px;background:var(--surface);padding:60px 30px;border-radius:var(--radius-xl);border:1px solid var(--border);box-shadow:0 20px 60px rgba(0,0,0,.4);max-width:500px;margin:20px auto;}
.done-title{font-family:var(--font-brand);font-size:24px;font-weight:900;line-height:1.2;}
.done-sub{color:var(--muted);font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;}
.done-actions{display:flex;gap:12px;justify-content:center;width:100%;flex-wrap:wrap;}
.medium-btn{flex:1;min-width:140px;padding:16px 20px;font-size:16px;border-radius:var(--radius-md);}

/* BOTTOM NAV */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:90;background:rgba(18,18,34,.95);backdrop-filter:blur(24px);border-top:1px solid var(--border);padding:12px 16px env(safe-area-inset-bottom,24px);gap:10px;box-shadow:0 -10px 40px rgba(0,0,0,.3);}
.bottom-nav .nav-btn{flex:1;padding:12px;font-size:13px;}

/* ═══════════════════════════════════
   RESPONSIVE
═══════════════════════════════════ */

/* Tablet: 2+2 for overview, 2 col for deck stats */
@media(max-width:900px){
  .overview-stats{grid-template-columns:repeat(2,1fr);}
  .deck-stats-grid{grid-template-columns:repeat(2,1fr);}
}

/* Large mobile */
@media(max-width:768px){
  .main{padding-top:24px;padding-bottom:130px;padding-left:16px;padding-right:16px;}
  .inputs-row{grid-template-columns:1fr;}
  .deck-stat-row{gap:4px;}
  .ds-lbl{display:none;}
}

/* Mobile */
@media(max-width:600px){
  .header{height:64px;padding:0 16px;}
  .logo{font-size:22px;}
  .section-title{font-size:20px;margin-bottom:16px;}
  .bottom-nav{display:flex;}
  .header-nav{display:none;}
  .form{padding:16px;margin-bottom:28px;}
  .add-btn{font-size:16px;padding:14px;}
  .grade-btn{font-size:14px;padding:14px 8px;}
  .card-face{padding:24px;}
  .card{min-height:280px;}
  .done-banner{padding:40px 20px;}
  /* Full-width overview on mobile */
  .overview-stats{grid-template-columns:repeat(2,1fr);gap:8px;}
  .overview-stat{padding:16px 10px;}
  .overview-stat-num{font-size:22px;}
  /* Single col deck stats on small mobile */
  .deck-stats-grid{grid-template-columns:1fr;gap:10px;}
  .deck-stat-card{padding:16px;}
  /* Show label again since space is wider now */
  .ds-lbl{display:block;}
  .filter-tabs{gap:6px;padding:12px;}
  .filter-tab{padding:7px 12px;font-size:12px;}
  .deck-section-header{padding:14px 16px;}
  .sub-group{padding:12px 16px;}
  .deck-item{padding:10px 12px;}
}

/* Very small screens */
@media(max-width:380px){
  .overview-stats{grid-template-columns:repeat(2,1fr);}
  .grade-btns{gap:6px;}
  .grade-btn{font-size:13px;padding:12px 4px;}
}
`;