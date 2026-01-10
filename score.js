// ================================================================
// score.js - 2026 Finalized Golf Scorecard Logic
// ================================================================

// --- GLOBAL STATE & CONFIGURATION ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby7Z4r33Acv9g-8WJs0NL_fcWHG7StjFAwSRnIWl3qyPCucQKnLVPFGfat30T7NhQKaBQ/exec";

let dynamicInputs = [];
let currentHoleIndex = 0;
let selectedGolferName = '';
let pendingScores = [];
let front = 0;
let back = 0;
let holesCompleted = 0;
const TOTAL_HOLES_IN_ROUND = 18;


// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(error => console.error('SW Registration Failed:', error));
}


// --- CORE FUNCTIONS (Global Scope) ---

// Function to send data to Google Sheets (RESTORED)
async function syncBatch(golfer, scores) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ golfer: golfer, scores: scores })
        });
        console.log(`Synced batch of ${scores.length} holes for ${golfer}`);
    } catch (error) {
        console.error("Batch sync failed:", error);
    }
}

async function populateGolferSelect() {
    const selectElement = document.getElementById('golfer');
    if (!selectElement) return;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const golfers = await response.json();

        if (Array.isArray(golfers)) {
            selectElement.innerHTML = '<option value="none">Select Golfer</option>';
            golfers.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                selectElement.appendChild(option);
            });
            console.log("✅ Golfers loaded successfully.");
        }
    } catch (error) {
        console.error("❌ Failed to fetch golfer list:", error);
        selectElement.innerHTML = '<option value="none">Error: Check Connection</option>';
    }
}

function updateTotalsDisplay() {
    document.getElementById('frontTotalDisplay').textContent = front;
    document.getElementById('backTotalDisplay').textContent = back;
    document.getElementById('grandTotalDisplay').textContent = front + back;
    document.getElementById('finalFront').textContent = front;
    document.getElementById('finalBack').textContent = back;
    document.getElementById('finalTotal').textContent = front + back;
}

function resetGameForFixes() {
    dynamicInputs.forEach(input => {
        if (input) {
            input.disabled = false;
            input.style.opacity = "1";
        }
    });
    document.getElementById('doneFixingBtn').style.display = 'block'; 
    if (dynamicInputs.length > 0) dynamicInputs[currentHoleIndex].focus();
}

function recalculateAndSyncAllScores() {
    front = 0; back = 0;
    let allScores = [];
    dynamicInputs.forEach(input => {
        const val = parseInt(input.value, 10) || 0;
        const holeNumAttr = input.getAttribute('hole-data') || "";
        const holeNum = parseInt(holeNumAttr.replace('h',''), 10);
        if (holeNum <= 9) front += val; else back += val;
        input.disabled = true;
        allScores.push({ hole: holeNum, score: val });
    });
    syncBatch(selectedGolferName, allScores);
    updateTotalsDisplay();
    document.getElementById('doneFixingBtn').style.display = 'none';
}


// --- DOM CONTENT LOADED EVENT ---
document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const startHoleDialog = document.getElementById('startHoleDialog');
    const startHoleInput = document.getElementById('startHoleInput');
    const confirmDialog = document.getElementById('confirmDialog');
    const finalScoreDialog = document.getElementById('finalScoreDialog');
    const golferSelect = document.getElementById('golfer');
    const scorecardContainer = document.getElementById('score-inputs');
    const doneFixingBtn = document.getElementById('doneFixingBtn');

    populateGolferSelect();

    // --- Event Handlers ---

    golferSelect.addEventListener('change', (e) => {
        selectedGolferName = e.target.value;
        if (selectedGolferName !== 'none') {
            document.getElementById('namePlaceholder').textContent = selectedGolferName;
            confirmDialog.showModal();
        }
    });

    confirmDialog.addEventListener('close', () => {
        if (confirmDialog.returnValue === 'yes') {
            startHoleDialog.showModal();
        } else {
            golferSelect.value = 'none';
        }
    });
   
       
    startHoleDialog.addEventListener('close', () => {
        let startHoleNum = parseInt(startHoleInput.value, 10);
        
        if (isNaN(startHoleNum) || startHoleNum < 1 || startHoleNum > 18) {
            alert("Please enter a valid starting hole number (1-18).");
            startHoleDialog.showModal(); 
            return;
        }

        // Circular Logic: Building Front and Back 9 Sequences
        const frontSequence = [];
        for (let i = 0; i < 9; i++) {
            let holeNum = ((startHoleNum - 1 + i) % 9) + 1;
            frontSequence.push(holeNum + 'h');
        }
        const backStart = startHoleNum + 9;
        const backSequence = [];
        for (let i = 0; i < 9; i++) {
            let holeNum = ((backStart - 10 + i) % 9) + 10;
            backSequence.push(holeNum + 'h');
        }
        
        const combinedSequence = [...frontSequence, ...backSequence];
        dynamicInputs = combinedSequence.map(id => document.getElementById(id)).filter(el => el !== null);

        // Reset state for new round
        currentHoleIndex = 0;
        holesCompleted = 0;
        front = 0; back = 0; pendingScores = [];
        updateTotalsDisplay();

        // Lock/Reset all inputs before starting
        document.querySelectorAll('#score-inputs input').forEach(inp => {
            inp.disabled = true;
            inp.style.opacity = "0.4";
            inp.value = '';
        });
        
        // --- FIX IS HERE: Use [0] to select the first element ---
        if (dynamicInputs.length > 0) {
            const firstHole = dynamicInputs[0]; // Select the specific input element
            firstHole.disabled = false;
            firstHole.style.opacity = "1";
            setTimeout(() => firstHole.focus(), 100);
        } else {
             console.error("Critical: dynamicInputs array is empty. Check HTML IDs (e.g., '1h').");
        }
    });

    finalScoreDialog.addEventListener('close', () => {
        if (finalScoreDialog.returnValue === 'fix') {
            resetGameForFixes();
        } else if (finalScoreDialog.returnValue === 'ok') {
            recalculateAndSyncAllScores();
            alert('✅ Round complete and scores submitted!');
            window.location.reload(); 
        }
    });

    doneFixingBtn.addEventListener('click', () => {
        recalculateAndSyncAllScores();
        finalScoreDialog.showModal();
    });

    // Main scorecard interaction logic
    scorecardContainer.addEventListener('input', (event) => {
        const input = event.target;
        if (input.disabled || input.value === '') return;

        if (input === dynamicInputs[currentHoleIndex]) {
            const val = parseInt(input.value, 10) || 0;
            const holeNumAttr = input.getAttribute('hole-data') || "";
            const holeNum = parseInt(holeNumAttr.replace('h',''), 10);

            pendingScores.push({ hole: holeNum, score: val });
            if (holeNum <= 9) front += val; else back += val;
            holesCompleted++;
            updateTotalsDisplay();

            if (pendingScores.length === 4 || holesCompleted === TOTAL_HOLES_IN_ROUND) {
                syncBatch(selectedGolferName, [...pendingScores]);
                pendingScores = [];
            }
            
            input.disabled = true; 
            input.style.opacity = "0.7";

            if (holesCompleted >= TOTAL_HOLES_IN_ROUND) {
                finalScoreDialog.showModal();
            } else {
                currentHoleIndex++; 
                if (dynamicInputs[currentHoleIndex]) {
                    const nextInput = dynamicInputs[currentHoleIndex];
                    nextInput.disabled = false;
                    nextInput.style.opacity = "1";
                    setTimeout(() => nextInput.focus(), 50);
                }
            }
        }
    });
});
