import { useState, useMemo } from "react";
import { getTrivia } from "../data/trivia";

/**
 * Trivia gate shown after GPS verification succeeds.
 * The tourist must answer correctly to complete the check-in.
 *  - place: place name (string)
 *  - onPass: called when the answer is correct (do the actual check-in)
 *  - onClose: called to dismiss without checking in
 */
export default function CheckInTrivia({ place, onPass, onClose }) {
  const [q, setQ] = useState(() => getTrivia(place));
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(""); // "correct" | "wrong" | ""
  const key = useMemo(() => Math.random(), [q]); // reset animation per question

  const choose = (i) => {
    if (result === "correct") return;
    setPicked(i);
    if (i === q.answer) {
      setResult("correct");
      setTimeout(() => onPass(), 700);
    } else {
      setResult("wrong");
    }
  };

  const retry = () => { setQ(getTrivia(place)); setPicked(null); setResult(""); };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} key={key} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 34 }}></div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#111827" }}>Check-in Challenge</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Answer correctly to check in at <b>{place}</b></div>
        </div>

        <div style={question}>{q.q}</div>

        <div style={{ display: "grid", gap: 10 }}>
          {q.choices.map((c, i) => {
            const isPicked = picked === i;
            const showCorrect = result && i === q.answer;
            const showWrong = result === "wrong" && isPicked && i !== q.answer;
            return (
              <button key={i} onClick={() => choose(i)} disabled={result === "correct"}
                style={{
                  ...choice,
                  ...(showCorrect ? choiceCorrect : {}),
                  ...(showWrong ? choiceWrong : {}),
                }}>
                <span style={letter}>{String.fromCharCode(65 + i)}</span> {c}
              </button>
            );
          })}
        </div>

        {result === "correct" && <div style={{ ...msg, color: "#16a34a" }}>Correct! Checking you in…</div>}
        {result === "wrong" && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ ...msg, color: "#dc2626", marginBottom: 8 }}>Wrong. Try again!</div>
            <button style={retryBtn} onClick={retry}>Another question</button>
          </div>
        )}

        <button style={cancelBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 };
const modal = { background: "#fff", borderRadius: 18, padding: 24, width: 460, maxWidth: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const question = { margin: "16px 0 14px", fontSize: 16, fontWeight: 600, color: "#111827", textAlign: "center", lineHeight: 1.4 };
const choice = { display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "#f8fafc", border: "1px solid #e6ecf5", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#374151", cursor: "pointer", width: "100%" };
const choiceCorrect = { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", fontWeight: 600 };
const choiceWrong = { background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" };
const letter = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#e5edff", color: "#2563eb", fontWeight: 700, fontSize: 12, flexShrink: 0 };
const msg = { marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 600 };
const retryBtn = { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const cancelBtn = { width: "100%", marginTop: 16, background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer" };
