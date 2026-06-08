// @ts-nocheck
import React, { useMemo, useState, useEffect } from "react";

const API_URL = "/api/dashboard";
const PPTOS_API = `${API_URL}?action=pptos`;

const BUSINESS_GROUPS = [
  { id: "JUMBO", label: "Jumbo" },
  { id: "DARK_STORE", label: "Dark Store" },
  { id: "SPID", label: "SPID" },
];

const CATEGORIES = [
  { id: "TODOS", label: "Todos" },
  { id: "CENTRAL", label: "Central" },
  { id: "CONDENSADORES", label: "Condensadores" },
  { id: "ACTIVOS_COMERCIALES", label: "Activos comerciales" },
];

function cleanApiUrl(url) {
  return String(url || "").trim().split("?")[0].replace(/\/$/, "");
}

function makeUrl(base, params) {
  return `${cleanApiUrl(base)}?${new URLSearchParams(params).toString()}`;
}

function getTone(value) {
  const estado = String(value || "").toUpperCase().trim();

  if (estado === "ROJO" || estado === "FALLA CRITICA" || estado === "CRITICO") {
    return { color: "#ff4257", bg: "rgba(255,66,87,.14)", border: "rgba(255,66,87,.28)" };
  }

  if (estado === "AMARILLO" || estado === "OBSERVADO") {
    return { color: "#ffc928", bg: "rgba(255,201,40,.14)", border: "rgba(255,201,40,.28)" };
  }

  if (estado === "VERDE" || estado === "OPERATIVO") {
    return { color: "#20d071", bg: "rgba(32,208,113,.14)", border: "rgba(32,208,113,.28)" };
  }

  return { color: "#94a3b8", bg: "rgba(148,163,184,.14)", border: "rgba(148,163,184,.28)" };
}

function normalizeSummary(summary) {
  const total = Number(summary?.total || 0);
  const criticos = Number(summary?.criticos || 0);
  const observados = Number(summary?.observados || 0);
  const operativos = Number(summary?.operativos ?? Math.max(0, total - criticos - observados));
  const equiposSinDetalle = operativos;
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

function getBusinessGroup(item) {
  const code = String(item?.codigo || item?.cod || item?.COD_LOCAL || "").trim().toUpperCase();
  const grupo = String(item?.grupo || item?.GRUPO || "").trim().toUpperCase();
  const text = [item?.local, item?.localDashboard, item?.localOriginal, item?.name, item?.LOCAL]
    .join(" ")
    .toUpperCase();

  if (grupo === "DARK_STORE" || grupo === "DS") return "DARK_STORE";
  if (grupo === "JUMBO") return "JUMBO";
  if (grupo === "SPID") return "SPID";

  if (["J411", "J414"].includes(code) || text.includes("DARK STORE") || text.includes("DS ")) return "DARK_STORE";
  if (["J501", "J511", "J514", "J762", "J988", "J992"].includes(code) || text.includes("JUMBO")) return "JUMBO";
  if (text.includes("SPID")) return "SPID";
  return "OTROS";
}

function getAssetCategory(asset) {
  const area = String(asset.section || asset.AREA || "").toUpperCase().trim();

  if (area === "CENTRAL") return "CENTRAL";
  if (area === "CONDENSADORES") return "CONDENSADORES";
  if (area === "ACTIVOS_COMERCIALES") return "ACTIVOS_COMERCIALES";

  return "TODOS";
}

function normalizeEstadoFromApi(value) {
  const estado = String(value || "").toUpperCase().trim();

  if (estado === "CRITICO" || estado === "FALLA CRITICA") return "FALLA CRITICA";
  if (estado === "OBSERVADO") return "OBSERVADO";
  if (estado === "OPERATIVO") return "OPERATIVO";

  return "OPERATIVO";
}

function normalizeAssetFromApi(asset, localName = "") {
  const estado = normalizeEstadoFromApi(asset.estado || asset.STATUS);

  return {
    ...asset,
    id: asset.ID_ACTIVO || asset.id || "",
    codLocal: asset.COD_LOCAL || asset.codLocal || "",
    local: localName || asset.local || asset.LOCAL || "",
    grupo: asset.GRUPO || asset.grupo || "",
    codigoCencosud: asset.CODIGO_CENCOSUD || "",
    section: asset.section || asset.AREA || "",
    central: asset.CENTRAL || asset.central || "",
    item: asset.item || asset.DESCRIPCION || "",
    tipoActivo: asset.TIPO_ACTIVO || asset.claseActivo || "",
    tipo: asset.tipo || asset.TIPO_ACTIVO || asset.TIPO || "",
    caracteristica: asset.TIPO || "",
    marca: asset.MARCA || "",
    modelo: asset.modelo || asset.MODELO || "",
    serie: asset.SERIE || "",
    observacion: asset.observacion || asset.OBSERVACIONES || "",
    pendiente: asset.pendiente || asset.PENDIENTES || "",
    estado,
    claseActivo: asset.claseActivo || asset.TIPO_ACTIVO || "",
    marcaComp: asset.MARCA_COMP || "",
    modeloComp: asset.MODELO_COMP || "",
    foto1: asset.FOTO_1 || "",
    foto2: asset.FOTO_2 || "",
    foto3: asset.FOTO_3 || "",
    tecnico: asset.TECNICO || "",
    fechaActualizacion: asset.FECHA_ACTUALIZACION || "",
  };
}

function normalizeLocalFromApi(local) {
  return {
    raw: local,
    codigo: local.COD_LOCAL || local.codigo || local.cod || "",
    cod: local.COD_LOCAL || local.codigo || local.cod || "",
    local: local.LOCAL || local.local || local.name || "Sin local",
    grupo: local.GRUPO || local.grupo || getBusinessGroup(local),
    activo: local.ACTIVO || local.activo || "SI",
    assets: [],
    summary: normalizeSummary({ total: 0, operativos: 0, observados: 0, criticos: 0 }),
  };
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


function AssetPhotos({ asset, onExpandPhoto }) {
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState("");

  function getPhotoPaths(currentAsset) {
    return [
      currentAsset?.foto1 || currentAsset?.FOTO_1,
      currentAsset?.foto2 || currentAsset?.FOTO_2,
      currentAsset?.foto3 || currentAsset?.FOTO_3,
    ]
      .map((path) => String(path || "").trim())
      .filter(Boolean);
  }

  useEffect(() => {
    const paths = getPhotoPaths(asset);

    if (!paths.length) {
      setPhotos([]);
      setPhotoError("");
      return;
    }

    let active = true;

    async function loadPhotos() {
      try {
        setLoadingPhotos(true);
        setPhotoError("");

        const loaded = await Promise.all(
          paths.map(async (path, index) => {
            try {
              const response = await fetch(`${API_URL}?action=photo&path=${encodeURIComponent(path)}`);
              const data = await response.json();

              if (!data.ok) {
                return {
                  ok: false,
                  index,
                  path,
                  error: data.error || "No se pudo cargar la foto",
                };
              }

              return {
                ok: true,
                index,
                path,
                dataUrl: data.dataUrl,
                fileName: data.fileName,
              };
            } catch (error) {
              return {
                ok: false,
                index,
                path,
                error: "No se pudo cargar la foto",
              };
            }
          })
        );

        if (active) setPhotos(loaded);
      } catch (error) {
        if (active) setPhotoError("No se pudieron cargar las fotos.");
      } finally {
        if (active) setLoadingPhotos(false);
      }
    }

    loadPhotos();

    return () => {
      active = false;
    };
  }, [asset]);

  const paths = getPhotoPaths(asset);
  if (!paths.length) return null;

  return (
    <div className="detailBox">
      <div className="panelTitle" style={{ textAlign: "left" }}>Fotografías</div>

      {loadingPhotos ? <p>Cargando fotos...</p> : null}
      {photoError ? <p style={{ color: "#ffb6bf" }}>{photoError}</p> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 220px))",
          gap: 14,
          marginTop: 14,
        }}
      >
        {photos.map((photo) =>
          photo.ok ? (
            <button
              key={photo.index}
              type="button"
              onClick={() => onExpandPhoto(photo)}
              style={{
                display: "block",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 18,
                overflow: "hidden",
                background: "rgba(0,0,0,.22)",
                padding: 0,
                cursor: "zoom-in",
                textAlign: "left",
              }}
            >
              <img
                src={photo.dataUrl}
                alt={`Foto ${photo.index + 1}`}
                style={{
                  width: "100%",
                  height: 160,
                  objectFit: "contain",
                  display: "block",
                  background: "rgba(0,0,0,.35)"
                }}
              />

              <div
                style={{
                  padding: 10,
                  color: "#9fb0c9",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                Foto {photo.index + 1} · Presiona para ampliar
              </div>
            </button>
          ) : (
            <div
              key={photo.index}
              style={{
                border: "1px solid rgba(255,66,87,.35)",
                borderRadius: 18,
                padding: 14,
                color: "#ffb6bf",
                background: "rgba(255,66,87,.08)",
              }}
            >
              No se pudo cargar Foto {photo.index + 1}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function DashboardSemaforo() {
  const [localsData, setLocalsData] = useState([]);
  const [selectedLocal, setSelectedLocal] = useState("TODOS");
  const [selectedGroup, setSelectedGroup] = useState("TODOS");
  const [activeView, setActiveView] = useState("RESUMEN");
  const [assetCategory, setAssetCategory] = useState("TODOS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("Cargando datos iniciales...");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [pptosData, setPptosData] = useState([]);
  const [allPptosData, setAllPptosData] = useState([]);
  const [pptosLoading, setPptosLoading] = useState(false);
  const [pptoView, setPptoView] = useState("");
  const [selectedPpto, setSelectedPpto] = useState(null);
  const [pptoYearFilter, setPptoYearFilter] = useState(String(new Date().getFullYear()));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

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
    setProgress("Cargando locales y activos...");

    try {
      const data = await fetchJson(makeUrl(url, { action: "all" }));
      if (!data.ok) throw new Error(data.error || data.message || "No se pudo obtener la información del dashboard.");

      const localesApi = Array.isArray(data.locales) ? data.locales : [];
      const activosApi = Array.isArray(data.activos) ? data.activos : [];

      const normalizedLocals = localesApi.map(normalizeLocalFromApi);
      const activosNormalizados = activosApi.map((asset) => normalizeAssetFromApi(asset));

      const results = normalizedLocals.map((local) => {
        const localAssets = activosNormalizados
          .filter((asset) => {
            const assetCode = String(asset.codLocal || asset.COD_LOCAL || "").trim().toUpperCase();
            const localCode = String(local.codigo || local.cod || "").trim().toUpperCase();
            return assetCode && localCode && assetCode === localCode;
          })
          .map((asset) => normalizeAssetFromApi(asset, local.local));

        return {
          ...local,
          assets: localAssets,
          summary: buildSummaryFromAssets(localAssets),
        };
      });

      setLocalsData(results);
      setProgress(`Locales cargados: ${results.length} | Activos cargados: ${activosNormalizados.length}`);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los locales y activos.");
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

  async function loadAllPptos() {
    try {
      const data = await fetchJson(PPTOS_API);
      if (data.ok) setAllPptosData(data.pptos || []);
    } catch (err) {
      console.error("Error cargando todos los PPTOS", err);
    }
  }

  useEffect(() => {
    loadAllLocals();
    loadAllPptos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLocal !== "TODOS") {
      loadPptos(selectedLocal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocal]);

  const isGroupPage = selectedGroup !== "TODOS" && selectedLocal === "TODOS";
  const isLocalPage = selectedLocal !== "TODOS";

  const selectedLocalData = useMemo(() => localsData.find((item) => item.local === selectedLocal) || null, [localsData, selectedLocal]);

  const groupLocals = useMemo(() => {
    if (selectedGroup === "TODOS") return localsData;
    return localsData.filter((item) => getBusinessGroup(item) === selectedGroup);
  }, [localsData, selectedGroup]);

  const visibleLocals = useMemo(() => {
    if (selectedLocal === "TODOS") return groupLocals;
    return selectedLocalData ? [selectedLocalData] : [];
  }, [groupLocals, selectedLocal, selectedLocalData]);

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

  const filteredAllPptosByGroup = useMemo(() => {
    if (selectedGroup === "TODOS") return allPptosData;
    return allPptosData.filter((p) => getBusinessGroup(p) === selectedGroup);
  }, [allPptosData, selectedGroup]);

  function countPptosByEstado(list, type) {
    return list.filter((p) => {
      const estado = String(p.estado || "").toUpperCase().trim();
      if (type === "ENVIADOS") return estado === "ENVIADO";
      if (type === "APROBADOS") return estado === "PENDIENTE" || estado === "EN EJECUCION" || estado === "EN EJECUCIÓN";
      if (type === "EJECUTADOS") return estado === "EJECUTADO";
      return false;
    }).length;
  }

  const groupPptosSummary = useMemo(() => {
    return BUSINESS_GROUPS.map((group) => {
      const list = allPptosData.filter((p) => getBusinessGroup(p) === group.id);
      return {
        ...group,
        total: list.length,
        enviados: countPptosByEstado(list, "ENVIADOS"),
        aprobados: countPptosByEstado(list, "APROBADOS"),
        ejecutados: countPptosByEstado(list, "EJECUTADOS"),
      };
    });
  }, [allPptosData]);

  const basePptosScope = useMemo(() => {
    if (selectedLocal !== "TODOS") return pptosData;
    return filteredAllPptosByGroup;
  }, [selectedLocal, pptosData, filteredAllPptosByGroup]);

  const pptoYears = useMemo(() => {
    const years = new Set();
    basePptosScope.forEach((p) => {
      const year = getYearFromDate(p.fechaPpto) || getYearFromDate(p.fechaOc) || getYearFromDate(p.fechaEjecucion);
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [basePptosScope]);

  const pptosFiltradosPorFecha = useMemo(() => {
    if (!pptoYearFilter || pptoYearFilter === "TODOS") return basePptosScope;
    return basePptosScope.filter((p) => {
      const year = getYearFromDate(p.fechaPpto) || getYearFromDate(p.fechaOc) || getYearFromDate(p.fechaEjecucion);
      return year === pptoYearFilter;
    });
  }, [basePptosScope, pptoYearFilter]);

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

  const semaforoGeneral = summary.criticos > 0 ? "ROJO" : summary.observados > 0 ? "AMARILLO" : "VERDE";
  const semTone = getTone(semaforoGeneral);

  function openGroup(groupId) {
    setSelectedGroup(groupId);
    setSelectedLocal("TODOS");
    setActiveView("RESUMEN");
    setAssetCategory("TODOS");
    setSearch("");
    setSelectedAsset(null);
    setSelectedPpto(null);
    setPptoView("");
  }

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

  // SI ESTÁ DENTRO DE UN LOCAL
  if (selectedLocal !== "TODOS") {
    setSelectedLocal("TODOS");
    setSelectedPpto(null);
    setPptoView("");
    setSelectedAsset(null);
    return;
  }

  // SI ESTÁ DENTRO DE UN GRUPO
  if (selectedGroup !== "TODOS") {
    setSelectedGroup("TODOS");
    setSelectedPpto(null);
    setPptoView("");
    setSelectedAsset(null);
    return;
  }

}
  function handleLogin() {

    if (
      username === "admin" &&
      password === "1234"
    ) {
      setIsAuthenticated(true);
      setLoginError("");
      return;
    }

    setLoginError("Usuario o contraseña incorrecta");
  }
  if (!isAuthenticated) {

    return (

      <div className="loginScreen">

        <style>{`

          body{
            margin:0;
            background:#05070d;
            font-family:Arial, Helvetica, sans-serif;
          }

          .loginScreen{
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#05070d;
            padding:24px;
          }

          .loginCard{
            width:100%;
            max-width:420px;
            background:#0b1020;
            border:1px solid rgba(255,255,255,.08);
            border-radius:28px;
            padding:42px;
            box-shadow:0 20px 60px rgba(0,0,0,.45);
          }

          .loginLogo{
            width:100%;
            max-width:260px;
            object-fit:contain;
            display:block;
            margin:0 auto 24px auto;
          }

          .loginTitle{
            color:white;
            font-size:32px;
            font-weight:900;
            text-align:center;
            margin-bottom:10px;
          }

          .loginSub{
            color:#9fb0c9;
            text-align:center;
            margin-bottom:28px;
          }

          .loginInput{
            width:100%;
            background:#111827;
            border:1px solid rgba(255,255,255,.1);
            border-radius:16px;
            padding:14px;
            color:white;
            margin-bottom:14px;
            font-size:15px;
            box-sizing:border-box;
          }

          .loginButton{
            width:100%;
            background:#27dfff;
            color:#001019;
            border:none;
            border-radius:16px;
            padding:14px;
            font-size:16px;
            font-weight:800;
            cursor:pointer;
            margin-top:10px;
          }

          .loginError{
            color:#ff5a7a;
            text-align:center;
            margin-top:14px;
          }

        `}</style>

        <div className="loginCard">

          <img
            src="/logo-sustenta-white.png"
            alt="Sustenta"
            className="loginLogo"
          />

          <div className="loginTitle">
            Acceso Dashboard
          </div>

          <div className="loginSub">
            Ingresa tus credenciales
          </div>

          <input
            className="loginInput"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            className="loginInput"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="loginButton"
            onClick={handleLogin}
          >
            Ingresar
          </button>

          {loginError ? (
            <div className="loginError">
              {loginError}
            </div>
          ) : null}

        </div>

      </div>

    );

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
        .mainLogo{
          height:130px;
          width:auto;
          object-fit:contain;
          display:block;
        }

        .brand{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          gap:10px;
        }
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
        .groupCard { flex-direction: column; align-items: flex-start; justify-content: center; min-height: 110px; }
        .groupCard span { font-size: 24px; font-weight: 950; }
        .groupCard small { color: #9fb0c9; font-size: 13px; margin-top: 8px; line-height: 1.4; }
        .groupCardActive { border-color: rgba(39,223,255,.75) !important; background: rgba(39,223,255,.12) !important; box-shadow: 0 0 0 1px rgba(39,223,255,.28), 0 18px 40px rgba(0,0,0,.22); }
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
        .localSelectTop { display: flex; align-items: center; gap: 10px; min-width: 320px; color: #9fb0c9; font-size: 13px; justify-content: flex-end; }
        .localSelectTop select { width: 230px; background: #111827; border: 1px solid rgba(255,255,255,.12); color: white; border-radius: 14px; padding: 12px; outline: none; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,.07); text-align: left; vertical-align: top; }
        th { color: #dbeafe; background: #101827; position: sticky; top: 0; z-index: 2; font-weight: 900; }
        @media (max-width: 1000px) { 
          .cards { 
            grid-template-columns: repeat(2, 1fr); 
          } 

          .mainGrid { 
            grid-template-columns: 1fr; 
          } 

          .header, 
          .dashboardTitle { 
            flex-direction: column; 
            align-items: stretch; 
          } 

          h1 { 
            font-size: 32px; 
          }

          .detailGrid {
            grid-template-columns: 1fr;
          }

          .assetTitle {
            font-size: 28px;
          }

          .assetSubtitle {
            font-size: 14px;
          }

          .page {
            padding: 14px;
          }

          .panel {
            padding: 16px;
            border-radius: 20px;
          }

          .detailItem {
            padding: 12px;
          }

          .detailItem b {
            font-size: 14px;
            word-break: break-word;
          }

          .detailTop {
            flex-direction: column;
            align-items: flex-start;
          }

          .tableHeader {
            flex-direction: column;
            align-items: stretch;
          }

          .cards {
            gap: 10px;
          }

          .card {
            padding: 14px;
            min-height: 100px;
            border-radius: 20px;
          }

          .cardValue {
            font-size: 28px;
          }

          .cardTitle {
            font-size: 10px;
            letter-spacing: .14em;
          }
        }

        @media (max-width: 520px) {
          .cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .detailGrid {
            grid-template-columns: 1fr;
          }

          .localTabs {
            grid-template-columns: 1fr;
          }

          .categoryTabs {
            gap: 8px;
          }

          .categoryButton {
            padding: 10px 12px;
            font-size: 12px;
          }

          .assetTitle {
            font-size: 24px;
          }

          .bigPercent {
            font-size: 42px;
          }

          .detailBox {
            padding: 14px;
          }

          .mainLogo {
            height: 70px;
          }
        }
      `}</style>
      <div className="page">
        <header className="header">
          <div className="brand">

            <img
              src="/logo-sustenta-white.png"
              alt="Sustenta"
              className="mainLogo"
            />
          </div>
          <div className="actions">
            {progress ? <div className="progress small">{progress}</div> : null}
            {(isLocalPage || isGroupPage) ? (
              <div style={{ display: "flex", gap: 12 }}>

                <button className="backButton" onClick={goBack}>
                  ← Volver
                </button>

                <button
                  className="backButton"
                  onClick={() => {
                    setSelectedGroup("TODOS");
                    setSelectedLocal("TODOS");
                    setSelectedPpto(null);
                    setPptoView("");
                    setSelectedAsset(null);
                    setActiveView("RESUMEN");
                  }}
                >
                  ⌂ Inicio
                </button>

              </div>
            ) : null}
            <button onClick={loadAllLocals} disabled={loading}>{loading ? "Actualizando..." : "Actualizar datos"}</button>
          </div>
        </header>

        <section className="dashboardTitle">
          <div>
            <h1>
              {selectedLocal !== "TODOS"
                ? selectedLocal
                : selectedGroup !== "TODOS"
                  ? `Resumen ${BUSINESS_GROUPS.find((g) => g.id === selectedGroup)?.label || selectedGroup}`
                  : "Resumen general"}
            </h1>
            <div className="subtitle">
              {selectedLocal !== "TODOS"
                ? "Vista individual del local seleccionado."
                : selectedGroup !== "TODOS"
                  ? "Vista filtrada por grupo. Selecciona un local desde el menú."
                  : "Resumen general de activos y presupuestos."}
            </div>
          </div>

          {selectedGroup !== "TODOS" && selectedLocal === "TODOS" ? (
            <label className="localSelectTop">
              Local
              <select value="" onChange={(event) => event.target.value && openLocal(event.target.value)}>
                <option value="">Seleccionar local</option>
                {groupLocals.map((local) => <option key={local.local} value={local.local}>{local.local}</option>)}
              </select>
            </label>
          ) : null}
        </section>

        {error ? <div className="error">⚠ {error}</div> : null}

        {!isLocalPage ? (
          <>
            {selectedGroup === "TODOS" ? (
              <section className="localTabs">
                {BUSINESS_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className="localButton groupCard"
                    onClick={() => {
                      setSelectedGroup(group.id);
                      setSelectedLocal("TODOS");
                      setActiveView("RESUMEN");
                      setAssetCategory("TODOS");
                      setSearch("");
                      setSelectedAsset(null);
                      setSelectedPpto(null);
                      setPptoView("");
                    }}
                  >
                    <span>{group.label}</span>
                    <small>Entrar al resumen de {group.label}</small>
                  </button>
                ))}
              </section>) : null}
          </>
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

            <section className="panel tablePanel">
              <div className="filterRow">
                <div>
                  <div className="panelTitle" style={{ textAlign: "left" }}>
                    {selectedLocal !== "TODOS" ? "Gestión de presupuestos del local" : selectedGroup !== "TODOS" ? `Gestión de presupuestos ${BUSINESS_GROUPS.find((g) => g.id === selectedGroup)?.label}` : "Resumen general de presupuestos y OC"}
                  </div>
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
                          {!isLocalPage ? <th>Local</th> : null}
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
                            {!isLocalPage ? (
                              <td>{ppto.codigo || ""} - {ppto.local || ppto.localDashboard || "-"}</td>
                            ) : null}
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
                        <th>Descripción</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map((asset, index) => (
                        <tr key={`${asset.local}-${asset.section}-${asset.item}-${index}`} onClick={() => setSelectedAsset(asset)} style={{ cursor: "pointer" }}>
                          <td><b>{asset.item || asset.descripcion || "Sin descripción"}</b></td>
                          <td style={{ color: getTone(asset.estado).color, fontWeight: 900 }}>{asset.estado || "Sin estado"}</td>
                        </tr>
                      ))}
                      {!filteredAssets.length ? <tr><td colSpan={2}>Sin datos para mostrar.</td></tr> : null}
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
                <div className="panelTitle" style={{ textAlign: "left" }}>Detalle del activo</div>
                <h2 className="assetTitle">{selectedAsset.item || "Activo sin descripción"}</h2>
                <div className="assetSubtitle">
                  {selectedAsset.tipoActivo || selectedAsset.tipo || "Sin tipo de activo"}
                  {selectedAsset.central ? ` · Central ${selectedAsset.central}` : ""}
                </div>
                <div className="detailGrid">
                  <div className="detailItem"><span>Local</span><b>{selectedAsset.local || "Sin local"}</b></div>
                  <div className="detailItem"><span>Código local</span><b>{selectedAsset.codLocal || selectedAsset.COD_LOCAL || "N/A"}</b></div>
                  <div className="detailItem"><span>Código Cencosud</span><b>{selectedAsset.codigoCencosud || selectedAsset.CODIGO_CENCOSUD || "N/A"}</b></div>
                  <div className="detailItem"><span>Sección</span><b>{selectedAsset.section || "Sin sección"}</b></div>
                  <div className="detailItem"><span>Central</span><b>{selectedAsset.central || "N/A"}</b></div>
                  <div className="detailItem"><span>Tipo activo</span><b>{selectedAsset.tipoActivo || selectedAsset.tipo || "N/A"}</b></div>
                  <div className="detailItem"><span>Tipo / característica</span><b>{selectedAsset.caracteristica || selectedAsset.TIPO || "N/A"}</b></div>
                  <div className="detailItem"><span>Marca</span><b>{selectedAsset.marca || selectedAsset.MARCA || "N/A"}</b></div>
                  <div className="detailItem"><span>Modelo</span><b>{selectedAsset.modelo || "N/A"}</b></div>
                  <div className="detailItem"><span>Serie</span><b>{selectedAsset.serie || selectedAsset.SERIE || "N/A"}</b></div>
                  <div className="detailItem"><span>Marca compresor</span><b>{selectedAsset.marcaComp || selectedAsset.MARCA_COMP || "N/A"}</b></div>
                  <div className="detailItem"><span>Modelo compresor</span><b>{selectedAsset.modeloComp || selectedAsset.MODELO_COMP || "N/A"}</b></div>
                  <div className="detailItem"><span>Estado</span><b style={{ color: getTone(selectedAsset.estado).color }}>{selectedAsset.estado || "Sin estado"}</b></div>
                  <div className="detailItem"><span>Técnico</span><b>{selectedAsset.tecnico || selectedAsset.TECNICO || "N/A"}</b></div>
                  <div className="detailItem"><span>Fecha actualización</span><b>{selectedAsset.fechaActualizacion || selectedAsset.FECHA_ACTUALIZACION || "N/A"}</b></div>
                </div>
                <div className="detailBox">
                  <div className="panelTitle" style={{ textAlign: "left" }}>Detalle / observación</div>
                  <p>{selectedAsset.observacion || "Sin observaciones registradas."}</p>
                </div>
                <div className="detailBox">
                  <div className="panelTitle" style={{ textAlign: "left" }}>Estado de revisión</div>
                  <p>{selectedAsset.pendiente || "Sin pendientes registrados."}</p>
                </div>

                <AssetPhotos asset={selectedAsset} onExpandPhoto={setExpandedPhoto} />
              </div>
            )}
          </section>
        )}
      </div>
      
      {expandedPhoto ? (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.86)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 980,
              maxHeight: "90vh",
              background: "#05070d",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 24,
              padding: 16,
              boxShadow: "0 24px 80px rgba(0,0,0,.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ color: "#9fb0c9", fontWeight: 800 }}>
                Foto {expandedPhoto.index + 1}
              </div>

              <button
                type="button"
                onClick={() => setExpandedPhoto(null)}
                style={{
                  background: "rgba(255,255,255,.08)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,.14)",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>

            <img
              src={expandedPhoto.dataUrl}
              alt={`Foto ${expandedPhoto.index + 1}`}
              style={{
                width: "100%",
                maxHeight: "78vh",
                objectFit: "contain",
                display: "block",
                background: "rgba(0,0,0,.35)",
                borderRadius: 16,
              }}
            />
          </div>
        </div>
      ) : null}
      
    </div>
  );
}
