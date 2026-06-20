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

  const { where, resultRecordCount, mode, x, y } = req.query;

  // Mode: zoning spatial query using x/y coordinates
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

  // Default mode: parcel address search
  if (!where) return res.status(400).json({ error: 'Missing where parameter' });

  const params = new URLSearchParams({
    where,
    outFields: 'AKPAR,WHOLE_ADDRESS,POSTAL,STATE,ZIP,DIST_TWN,TAX_DISTRI,CURR_NAME1,DEEDAC,PID',
    returnGeometry: 'true',
    outSR: '102719',
    f: 'json',
    resultRecordCount: resultRecordCount || '10'
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
