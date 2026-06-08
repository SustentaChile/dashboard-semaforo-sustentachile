const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHN_YbDbr6pVzibcd62wgKuqnIS2xyUGIaWiV8XeSYjJ_2RV7mGupuQTit0W23Qpkm/exec";

export default async function handler(req, res) {
  try {
    const query = new URLSearchParams(req.query).toString();

    const url = query
      ? `${APPS_SCRIPT_URL}?${query}`
      : APPS_SCRIPT_URL;

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });

    const text = await response.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    return res.status(200).send(text);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Error consultando Apps Script",
    });
  }
}
