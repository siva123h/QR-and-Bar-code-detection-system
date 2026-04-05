// Navigation logic
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active button
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show correct view
        const targetId = btn.getAttribute('data-target');
        views.forEach(v => {
            if(v.id === targetId) {
                v.classList.add('active');
            } else {
                v.classList.remove('active');
            }
        });

        // Load dashboard data if opening dashboard
        if (targetId === 'dashboard') {
            loadDashboardData();
        }
        
        // Pause background animation when on scanner page to avoid distraction
        document.body.classList.toggle('pause-bg', targetId === 'scanner');
    });
});

// Set initial bg state based on active tab
document.body.classList.toggle('pause-bg', document.getElementById('scanner').classList.contains('active'));

// Camera and Scanning State
const videoElement = document.getElementById('videoElement');
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');
const hiddenCanvas = document.getElementById('hiddenCanvas');
const toggleCameraBtn = document.getElementById('toggleCameraBtn');
const resultsList = document.getElementById('resultsList');
const imageUpload = document.getElementById('imageUpload');

let isStreaming = false;
let stream = null;
let scanInterval = null;
let lastDetectedData = new Set(); // Prevent spamming duplicate inputs

// Resize canvas match video element
function adjustCanvas() {
    overlayCanvas.width = videoElement.videoWidth;
    overlayCanvas.height = videoElement.videoHeight;
}

videoElement.addEventListener('loadedmetadata', adjustCanvas);
window.addEventListener('resize', () => {
    if(isStreaming) adjustCanvas();
});

// Toggle Camera
toggleCameraBtn.addEventListener('click', async () => {
    if (isStreaming) {
        stopCamera();
    } else {
        await startCamera();
    }
});

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 } } 
        });
        videoElement.srcObject = stream;
        isStreaming = true;
        toggleCameraBtn.textContent = 'Stop Camera';
        toggleCameraBtn.classList.replace('btn-primary', 'btn-danger'); // Add if you want red button
        
        document.getElementById('cameraStatus').textContent = 'Scanning...';
        
        // Start polling the frames
        scanInterval = setInterval(captureAndScan, 1000); // 1 frame per second to avoid backend overload
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please allow permissions.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    videoElement.srcObject = null;
    isStreaming = false;
    toggleCameraBtn.textContent = 'Start Camera';
    toggleCameraBtn.classList.remove('btn-danger');
    toggleCameraBtn.classList.add('btn-primary');
    
    document.getElementById('cameraStatus').textContent = 'Ready';
    
    clearInterval(scanInterval);
    clearOverlay();
}

function clearOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// Convert dataURL to Blob
function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

// Capture frame and send
async function captureAndScan() {
    if (!isStreaming || videoElement.videoWidth === 0) return;
    
    const ctx = hiddenCanvas.getContext('2d');
    hiddenCanvas.width = videoElement.videoWidth;
    hiddenCanvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
    
    // Use PNG instead of JPEG. JPEG compression causes ringing artifacts 
    // around the sharp edges of 1D barcodes, often causing pyzbar to fail!
    const dataUrl = hiddenCanvas.toDataURL('image/png');
    const blob = dataURLtoBlob(dataUrl);
    
    await scanImageBlob(blob, true);
}

// Handle Image Upload
imageUpload.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        
        // Ensure camera is stopped
        if (isStreaming) stopCamera();

        // Show image on video element? We can set canvas or just visually indicate
        const url = URL.createObjectURL(file);
        
        // Create an image object to draw to canvas to get data out easily
        const img = new Image();
        img.onload = async () => {
            hiddenCanvas.width = img.width;
            hiddenCanvas.height = img.height;
            const ctx = hiddenCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // Adjust overlay logic if wanted, but simpler to just show results
            // We can optionally draw the uploaded image to the overlay canvas for preview
            overlayCanvas.width = img.width;
            overlayCanvas.height = img.height;
            overlayCtx.drawImage(img, 0, 0, overlayCanvas.width, overlayCanvas.height);
            
            await scanImageBlob(file, false);
        };
        img.src = url;
    }
});

async function scanImageBlob(blob, drawsBoxes) {
    const formData = new FormData();
    formData.append("file", blob, "capture.jpg");

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.status === "success" && result.results) {
            if (drawsBoxes) clearOverlay();
            
            if (result.results.length === 0 && !drawsBoxes) {
                alert("No QR or Barcode detected in image.");
            } else if (result.results.length > 0) {
                // Flash success
                showSuccessFlash(result.results[0].type);
            }

            result.results.forEach(code => {
                if (drawsBoxes) {
                    drawBoundingBox(code.points, code.type);
                }
                
                // Add to recent if not seen in the last little while
                appendResult(code);
            });
        }
    } catch (err) {
        console.error("Scan error:", err);
    }
}

function showSuccessFlash(typeStr) {
    const status = document.getElementById('cameraStatus');
    const container = document.querySelector('.video-container');
    
    status.textContent = `Detected: ${typeStr}!`;
    status.classList.add('success');
    container.classList.add('flash');
    
    setTimeout(() => {
        if (isStreaming) {
            status.textContent = 'Scanning...';
        } else {
            status.textContent = 'Ready';
        }
        status.classList.remove('success');
        container.classList.remove('flash');
    }, 1500);
}

function drawBoundingBox(points, type) {
    if (!points || points.length < 4) return;
    
    overlayCtx.beginPath();
    overlayCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        overlayCtx.lineTo(points[i].x, points[i].y);
    }
    overlayCtx.closePath();
    
    overlayCtx.lineWidth = 4;
    overlayCtx.strokeStyle = type === 'QR' ? '#3b82f6' : '#f59e0b'; // Blue for QR, Amber for Barcode
    overlayCtx.stroke();
    
    // Fill slightly transparent
    overlayCtx.fillStyle = type === 'QR' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)';
    overlayCtx.fill();
}

function appendResult(code) {
    // Basic debouncing (prevent filling up with same frame over and over)
    const uniqueKey = code.type + code.data;
    if (lastDetectedData.has(uniqueKey)) return;
    
    lastDetectedData.add(uniqueKey);
    // Clear set after 5 seconds to allow rescanning same code if needed
    setTimeout(() => lastDetectedData.delete(uniqueKey), 5000);

    // Remove empty state if present
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    let linkHtml = '';
    if (code.data.startsWith('http://') || code.data.startsWith('https://')) {
        linkHtml = `<div style="margin-top: 10px;"><a href="${code.data}" target="_blank" class="btn btn-primary" style="padding: 6px 16px; font-size: 0.9em; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">Open Link <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></div>`;
    }

    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
        <div class="result-header">
            <span class="badge ${code.type.toLowerCase()}">${code.type}</span>
            <span class="badge new">Just Scanned</span>
        </div>
        <div class="result-data" style="word-break: break-all;">${code.data}</div>
        ${linkHtml}
    `;
    
    resultsList.prepend(div);
}

// --- DASHBOARD LOGIC ---
let distChartInstance = null;
let trendChartInstance = null;

document.getElementById('refreshDataBtn').addEventListener('click', loadDashboardData);
document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);

async function exportToCsv() {
    try {
        const res = await fetch('/api/scans');
        const scans = await res.json();
        
        if (scans.length === 0) {
            alert('No data to export.');
            return;
        }

        let csv = 'Timestamp,Type,Data\\n';
        scans.forEach(s => {
            const dateStr = new Date(s.timestamp + 'Z').toLocaleString().replace(/,/g, '');
            // Escape quotes by doubling them, wrap data in quotes to handle commas
            const safeData = s.data.replace(/"/g, '""');
            csv += `${dateStr},${s.type},"${safeData}"\\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scan_history.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Error exporting CSV", err);
        alert("Failed to export CSV.");
    }
}

async function loadDashboardData() {
    try {
        const [analyticsRes, scansRes] = await Promise.all([
            fetch('/api/analytics'),
            fetch('/api/scans')
        ]);
        
        const analytics = await analyticsRes.json();
        const scans = await scansRes.json();
        
        updateStats(analytics);
        updateCharts(analytics);
        updateHistoryTable(scans);
    } catch (err) {
        console.error("Error loading dashboard data", err);
    }
}

function updateStats(data) {
    document.getElementById('statTotal').textContent = data.total || 0;
}

function updateCharts(data) {
    // Prepare Distribution Chart Data
    const distLabels = Object.keys(data.distribution);
    const distData = Object.values(data.distribution);
    
    const distCtx = document.getElementById('distributionChart').getContext('2d');
    if (distChartInstance) distChartInstance.destroy();
    distChartInstance = new Chart(distCtx, {
        type: 'doughnut',
        data: {
            labels: distLabels,
            datasets: [{
                data: distData,
                backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Prepare Trend Chart Data
    // Reverse them to show oldest to newest left to right
    const trendKeys = Object.keys(data.daily_trend).reverse();
    const trendVals = trendKeys.map(k => data.daily_trend[k]);
    
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: trendKeys,
            datasets: [{
                label: 'Scans',
                data: trendVals,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateHistoryTable(scans) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    if (scans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No scan history available</td></tr>';
        return;
    }

    scans.forEach(scan => {
        const tr = document.createElement('tr');
        
        // Format timestamp
        const dateObj = new Date(scan.timestamp + 'Z'); // Convert UTC sqlite time to local
        const formattedDate = dateObj.toLocaleString();

        let displayData = scan.data;
        if (scan.data.startsWith('http://') || scan.data.startsWith('https://')) {
            displayData = `<a href="${scan.data}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${scan.data}</a>`;
        } else {
            displayData = `<span style="word-break: break-all;">${scan.data}</span>`;
        }

        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td><span class="badge ${scan.type.toLowerCase()}">${scan.type}</span></td>
            <td>${displayData}</td>
        `;
        tbody.appendChild(tr);
    });
}
