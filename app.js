/**
 * CHARGESCOUT - Version Finale Propre (Optimisée pour GitHub Pages)
 */

const CONFIG = {
    MODES: {
        RETAIL: '47.11D,47.11F,55.10Z,56.10A',
        FLOTTE: '52.29A,49.41A,53.20Z'
    },
    MAX_RESULTS: 25,
    MAX_RADIUS_KM: 30 
};

let currentResults = []; 
let map, markerGroup;

const ui = {
    scanBtn: document.getElementById('scanBtn'), exportBtn: document.getElementById('exportBtn'),
    modeSelect: document.getElementById('modeSelect'), statusText: document.getElementById('statusText'),
    progressFill: document.getElementById('progressFill'), resultsList: document.getElementById('resultsList'),
    resultCount: document.getElementById('resultCount'), radiusBadge: document.getElementById('radiusBadge'),
    searchInput: document.getElementById('searchInput'), filterZoneBlanche: document.getElementById('filterZoneBlanche'),
    filterConcurrence: document.getElementById('filterConcurrence'), sortSelect: document.getElementById('sortSelect'),
    irveRadiusSelect: document.getElementById('irveRadiusSelect')
};

function initMap() {
    map = L.map('map').setView([45.75, 4.85], 13); 
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '&copy; Google' }).addTo(map);
    markerGroup = L.layerGroup().addTo(map);
    map.on('moveend', checkRadius); map.on('zoomend', checkRadius);
    checkRadius();
}

function checkRadius() {
    const center = map.getCenter();
    const radiusKm = parseFloat((map.distance(center, map.getBounds().getNorthEast()) / 1000).toFixed(1));
    if (radiusKm > CONFIG.MAX_RADIUS_KM) {
        ui.radiusBadge.textContent = `Rayon : ${radiusKm} km`; ui.radiusBadge.className = 'badge badge-red';
        ui.scanBtn.disabled = true; ui.scanBtn.textContent = '❌ Zone trop vaste';
    } else {
        ui.radiusBadge.textContent = `Rayon : ${radiusKm} km`; ui.radiusBadge.className = 'badge badge-blue';
        ui.scanBtn.disabled = false; ui.scanBtn.textContent = '🔍 Scanner la zone';
    }
}

// --- INTELLIGENCE GÉOGRAPHIQUE (Directement sur OSM, idéal pour GitHub) ---
async function fetchGeoIntelligence(bounds) {
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const query = `[out:json][timeout:15];(node["amenity"~"cafe|restaurant|fast_food"](${bbox});way["highway"~"motorway|motorway_link|trunk"](${bbox});node["power"="substation"](${bbox});way["power"="substation"](${bbox}););out center;`;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return { cafes: [], roads: [], power: [] };
        
        const data = await response.json();
        const intel = { cafes: [], roads: [], power: [] };
        
        data.elements.forEach(el => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            if (!lat || !lon) return;

            if (el.tags?.amenity) intel.cafes.push({lat, lon});
            else if (el.tags?.highway) intel.roads.push({lat, lon});
            else if (el.tags?.power === 'substation') intel.power.push({lat, lon});
        });
        return intel;
    } catch (e) {
        console.warn("L'API GeoIntel a été bloquée (souvent à cause d'une exécution locale file:///). L'outil ignore cette étape.");
        return { cafes: [], roads: [], power: [] };
    }
}

function getNearestDistance(siteLat, siteLon, pointsArray) {
    if (!pointsArray || pointsArray.length === 0) return Infinity;
    let minDist = Infinity;
    pointsArray.forEach(p => {
        const dist = map.distance([siteLat, siteLon], [p.lat, p.lon]);
        if (dist < minDist) minDist = dist;
    });
    return minDist;
}

// --- APIS CLASSIQUES ---
async function fetchEntreprises(lat, lon, radiusKm, nafString) {
    const rad = Math.max(1, Math.min(Math.round(radiusKm), 50));
    const url = `https://recherche-entreprises.api.gouv.fr/near_point?lat=${lat}&long=${lon}&radius=${rad}&activite_principale=${encodeURIComponent(nafString)}&per_page=${CONFIG.MAX_RESULTS}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return (await response.json()).results || [];
    } catch (e) { return []; }
}

async function checkConcurrenceIRVE(lat, lon, searchRadiusMeters) {
    const numLat = parseFloat(lat); const numLon = parseFloat(lon);
    const deltaLat = searchRadiusMeters / 111000;
    const deltaLon = searchRadiusMeters / (111000 * Math.cos(numLat * Math.PI / 180));
    
    const url = `https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/bornes-irve/records?where=consolidated_latitude >= ${numLat - deltaLat} AND consolidated_latitude <= ${numLat + deltaLat} AND consolidated_longitude >= ${numLon - deltaLon} AND consolidated_longitude <= ${numLon + deltaLon}&limit=50`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) return { nbBornes: 0, details: [] };
        const data = await response.json();
        if (!data.results) return { nbBornes: 0, details: [] };

        let matches = [];
        data.results.forEach(r => {
            if (r.consolidated_latitude && r.consolidated_longitude) {
                if (map.distance([numLat, numLon], [r.consolidated_latitude, r.consolidated_longitude]) <= searchRadiusMeters) {
                    matches.push(r.nom_enseigne || r.nom_operateur || r.nom_amenageur || "Indépendant");
                }
            }
        });
        return { nbBornes: matches.length, details: [...new Set(matches)] };
    } catch (error) { return { nbBornes: 0, details: [] }; }
}

function updateProgress(curr, tot, msg) {
    ui.progressFill.style.width = tot === 0 ? '0%' : `${Math.round((curr / tot) * 100)}%`;
    ui.statusText.textContent = msg;
}

function createPinIcon(isZoneBlanche) {
    return L.divIcon({
        className: `custom-pin ${isZoneBlanche ? 'pin-green' : 'pin-red'}`,
        iconSize: [20, 20], iconAnchor: [10, 10]
    });
}

function createResultCard(res) {
    const li = document.createElement('li');
    li.className = 'result-card';
    const badgeHtml = res.isZoneBlanche ? `<span class="badge badge-green">🟢 Prospect Idéal</span>` : `<span class="badge badge-red">🔴 Pris (${res.nbBornes} PDC)</span>`;

    let intelHtml = "";
    if (res.intel) {
        let badges = [];
        if (res.intel.distCafe <= 300) badges.push(`<span class="badge badge-purple" title="À ${Math.round(res.intel.distCafe)}m">☕ Commodités OK</span>`);
        if (res.intel.distRoad <= 1500) badges.push(`<span class="badge badge-purple" title="À ${Math.round(res.intel.distRoad)}m">🛣️ Axe Routier (<1.5km)</span>`);
        if (res.intel.distPower <= 2000) badges.push(`<span class="badge badge-purple" title="À ${Math.round(res.intel.distPower)}m">⚡ Poste Source OK</span>`);
        
        if (badges.length > 0) intelHtml = `<div class="card-intel">${badges.join(' ')}</div>`;
    }

    li.innerHTML = `
        <div class="card-header"><h3>${res.nom}</h3>${badgeHtml}</div>
        <p class="card-address">${res.adresse}</p>
        <div class="card-meta"><span class="badge badge-gray">SIRET: ${res.siret}</span></div>
        ${intelHtml}
        ${!res.isZoneBlanche ? `<div class="card-reseaux"><strong>Concurrence :</strong> ${res.reseaux}</div>` : ""}
    `;

    li.addEventListener('click', () => { map.flyTo([res.lat, res.lon], 18, { duration: 0.5 }); res.marker.openPopup(); });
    return li;
}

function renderResults() {
    ui.resultsList.innerHTML = ''; markerGroup.clearLayers(); 
    const search = ui.searchInput.value.toLowerCase();
    const showBlanc = ui.filterZoneBlanche.checked;
    const showConc = ui.filterConcurrence.checked;

    let filtered = currentResults.filter(res => {
        const matchText = res.nom.toLowerCase().includes(search) || res.adresse.toLowerCase().includes(search);
        const matchStatus = (res.isZoneBlanche && showBlanc) || (!res.isZoneBlanche && showConc);
        return matchText && matchStatus;
    });

    if (ui.sortSelect.value === 'status') filtered.sort((a, b) => (a.isZoneBlanche === b.isZoneBlanche) ? 0 : a.isZoneBlanche ? -1 : 1);
    else if (ui.sortSelect.value === 'az') filtered.sort((a, b) => a.nom.localeCompare(b.nom));

    filtered.forEach(res => { ui.resultsList.appendChild(createResultCard(res)); markerGroup.addLayer(res.marker); });
    ui.resultCount.textContent = filtered.length;
    ui.exportBtn.textContent = `⬇️ Exporter CRM (${filtered.length})`;

    if (filtered.length === 0 && currentResults.length > 0) ui.resultsList.innerHTML = '<li class="empty-state"><p>Aucun résultat pour ces filtres.</p></li>';
}

async function runSpatialScan() {
    ui.scanBtn.disabled = true; currentResults = []; markerGroup.clearLayers(); ui.resultsList.innerHTML = ''; ui.exportBtn.style.display = 'none';

    const center = map.getCenter();
    const radiusKm = parseFloat((map.distance(center, map.getBounds().getNorthEast()) / 1000).toFixed(1));
    const modeActuel = ui.modeSelect.value;
    const irveRadius = parseInt(ui.irveRadiusSelect.value, 10);
    
    let geoIntel = null;
    if (modeActuel === 'RETAIL') {
        updateProgress(0, 100, `Analyse environnementale (Réseau & Trafic)...`);
        geoIntel = await fetchGeoIntelligence(map.getBounds());
    }

    updateProgress(0, 100, `Recherche du foncier...`);
    const entreprises = await fetchEntreprises(center.lat, center.lng, radiusKm, CONFIG.MODES[modeActuel]);
    
    let cibles = [];
    entreprises.forEach(ent => {
        if (ent.matching_etablissements) {
            ent.matching_etablissements.forEach(e => {
                if (e.latitude && e.longitude) {
                    cibles.push({ nom: ent.nom_complet, adresse: e.adresse, lat: e.latitude, lon: e.longitude, naf: e.activite_principale || ent.activite_principale, siret: e.siret || "Non renseigné" });
                }
            });
        }
    });

    if (cibles.length === 0) { updateProgress(0, 0, "Aucun site trouvé."); checkRadius(); return; }

    for (let i = 0; i < cibles.length; i++) {
        const site = cibles[i];
        updateProgress(i + 1, cibles.length, `Vérification IRVE (${irveRadius}m) : ${i + 1} / ${cibles.length}`);

        const irveData = await checkConcurrenceIRVE(site.lat, site.lon, irveRadius);
        const isBlanc = irveData.nbBornes === 0;
        
        const m = L.marker([site.lat, site.lon], { icon: createPinIcon(isBlanc) });
        m.bindPopup(`<strong style="font-size:1.1rem;">${site.nom}</strong><br><span class="badge ${isBlanc ? 'badge-green' : 'badge-red'}">${isBlanc ? 'Zone Blanche' : `Pris : ${irveData.nbBornes} PDC`}</span>`);

        let siteIntel = null;
        if (modeActuel === 'RETAIL' && geoIntel && geoIntel.cafes) {
            siteIntel = {
                distCafe: getNearestDistance(site.lat, site.lon, geoIntel.cafes),
                distRoad: getNearestDistance(site.lat, site.lon, geoIntel.roads),
                distPower: getNearestDistance(site.lat, site.lon, geoIntel.power)
            };
        }

        currentResults.push({
            ...site, isZoneBlanche: isBlanc, nbBornes: irveData.nbBornes,
            statut: isBlanc ? "🟢 Prospect Idéal" : `🔴 Pris (${irveData.nbBornes} PDC)`,
            reseaux: irveData.details.join(', ') || "-", marker: m, intel: siteIntel
        });
    }

    updateProgress(cibles.length, cibles.length, `Scan terminé.`);
    checkRadius(); ui.exportBtn.style.display = 'block'; renderResults(); 
}

function exportToCSV() {
    const visibleNames = Array.from(ui.resultsList.querySelectorAll('h3')).map(h => h.textContent);
    const toExport = currentResults.filter(r => visibleNames.includes(r.nom));
    if (toExport.length === 0) return;

    let csv = "Établissement;SIRET;Adresse;Statut IRVE;Réseaux Opérateurs;Café_Proche;Axe_Routier_Proche;Poste_Elec_Proche\n";
    toExport.forEach(r => {
        const clean = (s) => `"${String(s).replace(/"/g, '""').replace(/;/g, ',')}"`;
        const hasCafe = r.intel && r.intel.distCafe <= 300 ? "OUI" : "NON";
        const hasRoad = r.intel && r.intel.distRoad <= 1500 ? "OUI" : "NON";
        const hasPower = r.intel && r.intel.distPower <= 2000 ? "OUI" : "NON";
        
        csv += [clean(r.nom), clean(r.siret), clean(r.adresse), clean(r.statut), clean(r.reseaux), hasCafe, hasRoad, hasPower].join(";") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `ChargeScout_Leads.csv`; link.click();
}

window.onload = initMap;
ui.scanBtn.addEventListener('click', runSpatialScan); ui.exportBtn.addEventListener('click', exportToCSV);
['searchInput', 'filterZoneBlanche', 'filterConcurrence', 'sortSelect'].forEach(id => document.getElementById(id).addEventListener(id === 'searchInput' ? 'input' : 'change', renderResults));

// --- GESTION DE LA FENÊTRE MODALE (DOCUMENTATION) ---
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const closeHelpBtn = document.getElementById('closeHelpBtn');

// Ouvrir la modale
helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'block';
});

// Fermer la modale (croix)
closeHelpBtn.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

// Fermer la modale en cliquant en dehors
window.addEventListener('click', (event) => {
    if (event.target === helpModal) {
        helpModal.style.display = 'none';
    }
});