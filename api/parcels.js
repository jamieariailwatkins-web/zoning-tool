const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://gis.gastoncountync.gov/'
      }
    }, (response) => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('Invalid JSON from GIS server')); }
      });
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { mode, x, y, pid, address } = req.query;

  // Mode: spatial zoning query by x/y centroid
  if (mode === 'zoning' && x && y) {
    const params = new URLSearchParams({
      geometry: `${x},${y}`,
      geometryType: 'esriGeometryPoint',
      inSR: '102719',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'TYPE,NAME,ETJ,JURISDICTION',
      returnGeometry: 'false',
      f: 'json'
    });
    try {
      const data = await httpsGet(
        `https://gis.gastoncountync.gov/publicgis/rest/services/PublicGIS/Zoning/MapServer/7/query?${params}`
      );
      return res.status(200).json(data);
    } catch(e) {
      return res.status(502).json({ error: e.message });
    }
  }

  // Mode: parcel lookup by PID to get centroid geometry
  if (mode === 'pid' && pid) {
    const safe = pid.replace(/'/g, "''");
    const params = new URLSearchParams({
      where: `PID = '${safe}' OR AKPAR = '${safe}'`,
      outFields: 'AKPAR,WHOLE_ADDRESS,POSTAL,STATE,ZIP,CURR_NAME1,PID',
      returnGeometry: 'true',
      outSR: '102719',
      f: 'json',
      resultRecordCount: '1'
    });
    try {
      const data = await httpsGet(
        `https://gis.gastoncountync.gov/publicgis/rest/services/PublicGIS/Parcels/MapServer/11/query?${params}`
      );
      return res.status(200).json(data);
    } catch(e) {
      return res.status(502).json({ error: e.message });
    }
  }

  // Default mode: address search
  if (address) {
    const safe = address.toUpperCase().replace(/'/g, "''");
    const params = new URLSearchParams({
      where: `WHOLE_ADDRESS LIKE '%${safe}%'`,
      outFields: 'AKPAR,WHOLE_ADDRESS,POSTAL,STATE,ZIP,CURR_NAME1,PID',
      returnGeometry: 'true',
      outSR: '102719',
      f: 'json',
      resultRecordCount: '10'
    });
    try {
      const data = await httpsGet(
        `https://gis.gastoncountync.gov/publicgis/rest/services/PublicGIS/Parcels/MapServer/11/query?${params}`
      );
      return res.status(200).json(data);
    } catch(e) {
      return res.status(502).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Missing required parameters' });
}
