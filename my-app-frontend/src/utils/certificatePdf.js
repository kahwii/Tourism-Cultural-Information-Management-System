import jsPDF from "jspdf";

/* ---- Official CCAT signatories (edit here if they change) ---- */
export const CCAT_HEAD = { name: "NOLAN V. ANGELES", title: "Head, City Cultural Affairs & Tourism Development Department" };
export const CITY_MAYOR = { name: "BENJAMIN S. ABALOS", title: "Mayor, Mandaluyong City" };
export const TOURISM_CODE = "City Ordinance No. 877, S-2022";

/* Load the city logo as a data URL so jsPDF can embed it. Fails quietly. */
async function loadLogo() {
  try {
    const res = await fetch("/mandaluyong-logo.png?v=2");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* Accepts either camelCase (admin UI) or snake_case (raw DB row). */
function normalize(a) {
  return {
    establishment: a.establishment ?? "",
    address: a.address ?? "",
    controlNo: a.controlNo ?? a.control_no ?? "—",
    businessAccountNo: a.businessAccountNo ?? a.business_account_no ?? "—",
    orNo: a.orNo ?? a.or_no ?? "—",
    issued: a.issued ?? "—",
    expiry: a.expiry ?? "—",
  };
}

/* ---- Official Certificate of Registration (Tourism Oriented & Related Enterprises) ---- */
export async function generateCertificate(record) {
  const a = normalize(record);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const year = (a.issued && a.issued !== "—") ? a.issued.split(",").pop().trim() : new Date().getFullYear();
  const blue = [13, 71, 161];

  // outer border
  doc.setDrawColor(...blue); doc.setLineWidth(0.6); doc.rect(8, 8, W - 16, H - 16);

  // header band
  doc.setFillColor(...blue); doc.rect(8, 8, W - 16, 26, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("CERTIFICATE OF REGISTRATION " + year, W / 2 + 14, 19, { align: "center" });
  doc.setFontSize(12);
  doc.text("TOURISM ORIENTED AND RELATED ENTERPRISES", W / 2 + 14, 28, { align: "center" });

  // city logo (left side of band); text fallback if it can't load
  const logo = await loadLogo();
  if (logo) {
    try { doc.addImage(logo, "PNG", 13, 10.5, 21, 21); } catch { /* skip logo */ }
    doc.setFontSize(7); doc.text("CITY OF MANDALUYONG • CCAT", 23.5, 33.5, { align: "center" });
  } else {
    doc.setFontSize(7); doc.text("CITY OF MANDALUYONG  •  CCAT", 14, 22);
  }

  // reference numbers (right)
  doc.setTextColor(17, 24, 39); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  let ry = 44;
  const field = (label, val) => {
    doc.setFont("helvetica", "bold"); doc.text(label, W - 95, ry);
    doc.setFont("helvetica", "normal"); doc.text(String(val), W - 50, ry);
    ry += 6;
  };
  field("CONTROL NO.", a.controlNo);
  field("BUSINESS ACCOUNT NO.", a.businessAccountNo);
  field("OR NO.", a.orNo);

  // business name
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(17, 24, 39);
  doc.text(a.establishment.toUpperCase(), W / 2, 70, { align: "center" });
  doc.setDrawColor(120); doc.setLineWidth(0.3); doc.line(40, 74, W - 40, 74);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
  doc.text("BUSINESS NAME", W / 2, 80, { align: "center" });

  // business address
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(17, 24, 39);
  doc.text(a.address.toUpperCase(), W / 2, 92, { align: "center" });
  doc.line(40, 96, W - 40, 96);
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text("BUSINESS ADDRESS", W / 2, 102, { align: "center" });

  // body text
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40);
  const body = `This is to certify that the above mentioned business/enterprise has complied with all the requirements for Tourism Oriented/Related enterprises. This Certificate shall be displayed in a conspicuous area in the place of business, pursuant to the provisions of ${TOURISM_CODE}, otherwise known as the Tourism Code of the City of Mandaluyong.`;
  doc.text(doc.splitTextToSize(body, W - 60), 30, 116);

  // issued + validity lines
  const issued = a.issued && a.issued !== "—" ? a.issued : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.setFontSize(11); doc.setTextColor(17, 24, 39);
  doc.text(`Issued this ${issued} in the City of Mandaluyong.`, 30, 140);
  if (a.expiry && a.expiry !== "—") {
    doc.setFontSize(10); doc.setTextColor(90);
    doc.text(`Valid until ${a.expiry}.`, 30, 147);
  }

  // signatories
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(17, 24, 39);
  doc.text(CCAT_HEAD.name, 70, 168, { align: "center" });
  doc.text(CITY_MAYOR.name, W - 70, 168, { align: "center" });
  doc.setDrawColor(120); doc.line(35, 166, 105, 166); doc.line(W - 105, 166, W - 35, 166);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90);
  doc.text(doc.splitTextToSize(CCAT_HEAD.title, 75), 70, 173, { align: "center" });
  doc.text(CITY_MAYOR.title, W - 70, 173, { align: "center" });

  // bottom banner
  doc.setFillColor(...blue); doc.rect(8, H - 22, W - 16, 14, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("MANDALEÑO DISIPLINADO  •  GAWA HINDI SALITA", W / 2, H - 13, { align: "center" });

  doc.save(`Certificate_${a.controlNo}_${a.establishment.replace(/\s+/g, "_")}.pdf`);
}
