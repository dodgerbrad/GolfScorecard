const grid = document.getElementById('score-inputs');

        for (let i = 1; i <= 9; i++) {
            // Hole (Front 9)
            grid.innerHTML += `<span>Hole ${i}</span>
                       <input type="number" class="score-input" id="h${i}">`;
            // Hole (Back 9)
            grid.innerHTML += `<span>Hole ${i + 9+" ("+i+")"}</span>
                       <input type="number" class="score-input" id="h${i + 9}">`;
        }

        // Calculation Logic
        document.addEventListener('input', () => {
            const inputs = document.querySelectorAll('.score-input');
            let front = 0;
            let back = 0;

            inputs.forEach(input => {
                const val = parseInt(input.value) || 0;
                const hole = parseInt(input.getAttribute('data-hole'));

                if (hole <= 9) front += val;
                else back += val;
            });

            document.getElementById('front-total').innerText = front;
            document.getElementById('back-total').innerText = back;
            document.getElementById('grand-total').innerText = front + back;
        });


        const selectElement = document.getElementById("golfer");
        const confirmationDialog = document.getElementById("confirmDialog");
        const namePlaceholder = document.getElementById("namePlaceholder");

        let lastValue = selectElement.value; // Keep track of the previous valid choice

        selectElement.addEventListener("change", () => {
            // 1. Get the visible text of the newly selected option
            const selectedName = selectElement.options[selectElement.selectedIndex].text;

            // 2. Update the dialog text dynamically
            namePlaceholder.textContent = selectedName;

            // 3. Show the dialog
            confirmationDialog.showModal();

            // 4. Handle the user's decision
            confirmationDialog.addEventListener('close', () => {
                if (confirmationDialog.returnValue === "yes") {
                    console.log("Verified name:", selectedName);
                    lastValue = selectElement.value; // Update the tracking value
                    selectElement.disabled = true;
                } else {
                    console.log("User rejected name. Reverting...");
                    selectElement.value = lastValue; // Reset the select to the previous name
                }
            }, { once: true });
        });
