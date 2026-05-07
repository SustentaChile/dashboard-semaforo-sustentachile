// @ts-nocheck
import React, { useMemo, useState, useEffect } from "react";

const API_URL = "https://script.google.com/macros/s/AKfycbyvj4Ao28AJQnQX8-lnBI-oY8D0P9W5026YqjwQfFWbCJ2J-tFdc-hc8_DryFsKeFud/exec";
const PPTOS_API = `${API_URL}?action=pptos`;

const CATEGORIES = [
  { id: "TODOS", label: "Todos" },
  { id: "COMPRESORES", label: "Compresores" },
  { id: "CONDENSADORES", label: "Condensadores" },
  { id: "MUEBLES_REMOTOS", label: "Muebles remotos" },
  { id: "AUTONOMAS", label: "Autónomas" },
];

function cleanApiUrl(url) {
  return String(url || "").trim().split("?")[0].replace(/\/$/, "");
}

function makeUrl(base, params) {
  return `${cleanApiUrl(base)}?${new URLSearchParams(params).toString()}`;
}

function getTone(value) {
  if (value === "ROJO" || value === "FALLA CRITICA") {
    return { color: "#ff4257", bg: "rgba(255,66,87,.14)", border: "rgba(255,66,87,.28)" };
  }
  if (value === "AMARILLO" || value === "OBSERVADO") {
    return { color: "#ffc928", bg: "rgba(255,201,40,.14)", border: "rgba(255,201,40,.28)" };
  }
  return { color: "#20d071", bg: "rgba(32,208,113,.14)", border: "rgba(32,208,113,.28)" };
}

function normalizeSummary(summary) {
  const total = summary?.total || 0;
  const criticos = summary?.criticos || 0;
  const observados = summary?.observados || 0;
  const operativos = Math.max(0, total - criticos);
  const equiposSinDetalle = Math.max(0, total - criticos - observados);
  const porcentajeSinDetalle = total ? Number(((equiposSinDetalle / total) * 100).toFixed(1)) : 0;
  const saludGeneral = total ? Number((((total - criticos) / total) * 100).toFixed(1)) : 0;

  let semaforo = "VERDE";
  if (criticos > 0) semaforo = "ROJO";
  else if (observados > 0) semaforo = "AMARILLO";

  return {
    ...summary,
    total,
    operativos,
    observados,
    criticos,
    equiposSinDetalle,
    porcentajeOperativo: porcentajeSinDetalle,
    porcentajeSinDetalle,
    saludGeneral,
    semaforo,
  };
}

function buildSummaryFromAssets(assets) {
  const total = assets.length;
  const criticos = assets.filter((asset) => asset.estado === "FALLA CRITICA").length;
  const observados = assets.filter((asset) => asset.estado === "OBSERVADO").length;
  return normalizeSummary({ total, criticos, observados });
}

function buildGlobalSummary(localsData) {
  const list = (localsData || []).map((item) => ({ ...item, summary: normalizeSummary(item.summary) }));
  const total = list.reduce((sum, item) => sum + (item.summary.total || 0), 0);
  const criticos = list.reduce((sum, item) => sum + (item.summary.criticos || 0), 0);
  const observados = list.reduce((sum, item) => sum + (item.summary.observados || 0), 0);
  const base = normalizeSummary({ total, criticos, observados });
  const rojos = list.filter((item) => item.summary.semaforo === "ROJO").length;
  const amarillos = list.filter((item) => item.summary.semaforo === "AMARILLO").length;
  const verdes = list.filter((item) => item.summary.semaforo === "VERDE").length;
  return { ...base, locales: list.length, verdes, amarillos, rojos };
}

function getYearFromDate(value) {
  const parts = String(value || "").trim().split("/");
  if (parts.length !== 3) return "";
  return parts[2] || "";
}

function getAssetCategory(asset) {
  const text = [asset.section, asset.claseActivo, asset.tipo, asset.modelo, asset.observacion, asset.pendiente]
    .join(" ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (text.includes("COMPRESOR") || text.includes("SEMI-HERMETICO") || text.includes("CENTRAL MEDIA") || text.includes("CENTRAL BAJA")) return "COMPRESORES";
  if (text.includes("CONDENSADOR") || text.includes("VENTILADOR") || text.includes("AXIAL")) return "CONDENSADORES";
  if (text.includes("AUTONOMA") || text.includes("AUTONOMO") || text.includes("AUTONOMAS")) return "AUTONOMAS";
  if (text.includes("MUEBLE") || text.includes("MUEBLES") || text.includes("REMOTO") || text.includes("VITRINA") || text.includes("MURAL") || text.includes("EXHIBICION")) return "MUEBLES_REMOTOS";
  return "OTROS";
}

function Card({ title, value, tone, onClick, active }) {
  return (
    <button type="button" className={`card ${onClick ? "cardButton" : ""} ${active ? "cardActive" : ""}`} onClick={onClick}>
      <div className="cardTitle">{title}</div>
      <div className="cardValue" style={{ color: tone?.color || "#fff" }}>{value}</div>
    </button>
  );
}

function LocalButton({ local, onClick }) {
  const metrics = normalizeSummary(local.summary);
  const tone = getTone(metrics.semaforo);
  return (
    <button type="button" className="localButton" onClick={onClick} style={{ borderColor: tone.border }}>
      <span>{local.local}</span>
    </button>
  );
}

function HealthBar({ summary }) {
  const metrics = normalizeSummary(summary);
  const tone = getTone(metrics.criticos > 0 ? "ROJO" : "VERDE");
  return (
    <div className="barBg">
      <div className="bar" style={{ width: `${Math.min(100, Math.max(0, metrics.saludGeneral || 0))}%`, background: tone.color }} />
    </div>
  );
}

export default function DashboardSemaforo() {
  const [localsData, setLocalsData] = useState([]);
  const [selectedLocal, setSelectedLocal] = useState("TODOS");
  const [activeView, setActiveView] = useState("RESUMEN");
  const [assetCategory, setAssetCategory] = useState("TODOS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("Cargando datos iniciales...");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [pptosData, setPptosData] = useState([]);
  const [pptosLoading, setPptosLoading] = useState(false);
  const [pptoView, setPptoView] = useState("");
  const [selectedPpto, setSelectedPpto] = useState(null);
  const [pptoYearFilter, setPptoYearFilter] = useState(String(new Date().getFullYear()));

  async function fetchJson(url) {
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("La respuesta no fue JSON. Revisa que estés usando la URL /exec y no la URL /echo.");
    }
  }

  async function loadAllLocals() {
    const url = cleanApiUrl(API_URL);
    setLoading(true);
    setError("");
    setProgress("Buscando hojas del archivo...");
    try {
      const localsResponse = await fetchJson(makeUrl(url, { action: "locals" }));
      if (!localsResponse.ok) throw new Error(localsResponse.error || localsResponse.message || "No se pudo obtener la lista de locales.");

      const sheetNames = (localsResponse.sheets || []).filter((name) => name && name !== "LogsAccesos" && name !== "BASE_EQUIPOS" && name !== "RESUMEN_LOCALES" && name !== "DASHBOARD");
      if (!sheetNames.length) throw new Error("No se encontraron hojas/locales en el archivo.");

      const results = [];
      const failed = [];
      for (let i = 0; i < sheetNames.length; i++) {
        const sheet = sheetNames[i];
        setProgress(`Cargando ${i + 1} de ${sheetNames.length}: ${sheet}`);
        try {
          const localJson = await fetchJson(makeUrl(url, { sheet }));
          if (localJson.ok) results.push({ ...localJson, summary: normalizeSummary(localJson.summary) });
          else failed.push(`${sheet}: ${localJson.error || localJson.message || "error"}`);
        } catch (err) {
          failed.push(`${sheet}: ${err.message}`);
        }
      }

      if (!results.length) throw new Error("No se pudo cargar ningún local.");
      setLocalsData(results);
      setProgress(`Locales cargados: ${results.length}${failed.length ? ` | Fallidos: ${failed.length}` : ""}`);
      if (failed.length) setError(`Algunos locales no cargaron: ${failed.slice(0, 3).join(" | ")}${failed.length > 3 ? "..." : ""}`);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los locales.");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  async function loadPptos(localName) {
    try {
      setPptosLoading(true);
      setPptosData([]);
      setPptoView("");
      setSelectedPpto(null);
      const data = await fetchJson(`${PPTOS_API}&local=${encodeURIComponent(localName)}`);
      if (data.ok) setPptosData(data.pptos || []);
    } catch (err) {
      console.error("Error cargando PPTOS", err);
    } finally {
      setPptosLoading(false);
    }
  }

  useEffect(() => {
    loadAllLocals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLocal === "TODOS") {
      setPptosData([]);
      setPptoView("");
      setSelectedPpto(null);
      return;
    }
    loadPptos(selectedLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocal]);

  const isLocalPage = selectedLocal !== "TODOS";

  const selectedLocalData = useMemo(() => localsData.find((item) => item.local === selectedLocal) || null, [localsData, selectedLocal]);

  const visibleLocals = useMemo(() => {
    if (selectedLocal === "TODOS") return localsData;
    return selectedLocalData ? [selectedLocalData] : [];
  }, [localsData, selectedLocal, selectedLocalData]);

  const allAssets = useMemo(() => visibleLocals.flatMap((local) => (local.assets || []).map((asset) => ({ ...asset, local: local.local }))), [visibleLocals]);

  const categoryAssets = useMemo(() => {
    if (assetCategory === "TODOS") return allAssets;
    return allAssets.filter((asset) => getAssetCategory(asset) === assetCategory);
  }, [allAssets, assetCategory]);

  const summary = useMemo(() => {
    if (isLocalPage && assetCategory !== "TODOS") return buildSummaryFromAssets(categoryAssets);
    return buildGlobalSummary(visibleLocals);
  }, [isLocalPage, assetCategory, categoryAssets, visibleLocals]);

  const filteredAssets = useMemo(() => {
    let list = categoryAssets;
    if (activeView === "OPERATIVOS") list = categoryAssets.filter((asset) => asset.estado !== "FALLA CRITICA");
    if (activeView === "OBSERVADOS") list = categoryAssets.filter((asset) => asset.estado === "OBSERVADO");
    if (activeView === "CRITICOS") list = categoryAssets.filter((asset) => asset.estado === "FALLA CRITICA");
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((asset) => Object.values(asset).join(" ").toLowerCase().includes(q));
  }, [categoryAssets, activeView, search]);

  const categoryLabel = CATEGORIES.find((cat) => cat.id === assetCategory)?.label || "Activos";
  const detailTitle = activeView === "CATEGORIA" ? `Listado de ${categoryLabel.toLowerCase()}` : activeView === "ACTIVOS" ? "Listado de activos totales" : activeView === "OPERATIVOS" ? "Listado de equipos operativos" : activeView === "OBSERVADOS" ? "Listado de equipos observados" : activeView === "CRITICOS" ? "Listado de fallas críticas" : "";

  const pptoYears = useMemo(() => {
    const years = new Set();
    pptosData.forEach((p) => {
      const year = getYearFromDate(p.fechaPpto) || getYearFromDate(p.fechaOc) || getYearFromDate(p.fechaEjecucion);
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [pptosData]);

  const pptosFiltradosPorFecha = useMemo(() => {
    if (!pptoYearFilter || pptoYearFilter === "TODOS") return pptosData;
    return pptosData.filter((p) => {
      const year = getYearFromDate(p.fechaPpto) || getYearFromDate(p.fechaOc) || getYearFromDate(p.fechaEjecucion);
      return year === pptoYearFilter;
    });
  }, [pptosData, pptoYearFilter]);

  const presupuestosEnviados = useMemo(() => pptosFiltradosPorFecha.filter((p) => String(p.estado || "").toUpperCase().trim() === "ENVIADO"), [pptosFiltradosPorFecha]);
  const presupuestosAprobados = useMemo(() => pptosFiltradosPorFecha.filter((p) => {
    const estado = String(p.estado || "").toUpperCase().trim();
    return estado === "PENDIENTE" || estado === "EN EJECUCION" || estado === "EN EJECUCIÓN";
  }), [pptosFiltradosPorFecha]);
  const presupuestosEjecutados = useMemo(() => pptosFiltradosPorFecha.filter((p) => String(p.estado || "").toUpperCase().trim() === "EJECUTADO"), [pptosFiltradosPorFecha]);

  const pptosList = useMemo(() => {
    if (pptoView === "ENVIADOS") return presupuestosEnviados;
    if (pptoView === "APROBADOS") return presupuestosAprobados;
    if (pptoView === "EJECUTADOS") return presupuestosEjecutados;
    return [];
  }, [pptoView, presupuestosEnviados, presupuestosAprobados, presupuestosEjecutados]);

  const pptoTitle = pptoView === "ENVIADOS" ? "Presupuestos enviados" : pptoView === "APROBADOS" ? "Presupuestos aprobados" : pptoView === "EJECUTADOS" ? "Presupuestos ejecutados" : "";
  const semaforoGeneral = summary.criticos > 0 ? "ROJO" : summary.observados > 0 ? "AMARILLO" : "VERDE";
  const semTone = getTone(semaforoGeneral);

  function openLocal(localName) {
    setSelectedLocal(localName);
    setActiveView("RESUMEN");
    setAssetCategory("TODOS");
    setSearch("");
    setSelectedAsset(null);
    setSelectedPpto(null);
    setPptoView("");
  }

  function goBack() {
    setSelectedLocal("TODOS");
    setActiveView("RESUMEN");
    setAssetCategory("TODOS");
    setSearch("");
    setSelectedAsset(null);
    setSelectedPpto(null);
    setPptoView("");
  }

  return (
    <div className="app">
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #05070d; }
        .app { min-height: 100vh; background: #05070d; color: white; font-family: Arial, Helvetica, sans-serif; }
        .page { width: 100%; max-width: none; margin: 0; padding: 28px; }
        .header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 22px; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .logo { width: 54px; height: 54px; border-radius: 19px; background: rgba(0,217,255,.12); color: #27dfff; display: grid; place-items: center; font-size: 28px; }
        .brandTitle { font-size: 32px; font-weight: 950; line-height: 1; letter-spacing: .02em; }
        .brandSub { color: #9fb0c9; margin-top: 6px; font-size: 15px; }
        .actions { display: flex; align-items: center; gap: 12px; }
        button { border: none; border-radius: 16px; padding: 12px 16px; background: #19d4f2; color: #001019; font-weight: 900; cursor: pointer; }
        button:disabled { opacity: .55; cursor: not-allowed; }
        .backButton { background: rgba(255,255,255,.08); color: white; border: 1px solid rgba(255,255,255,.12); }
        .progress { border: 1px solid rgba(39,223,255,.24); background: rgba(39,223,255,.08); color: #b9f7ff; padding: 14px; border-radius: 18px; margin-bottom: 18px; text-align: center; }
        .progress.small { display: inline-flex; width: auto; max-width: max-content; padding: 8px 14px; border-radius: 999px; font-size: 13px; margin: 0; opacity: .9; }
        .error { border: 1px solid rgba(255,66,87,.35); background: rgba(255,66,87,.12); color: #ffb6bf; padding: 18px; border-radius: 22px; margin-bottom: 18px; }
        .localTabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .localButton { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.1); color: white; min-height: 72px; text-align: left; box-shadow: 0 14px 30px rgba(0,0,0,.18); }
        .localButton span { font-size: 15px; line-height: 1.2; }
        .localButton:hover { background: rgba(39,223,255,.08); transform: translateY(-1px); }
        .dashboardTitle { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 18px; }
        h1 { margin: 0; font-size: 56px; line-height: 1.05; color: #ffffff; font-weight: 950; letter-spacing: .02em; text-shadow: 0 4px 18px rgba(0,0,0,.4); }
        .subtitle { color: #9fb0c9; margin-top: 6px; }
        .categoryTabs { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 20px; }
        .categoryButton { background: rgba(255,255,255,.06); color: #cfe5ff; border: 1px solid rgba(255,255,255,.1); }
        .categoryButtonActive { background: rgba(39,223,255,.16); color: white; border-color: rgba(39,223,255,.55); }
        .cards { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 18px; margin-bottom: 20px; }
        .card { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.1); border-radius: 28px; padding: 22px; min-height: 130px; box-shadow: 0 18px 40px rgba(0,0,0,.22); text-align: center; color: white; }
        .cardButton { cursor: pointer; transition: transform .15s ease, border-color .15s ease, background .15s ease; }
        .cardButton:hover { transform: translateY(-2px); border-color: rgba(39,223,255,.45); background: rgba(39,223,255,.08); }
        .cardActive { border-color: rgba(39,223,255,.75); box-shadow: 0 0 0 1px rgba(39,223,255,.32), 0 18px 40px rgba(0,0,0,.22); }
        .cardTitle { color: #9fb0c9; text-transform: uppercase; letter-spacing: .22em; font-size: 12px; font-weight: 800; }
        .cardValue { margin-top: 18px; font-size: 38px; font-weight: 950; }
        .mainGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .panel { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.1); border-radius: 28px; padding: 22px; box-shadow: 0 18px 40px rgba(0,0,0,.22); }
        .panelTitle { color: #9fb0c9; text-transform: uppercase; letter-spacing: .22em; font-size: 12px; font-weight: 900; text-align: center; }
        .bigPercent { font-size: 68px; font-weight: 950; text-align: center; padding: 28px 10px; border-radius: 24px; border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.25); margin-top: 14px; }
        .barBg { height: 14px; background: #1b2435; border-radius: 999px; overflow: hidden; margin-top: 16px; }
        .bar { height: 100%; border-radius: 999px; }
        .hint { color: #9fb0c9; font-size: 13px; margin-top: 10px; text-align: center; }
        input { width: 100%; background: #111827; border: 1px solid rgba(255,255,255,.12); color: white; border-radius: 12px; padding: 12px; outline: none; }
        .tablePanel { margin-top: 20px; }
        .assetDetail { text-align: left; }
        .detailTop { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
        .localBadge { border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 8px 14px; font-weight: 950; font-size: 13px; background: rgba(255,255,255,.06); }
        .assetTitle { margin: 12px 0 0; font-size: 38px; line-height: 1.1; color: #ffffff; }
        .assetSubtitle { color: #9fb0c9; font-size: 18px; margin-top: 6px; }
        .detailGrid { display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 14px; margin: 24px 0; }
        .detailItem { border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.22); border-radius: 18px; padding: 16px; }
        .detailItem span { display: block; color: #9fb0c9; text-transform: uppercase; letter-spacing: .16em; font-size: 10px; font-weight: 900; margin-bottom: 8px; }
        .detailItem b { color: white; font-size: 16px; }
        .detailBox { border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.22); border-radius: 20px; padding: 18px; margin-top: 14px; }
        .detailBox p { margin: 12px 0 0; color: #dce7f7; line-height: 1.5; white-space: pre-wrap; }
        .tableHeader { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
        .tableBox { max-height: 520px; overflow: auto; border-radius: 18px; border: 1px solid rgba(255,255,255,.08); margin-top: 18px; background: rgba(5,7,13,.72); }
        .filterRow { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
        .filterControl { display: flex; align-items: center; gap: 10px; color: #9fb0c9; font-size: 13px; }
        .filterControl select { background: #111827; border: 1px solid rgba(255,255,255,.12); color: white; border-radius: 12px; padding: 10px 12px; outline: none; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,.07); text-align: left; vertical-align: top; }
        th { color: #dbeafe; background: #101827; position: sticky; top: 0; z-index: 2; font-weight: 900; }
        @media (max-width: 1000px) { .cards { grid-template-columns: repeat(2, 1fr); } .mainGrid { grid-template-columns: 1fr; } .header, .dashboardTitle { flex-direction: column; align-items: stretch; } h1 { font-size: 32px; } }
      `}</style>

      <div className="page">
        <header className="header">
          <div className="brand">
            <div className="logo">⌁</div>
            <div>
              <div className="brandTitle">SUSTENTA</div>
              <div className="brandSub">Dashboard Semáforo</div>
            </div>
          </div>
          <div className="actions">
            {progress ? <div className="progress small">{progress}</div> : null}
            {isLocalPage ? <button className="backButton" onClick={goBack}>← Volver</button> : null}
            <button onClick={loadAllLocals} disabled={loading}>{loading ? "Actualizando..." : "Actualizar datos"}</button>
          </div>
        </header>

        <section className="dashboardTitle">
          <div>
            <h1>{selectedLocal === "TODOS" ? "Resumen general" : selectedLocal}</h1>
            <div className="subtitle">{selectedLocal === "TODOS" ? "Selecciona un local para revisar su estado específico." : "Vista individual del local seleccionado."}</div>
          </div>
        </section>

        {error ? <div className="error">⚠ {error}</div> : null}

        {!isLocalPage ? (
          <section className="localTabs">
            {localsData.map((local) => <LocalButton key={local.local} local={local} onClick={() => openLocal(local.local)} />)}
          </section>
        ) : null}

        {isLocalPage ? (
          <section className="categoryTabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`categoryButton ${assetCategory === cat.id ? "categoryButtonActive" : ""}`}
                onClick={() => {
                  setAssetCategory(cat.id);
                  setActiveView(cat.id === "TODOS" ? "RESUMEN" : "CATEGORIA");
                  setSearch("");
                  setSelectedAsset(null);
                  setSelectedPpto(null);
                  setPptoView("");
                }}
              >
                {cat.label}
              </button>
            ))}
          </section>
        ) : null}

        {!(isLocalPage && activeView === "CATEGORIA") ? (
          <section className="cards">
            {!isLocalPage ? <Card title="Locales" value={summary.locales ?? "-"} onClick={goBack} active={activeView === "RESUMEN" && !isLocalPage} /> : null}
            <Card title="Activos totales" value={summary.total ?? "-"} onClick={() => setActiveView("ACTIVOS")} active={activeView === "ACTIVOS"} />
            <Card title="Operativos" value={summary.operativos ?? "-"} tone={getTone("OPERATIVO")} onClick={() => setActiveView("OPERATIVOS")} active={activeView === "OPERATIVOS"} />
            <Card title="Observados" value={summary.observados ?? "-"} tone={getTone("OBSERVADO")} onClick={() => setActiveView("OBSERVADOS")} active={activeView === "OBSERVADOS"} />
            <Card title="Fallas críticas" value={summary.criticos ?? "-"} tone={getTone("FALLA CRITICA")} onClick={() => setActiveView("CRITICOS")} active={activeView === "CRITICOS"} />
          </section>
        ) : null}

        {activeView === "RESUMEN" ? (
          <>
            <section className="mainGrid">
              <div className="panel">
                <div className="panelTitle">Equipos sin detalle</div>
                <div className="bigPercent" style={{ color: semTone.color }}>{summary.porcentajeSinDetalle ?? 0}%</div>
                <div className="barBg"><div className="bar" style={{ width: `${Math.min(100, Math.max(0, summary.porcentajeSinDetalle || 0))}%`, background: semTone.color }} /></div>
                <div className="hint">Porcentaje descontando observados y críticos.</div>
              </div>

              <div className="panel">
                <div className="panelTitle">Salud general</div>
                <div className="bigPercent" style={{ color: getTone(summary.criticos > 0 ? "ROJO" : "VERDE").color }}>{summary.saludGeneral ?? 0}%</div>
                <HealthBar summary={summary} />
                <div className="hint">Solo descuentan los equipos críticos. Los observados siguen funcionando.</div>
              </div>
            </section>

            {isLocalPage ? (
              <section className="panel tablePanel">
                <div className="filterRow">
                  <div>
                    <div className="panelTitle" style={{ textAlign: "left" }}>Gestión de presupuestos</div>
                    <div className="hint" style={{ textAlign: "left" }}>Filtrado por fecha de PPTO, OC o ejecución.</div>
                  </div>
                  <label className="filterControl">
                    Año
                    <select value={pptoYearFilter} onChange={(event) => { setPptoYearFilter(event.target.value); setSelectedPpto(null); setPptoView(""); }}>
                      <option value="TODOS">Todos</option>
                      {pptoYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
                {pptosLoading ? <div className="hint">Cargando presupuestos...</div> : null}

                <div className="cards" style={{ marginTop: 18 }}>
                  <Card title="Presupuestos enviados" value={presupuestosEnviados.length} tone={getTone("AMARILLO")} onClick={() => { setPptoView("ENVIADOS"); setSelectedPpto(null); }} active={pptoView === "ENVIADOS"} />
                  <Card title="Presupuestos aprobados" value={presupuestosAprobados.length} tone={getTone("OPERATIVO")} onClick={() => { setPptoView("APROBADOS"); setSelectedPpto(null); }} active={pptoView === "APROBADOS"} />
                  <Card title="Presupuestos ejecutados" value={presupuestosEjecutados.length} tone={getTone("VERDE")} onClick={() => { setPptoView("EJECUTADOS"); setSelectedPpto(null); }} active={pptoView === "EJECUTADOS"} />
                </div>

                {pptoView ? (
                  <div className="tableBox">
                    {!selectedPpto ? (
                      <table>
                        <thead>
                          <tr>
                            <th>PPTO</th>
                            {pptoView === "ENVIADOS" ? <th>Fecha PPTO</th> : null}
                            {(pptoView === "APROBADOS" || pptoView === "EJECUTADOS") ? (
                              <>
                                <th>Fecha OC</th>
                                <th>OC</th>
                              </>
                            ) : null}
                            <th>Estado</th>
                            <th>Detalle</th>
                            {pptoView === "EJECUTADOS" ? <th>Rep. ejecución</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {pptosList.map((ppto, index) => (
                            <tr key={`${ppto.ppto}-${index}`} onClick={() => setSelectedPpto(ppto)} style={{ cursor: "pointer" }}>
                              <td>{ppto.ppto || "-"}</td>
                              {pptoView === "ENVIADOS" ? <td>{ppto.fechaPpto || "-"}</td> : null}
                              {(pptoView === "APROBADOS" || pptoView === "EJECUTADOS") ? (
                                <>
                                  <td>{ppto.fechaOc || "-"}</td>
                                  <td>{ppto.oc || "-"}</td>
                                </>
                              ) : null}
                              <td style={{ fontWeight: 900 }}>{ppto.estado || "-"}</td>
                              <td>{ppto.detalle || "-"}</td>
                              {pptoView === "EJECUTADOS" ? <td>{ppto.reporteEjecucion || "-"}</td> : null}
                            </tr>
                          ))}
                          {!pptosList.length ? (
                            <tr><td colSpan={10}>No hay presupuestos en esta categoría.</td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    ) : (
                      <div className="assetDetail">
                        <div className="detailTop">
                          <button className="backButton" onClick={() => setSelectedPpto(null)}>← Volver al listado</button>
                          <div className="localBadge">{selectedPpto.estado || "Sin estado"}</div>
                        </div>
                        <div className="panelTitle" style={{ textAlign: "left" }}>Detalle del presupuesto</div>
                        <h2 className="assetTitle">{selectedPpto.ppto || "Sin PPTO"}</h2>
                        <div className="assetSubtitle">OC: {selectedPpto.oc || "Sin OC"}</div>
                        <div className="detailGrid">
                          <div className="detailItem"><span>Local</span><b>{selectedPpto.codigo || ""} - {selectedPpto.local || "-"}</b></div>
                          <div className="detailItem"><span>Estado</span><b>{selectedPpto.estado || "-"}</b></div>
                          <div className="detailItem"><span>Fecha PPTO</span><b>{selectedPpto.fechaPpto || "-"}</b></div>
                          <div className="detailItem"><span>Fecha OC</span><b>{selectedPpto.fechaOc || "-"}</b></div>
                          <div className="detailItem"><span>Fecha ejecución</span><b>{selectedPpto.fechaEjecucion || "-"}</b></div>
                          <div className="detailItem"><span>Reporte origen</span><b>{selectedPpto.reporteOrigen || "-"}</b></div>
                          <div className="detailItem"><span>Reporte ejecución</span><b>{selectedPpto.reporteEjecucion || "-"}</b></div>
                        </div>
                        <div className="detailBox">
                          <div className="panelTitle" style={{ textAlign: "left" }}>Detalle</div>
                          <p>{selectedPpto.detalle || "Sin detalle registrado."}</p>
                        </div>
                        <div className="detailBox">
                          <div className="panelTitle" style={{ textAlign: "left" }}>Materiales</div>
                          <p>{selectedPpto.materiales || "Sin materiales registrados."}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        ) : (
          <section className="panel tablePanel">
            {!selectedAsset ? (
              <>
                <div className="tableHeader">
                  <div>
                    <div className="panelTitle" style={{ textAlign: "left" }}>{detailTitle}</div>
                    <div className="hint" style={{ textAlign: "left" }}>Total mostrado: {filteredAssets.length}</div>
                  </div>
                  <input style={{ maxWidth: 340 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." />
                </div>
                <div className="tableBox">
                  <table>
                    <thead>
                      <tr>
                        <th>Local</th>
                        <th>Tipo</th>
                        <th>Modelo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map((asset, index) => (
                        <tr key={`${asset.local}-${asset.section}-${asset.item}-${index}`} onClick={() => setSelectedAsset(asset)} style={{ cursor: "pointer" }}>
                          <td>{asset.local}</td>
                          <td>{asset.tipo || "Sin tipo"}</td>
                          <td>{asset.modelo || "Sin modelo"}</td>
                          <td style={{ color: getTone(asset.estado).color, fontWeight: 900 }}>{asset.estado}</td>
                        </tr>
                      ))}
                      {!filteredAssets.length ? <tr><td colSpan={4}>Sin datos para mostrar.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                <div className="hint">Haz clic sobre un equipo para ver su detalle.</div>
              </>
            ) : (
              <div className="assetDetail">
                <div className="detailTop">
                  <button className="backButton" onClick={() => setSelectedAsset(null)}>← Volver al listado</button>
                  <div className="localBadge" style={{ color: getTone(selectedAsset.estado).color, background: getTone(selectedAsset.estado).bg, borderColor: getTone(selectedAsset.estado).border }}>{selectedAsset.estado}</div>
                </div>
                <div className="panelTitle" style={{ textAlign: "left" }}>Detalle del equipo</div>
                <h2 className="assetTitle">{selectedAsset.tipo || "Equipo"}</h2>
                <div className="assetSubtitle">{selectedAsset.modelo || "Sin modelo registrado"}</div>
                <div className="detailGrid">
                  <div className="detailItem"><span>Local</span><b>{selectedAsset.local || "Sin local"}</b></div>
                  <div className="detailItem"><span>Tipo</span><b>{selectedAsset.tipo || "Sin tipo"}</b></div>
                  <div className="detailItem"><span>Modelo</span><b>{selectedAsset.modelo || "Sin modelo"}</b></div>
                  <div className="detailItem"><span>Estado</span><b style={{ color: getTone(selectedAsset.estado).color }}>{selectedAsset.estado || "Sin estado"}</b></div>
                  <div className="detailItem"><span>Sección</span><b>{selectedAsset.section || "Sin sección"}</b></div>
                  <div className="detailItem"><span>Ítem</span><b>{selectedAsset.item || "-"}</b></div>
                </div>
                <div className="detailBox">
                  <div className="panelTitle" style={{ textAlign: "left" }}>Detalle / observación</div>
                  <p>{selectedAsset.observacion || "Sin observaciones registradas."}</p>
                </div>
                <div className="detailBox">
                  <div className="panelTitle" style={{ textAlign: "left" }}>Pendiente</div>
                  <p>{selectedAsset.pendiente || "Sin pendientes registrados."}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
