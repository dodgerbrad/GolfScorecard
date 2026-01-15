// ================================================================
// score.js - 2026 Finalized Golf Scorecard Logic
// ================================================================


// --- GLOBAL STATE & CONFIGURATION ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYxffwZXmYDakQgGjFU0xAVtXegWKz_Ym6ApqsP_xIsDZdQD0ihxIXUbUiv0XtW-yZ3w/exec";


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
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('✅ Service Worker Registered', reg))
        .catch(err => console.error('❌ SW Registration Failed', err));
    });
  }




// --- CORE FUNCTIONS (Global Scope) ---


// Function to send data to Google Sheets (RESTORED)
// Function to send a batch of 4 scores to the SAME row in Google Sheets
async function syncBatch(golfer, scores) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            // We use the key 'scores' to match the Apps Script logic
            body: JSON.stringify({ golfer: golfer, scores: scores })
        });
        console.log(`✅ Synced batch of ${scores.length} holes for ${golfer}`);
    } catch (error) {
        console.error("❌ Batch sync failed:", error);
    }
}


async function populateGolferSelect() {
    const selectElement = document.getElementById('golfer');
    const loadingOverlay = document.getElementById('loadingOverlay'); // Get the loader

    if (!selectElement) return;

    // 1. Show the loader
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

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
    } finally {
        // 2. Hide the loader after data is loaded (or error occurs)
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
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
        const holeNum = parseInt(holeNumAttr.replace('h', ''), 10);
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
            golferSelect.disabled = true; 
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
            // 1. Show the loader manually before the refresh starts
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            // 2. Run your sync logic
            recalculateAndSyncAllScores();

            alert('✅ Round complete and scores submitted!');

            // 3. Perform the reload
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

        // ADD THIS: If we are "Fixing", just update totals and exit
        if (document.getElementById('doneFixingBtn').style.display === 'block') {
            calculateGolfTotals();
            return;
        }



        if (input === dynamicInputs[currentHoleIndex]) {
            const val = parseInt(input.value, 10) || 0;
            const holeNumAttr = input.getAttribute('hole-data') || "";
            const holeNum = parseInt(holeNumAttr.replace('h', ''), 10);


            pendingScores.push({ hole: holeNum, score: val });

            holesCompleted++;
            updateTotalsDisplay();


            if (pendingScores.length === 4 || holesCompleted === TOTAL_HOLES_IN_ROUND || holesCompleted === TOTAL_HOLES_IN_ROUND / 2) {
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

// Function to calculate totals
function calculateGolfTotals() {
    let frontTotal = 0;
    let backTotal = 0;

    for (let i = 1; i <= 9; i++) {
        const val = parseInt(document.getElementById(i + 'h').value) || 0;
        frontTotal += val;
    }
    for (let i = 10; i <= 18; i++) {
        const val = parseInt(document.getElementById(i + 'h').value) || 0;
        backTotal += val;
    }

    // Update the global variables so the rest of your app knows the new totals
    front = frontTotal;
    back = backTotal;

    // Trigger your existing display function to update all labels at once
    updateTotalsDisplay();
}


// Attach the listener to all inputs in your grid
function setupScoreListeners() {
    const inputs = document.querySelectorAll('#score-inputs input');
    inputs.forEach(input => {
        input.addEventListener('input', calculateGolfTotals);
    });
}

// Run setup when page loads
window.addEventListener('DOMContentLoaded', setupScoreListeners);

function resetGameForFixes() {
    dynamicInputs.forEach(input => {
        if (input) {
            input.disabled = false;
            input.style.opacity = "1";

            // ADD THIS: Ensure the listener is attached to every box during fix mode
            input.removeEventListener('input', calculateGolfTotals); // prevent duplicates
            input.addEventListener('input', calculateGolfTotals);
        }
    });
    document.getElementById('doneFixingBtn').style.display = 'block';
    if (dynamicInputs.length > 0) dynamicInputs[currentHoleIndex].focus();
}