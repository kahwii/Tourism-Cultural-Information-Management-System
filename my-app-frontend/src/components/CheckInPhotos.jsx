import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Anti-cheat photo proof: photos MUST be captured live with the camera
 * (no gallery uploads). Each shot is stamped with place, time, and coords.
 *  - place: place name
 *  - coords: { lat, lon } | null   (from the GPS check)
 *  - onSubmit(selfieFile, siteFile): async; performs the check-in
 *  - onClose: dismiss
 */
export default function CheckInPhotos({ place, coords, onSubmit, onClose }) {
  const STEPS = [
    { key: "selfie", label: "Take a Selfie", facing: "user", hint: "You in front of the site" },
    { key: "site",   label: "Photo of the Site", facing: "environment", hint: "Photo of the heritage site" },
  ];
  const [stepIdx, setStepIdx] = useState(0);
  const [shots, setShots] = useState({});   // { selfie: {blob,url}, site: {blob,url} }
  const [camError, setCamError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const step = STEPS[stepIdx];
  const reviewing = stepIdx >= STEPS.length;

  const stopCam = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const startCam = useCallback(async (facing) => {
    setCamError(""); setReady(false); stopCam();
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); // desktop fallback
      }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setReady(true);
    } catch (e) {
      setCamError("Cannot access the camera. Please allow camera permission in your browser (and use localhost/HTTPS).");
    }
  }, [stopCam]);

  // (re)start the camera for the current capture step
  useEffect(() => {
    if (!reviewing) startCam(step.facing);
    return stopCam;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  const capture = () => {
    const v = videoRef.current; if (!v) return;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    // watermark: place • datetime • coords (proof stamp)
    const stamp = [
      place,
      new Date().toLocaleString(),
      coords ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : "",
    ].filter(Boolean);
    const pad = Math.round(w * 0.02), fs = Math.max(14, Math.round(w * 0.028));
    ctx.font = `bold ${fs}px sans-serif`; ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - (stamp.length * (fs + 6)) - pad, w, (stamp.length * (fs + 6)) + pad);
    ctx.fillStyle = "#fff";
    stamp.forEach((line, i) => ctx.fillText(line, pad, h - pad - (stamp.length - 1 - i) * (fs + 6)));

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setShots(prev => ({ ...prev, [step.key]: { blob, url } }));
      stopCam();
      setStepIdx(i => i + 1);
    }, "image/jpeg", 0.9);
  };

  const retake = (key) => {
    setShots(prev => { const n = { ...prev }; delete n[key]; return n; });
    const idx = STEPS.findIndex(s => s.key === key);
    setStepIdx(idx);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const selfie = new File([shots.selfie.blob], "selfie.jpg", { type: "image/jpeg" });
      const site = new File([shots.site.blob], "site.jpg", { type: "image/jpeg" });
      await onSubmit(selfie, site);
    } catch (e) {
      setCamError(e.message || "Check-in failed.");
      setBusy(false);
    }
  };

  const close = () => { stopCam(); onClose(); };

  return (
    <div style={overlay} onClick={close}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>Live Photo Proof</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Capture LIVE with your camera to check in at <b>{place}</b> (gallery not allowed)
          </div>
        </div>

        {!reviewing ? (
          <>
            <div style={{ fontWeight: 700, color: "#1D4ED8", textAlign: "center", marginBottom: 8 }}>
              Step {stepIdx + 1} of {STEPS.length}: {step.label}
            </div>
            <div style={camWrap}>
              {camError ? (
                <div style={{ padding: 20, color: "#dc2626", fontSize: 13, textAlign: "center" }}>{camError}</div>
              ) : (
                <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", margin: "8px 0" }}>{step.hint}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={cancelBtn} className="tc-btn" onClick={close}>Cancel</button>
              <button style={captureBtn} onClick={capture} disabled={!ready || !!camError}>Capture</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              {STEPS.map(s => (
                <div key={s.key} style={{ textAlign: "center" }}>
                  <img src={shots[s.key]?.url} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid #e6ecf5" }} />
                  <button style={retakeBtn} onClick={() => retake(s.key)}>Retake {s.key === "selfie" ? "selfie" : "site"}</button>
                </div>
              ))}
            </div>
            {camError && <div style={{ marginTop: 10, fontSize: 13, color: "#dc2626", textAlign: "center" }}>{camError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={cancelBtn} className="tc-btn" onClick={close} disabled={busy}>Cancel</button>
              <button style={submitBtn} className="tc-btn tc-btn-primary" onClick={submit} disabled={busy}>{busy ? "Checking in…" : "Submit & Check in"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 };
const modal = { background: "#fff", borderRadius: 18, padding: 22, width: 460, maxWidth: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const camWrap = { width: "100%", height: 260, background: "#0f172a", borderRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
const cancelBtn = { flex: 1, background: "#F5F8FC", color: "#374151", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, cursor: "pointer" };
const captureBtn = { flex: 2, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const submitBtn = { flex: 2, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const retakeBtn = { marginTop: 6, background: "#eff6ff", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%" };
