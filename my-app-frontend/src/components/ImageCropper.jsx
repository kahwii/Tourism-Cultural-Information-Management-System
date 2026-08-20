import { useEffect, useRef, useState, useCallback } from "react";

/*
  Lightweight crop/reposition/zoom tool, used before an image is uploaded.

  Why this exists: the poster/banner preview everywhere in the app (list
  thumbnail, calendar card, form preview) is a fixed-ratio box rendered with
  CSS `object-fit: cover`. The backend only resizes the uploaded file — it
  never crops — so whatever the browser auto-crops to (usually the vertical
  center) is what everyone sees. There was no way to pick which part of a
  tall photo stayed visible. This lets the user drag/zoom the photo into the
  frame themselves; the exact pixels they see are the exact pixels saved.

  Usage:
    <ImageCropper file={file} aspect={2.86} onCancel={...} onApply={(blob) => ...} />

  `onApply` receives a JPEG Blob already cropped to `aspect`, ready to hand
  to the same upload function that used to take the raw file.
*/
export default function ImageCropper({ file, aspect = 2.86, onCancel, onApply }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null); // { startX, startY, startPosX, startPosY } while dragging

  const [objectUrl, setObjectUrl] = useState(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // top-left of image, in container px
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);

  const CW = 400;
  const CH = Math.round(CW / aspect);

  // Load the file into an <img> to read its natural size.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setReady(false);
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = natural ? Math.max(CW / natural.w, CH / natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural ? natural.w * scale : 0;
  const dispH = natural ? natural.h * scale : 0;

  const clamp = useCallback((p, dw, dh) => {
    const minX = Math.min(0, CW - dw);
    const minY = Math.min(0, CH - dh);
    return { x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) };
  }, [CW, CH]);

  // Center the image the first time its size is known.
  useEffect(() => {
    if (!ready || !natural) return;
    setPos(clamp({ x: (CW - dispW) / 2, y: (CH - dispH) / 2 }, dispW, dispH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const onZoomChange = (nextZoom) => {
    if (!natural) { setZoom(nextZoom); return; }
    // Keep the point currently at the center of the frame fixed while zooming.
    const oldScale = baseScale * zoom;
    const newScale = baseScale * nextZoom;
    const cx = (CW / 2 - pos.x) / oldScale;
    const cy = (CH / 2 - pos.y) / oldScale;
    const newDispW = natural.w * newScale;
    const newDispH = natural.h * newScale;
    const newPos = clamp({ x: CW / 2 - cx * newScale, y: CH / 2 - cy * newScale }, newDispW, newDispH);
    setZoom(nextZoom);
    setPos(newPos);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: pos };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp({ x: dragRef.current.startPos.x + dx, y: dragRef.current.startPos.y + dy }, dispW, dispH));
  };
  const onPointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  const apply = () => {
    if (!natural || !imgRef.current) return;
    const OUT_W = 1200;
    const OUT_H = Math.round(OUT_W / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");

    const sx = -pos.x / scale;
    const sy = -pos.y / scale;
    const sw = CW / scale;
    const sh = CH / scale;

    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
    canvas.toBlob((blob) => { if (blob) onApply(blob); }, "image/jpeg", 0.92);
  };

  if (!file) return null;

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={title}>Position the image</div>
        <div style={hint}>Drag to reposition, use the slider to zoom. This is exactly what will be saved.</div>

        <div
          ref={containerRef}
          style={{ ...frame, width: CW, height: CH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {objectUrl && (
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: pos.x, top: pos.y,
                width: dispW, height: dispH,
                cursor: dragging ? "grabbing" : "grab",
                userSelect: "none",
              }}
            />
          )}
          {!ready && <div style={loading}>Loading…</div>}
        </div>

        <div style={zoomRow}>
          <span style={zoomLabel}>Zoom</span>
          <input
            type="range" min="1" max="3" step="0.01" value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            style={{ flex: 1 }}
            disabled={!ready}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button type="button" style={cancelBtn} className="tc-btn" onClick={onCancel}>Cancel</button>
          <button type="button" style={applyBtn} className="tc-btn tc-btn-primary" onClick={apply} disabled={!ready}>Use this crop</button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };
const box = { background: "#fff", borderRadius: "16px", padding: "22px", width: "460px", maxWidth: "94vw", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const title = { fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 };
const hint = { fontSize: 12.5, color: "#64748b", marginBottom: 14 };
const frame = { position: "relative", overflow: "hidden", borderRadius: "10px", border: "1px solid #e6ecf5", background: "#f1f5f9", margin: "0 auto", touchAction: "none" };
const loading = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 };
const zoomRow = { display: "flex", alignItems: "center", gap: 10, marginTop: 14 };
const zoomLabel = { fontSize: 12.5, color: "#475569", fontWeight: 600, width: 40 };
const cancelBtn = { padding: "9px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#334155", fontSize: 13.5, cursor: "pointer" };
const applyBtn = { padding: "9px 18px", borderRadius: "10px", border: "none", background: "#2451c4", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
