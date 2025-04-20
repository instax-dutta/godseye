const API_BASE = '/api';
const websitesDiv = document.getElementById('websites');
const detailsDiv = document.getElementById('details');

// Only include real, working websites for initialWebsites (unique only)
const initialWebsites = Array.from(new Set([
  'https://12labs.xyz',
  'https://anonchat.space',
  'https://race3d.store',
  'https://racer.news',
  'https://sdad.pro',
  'https://webgpt.app',
  'https://wordai.app',
  'https://n8n.sdad.pro',
  'https://paste.sdad.pro',
  'https://send.sdad.pro',
  'https://excali.sdad.pro',
  'https://speedtest.sdad.pro',
  'https://dash.sdad.pro',
  'https://tools.sdad.pro',
  'https://swiss.sdad.pro',
  'https://peace.sdad.pro',
  'https://pdf.sdad.pro',
  'https://ytapi.sdad.pro',
  'https://atapi.sdad.pro',
]));

let lastSites = [];

async function ensureWebsites() {
  // Add all initialWebsites if not present
  const res = await fetch(`${API_BASE}/websites`);
  const sites = await res.json();
  const urls = new Set(sites.map(site => site.url));
  for (const url of initialWebsites) {
    if (!urls.has(url)) {
      await fetch(`${API_BASE}/websites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, checkInterval: 5 })
      });
    }
  }
}

function renderWebsites(sites) {
  // Filter out sites that are not reachable or have never had a successful check
  // Also filter duplicates by url
  const seen = new Set();
  const filtered = sites.filter(site => site.latest !== null && !seen.has(site.url) && seen.add(site.url));
  if (!filtered.length) {
    websitesDiv.innerHTML = '<p>No monitored websites with data yet.</p>';
    return;
  }
  let html = '<div class="scroll-x"><table class="monitor-table"><thead><tr><th>URL</th><th>Status</th><th>Resp. Time</th><th>Last Checked</th><th>Changed</th><th>History</th><th></th></tr></thead><tbody>';
  for (const site of filtered) {
    let latest = site.latest;
    html += `<tr class="${latest.isUp ? 'row-up' : 'row-down'}">
      <td><a href="${site.url}" target="_blank">${site.url}</a></td>
      <td>${latest.isUp ? '<span class=\"status-up\">Up</span>' : '<span class=\"status-down\">Down</span>'}</td>
      <td>${latest.responseTime + ' ms'}</td>
      <td>${new Date(latest.timestamp).toLocaleString()}</td>
      <td>${latest.contentChanged ? 'Yes' : 'No'}</td>
      <td><button class="history-btn" onclick="showDetails('${site._id}','${site.url}','${site.url}')">View</button></td>
      <td><button class="remove-btn" title="Remove" onclick="removeSite('${site._id}','${site.url}')">🗑️</button></td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  websitesDiv.innerHTML = html;
}

// Add site form handler
const addForm = document.getElementById('add-site-form');
if (addForm) {
  addForm.onsubmit = async (e) => {
    e.preventDefault();
    const urlInput = document.getElementById('add-site-url');
    const url = urlInput.value.trim();
    if (!url) return;
    addForm.querySelector('button').disabled = true;
    try {
      await fetch(`${API_BASE}/websites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, checkInterval: 5 })
      });
      urlInput.value = '';
      loadWebsites();
    } catch {
      alert('Failed to add website.');
    }
    addForm.querySelector('button').disabled = false;
  };
}

// Remove site handler
window.removeSite = async function(id, url) {
  if (!confirm(`Remove monitoring for ${url}?`)) return;
  try {
    await fetch(`${API_BASE}/websites/${id}` , { method: 'DELETE' });
    loadWebsites();
  } catch {
    alert('Failed to remove website.');
  }
};

async function loadWebsites() {
  // If we have previous data, show it while fetching new
  if (lastSites.length) {
    renderWebsites(lastSites);
  } else {
    websitesDiv.innerHTML = '<div class="loader"></div>';
  }
  try {
    const res = await fetch(`${API_BASE}/websites`);
    const sites = await res.json();
    // For each site, fetch its latest result (in parallel)
    const siteData = await Promise.all(sites.map(async site => {
      let latest = null;
      try {
        const r = await fetch(`${API_BASE}/results/${site._id}`);
        if (r.status === 404) {
          latest = null;
        } else {
          const results = await r.json();
          latest = results[0];
        }
      } catch {}
      return { ...site, latest };
    }));
    lastSites = siteData;
    renderWebsites(siteData);
  } catch {
    // Keep previous data on error
    if (!lastSites.length) {
      websitesDiv.innerHTML = '<p style=\"color:#dc2626\">Failed to load websites.</p>';
    }
  }
}

window.showDetails = async function(id, name, url) {
  detailsDiv.innerHTML = '<div class="loader"></div>';
  try {
    const res = await fetch(`${API_BASE}/results/${id}`);
    if (res.status === 404) {
      detailsDiv.innerHTML = `<div class='no-history'><h3>No monitoring history for ${url}</h3><button class='close-btn' onclick='closeDetails()'>✕</button></div>`;
      return;
    }
    const results = await res.json();
    let chartHtml = '<div class="chart-container"><canvas id="chart"></canvas></div>';
    let tableHtml = `<h3>History for ${url} <button class='close-btn' onclick='closeDetails()'>✕</button></h3><div class="scroll-x"><table class="history-table"><thead><tr><th>Checked At</th><th>Status</th><th>Resp. Time</th><th>Changed</th><th>Error</th></tr></thead><tbody>`;
    for (const r of results) {
      tableHtml += `<tr class="${r.isUp ? 'row-up' : 'row-down'}">
        <td>${new Date(r.timestamp).toLocaleString()}</td>
        <td>${r.isUp ? '<span class=\"status-up\">Up</span>' : '<span class=\"status-down\">Down</span>'}</td>
        <td>${r.responseTime} ms</td>
        <td>${r.contentChanged ? 'Yes' : 'No'}</td>
        <td>${r.error || '-'}</td>
      </tr>`;
    }
    tableHtml += '</tbody></table></div>';
    detailsDiv.innerHTML = chartHtml + tableHtml;
    // Chart
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: results.map(r => new Date(r.timestamp).toLocaleTimeString()),
        datasets: [
          {
            label: 'Response Time (ms)',
            data: results.map(r => r.responseTime),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.1)',
            tension: 0.2,
            fill: true,
          },
          {
            label: 'Status (Up=1, Down=0)',
            data: results.map(r => r.isUp ? 1 : 0),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.1)',
            tension: 0.2,
            fill: false,
            yAxisID: 'y1',
            stepped: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Historical Monitoring' },
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { title: { display: true, text: 'Response Time (ms)' }, beginAtZero: true },
          y1: {
            position: 'right',
            title: { display: true, text: 'Up/Down' },
            min: 0,
            max: 1,
            ticks: { stepSize: 1 },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  } catch {
    detailsDiv.innerHTML = '<p style="color:#dc2626">Failed to load history.</p>';
  }
};
window.closeDetails = function() {
  detailsDiv.innerHTML = '';
};

// Initial load
ensureWebsites().then(() => {
  loadWebsites();
  setInterval(loadWebsites, 15000); // auto-refresh every 15s
});
