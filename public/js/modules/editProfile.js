function toggleEdit() {
    let editButton = document.getElementById('editButton');
    if (!editButton) return; 

    let isEditing = editButton.textContent === 'Cancel';
    editButton.textContent = isEditing ? 'Edit' : 'Cancel';

    let inputs = ['firstName', 'male', 'female'];
    inputs.forEach(id => {
        let input = document.getElementById(id);
        if (input) {
            // When in non-edit mode (button text "Edit"), disable inputs
            input.disabled = isEditing;
            input.style.cursor = isEditing ? 'not-allowed' : 'text';
            input.style.color = isEditing ? 'rgb(135, 135, 135)' : 'black';
            input.style.backgroundColor = isEditing ? 'rgb(250, 250, 250)' : 'white';
            input.style.border = isEditing ? '1px solid rgb(224, 224, 224)' : '1px solid rgb(40, 116, 240)';
        }
    });

    let saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.style.display = isEditing ? 'none' : 'inline-block';
    }
}

function initEditFunctions() {
    document.addEventListener("DOMContentLoaded", () => {
        // --- NAME & GENDER Section ---
        let editButton = document.getElementById('editButton');
        if (editButton) {
            // Force initial state: non-edit mode
            editButton.textContent = "Edit";
            let inputs = ['firstName', 'male', 'female'];
            inputs.forEach(id => {
                let input = document.getElementById(id);
                if (input) {
                    input.disabled = true;
                    input.style.cursor = 'not-allowed';
                    input.style.color = 'rgb(135, 135, 135)';
                    input.style.backgroundColor = 'rgb(250, 250, 250)';
                    input.style.border = '1px solid rgb(224, 224, 224)';
                }
            });
            let saveButton = document.getElementById('saveButton');
            if (saveButton) {
                saveButton.style.display = 'none';
                saveButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    Swal.fire("Account details updated!");
                    if (editButton.textContent === "Cancel") {
                        toggleEdit();
                    }
                });
            }
            editButton.addEventListener('click', toggleEdit);
        }

        // --- EMAIL Section ---
        let emailInput = document.getElementById('emailInput');
        if (emailInput) {
            // Store original email value
            emailInput.dataset.original = emailInput.value;
        }
        let emailEditButton = document.getElementById('emailEdit');
        let emailSave = document.getElementById('emailSave');
        if (emailEditButton && emailSave) {
            emailEditButton.innerText = "Edit";
            // When clicking "Edit", enable email editing
            emailEditButton.addEventListener('click', function() {
                if (emailInput.disabled) {
                    emailInput.disabled = false;
                    emailInput.style.cursor = 'text';
                    emailInput.style.color = 'black';
                    emailInput.style.backgroundColor = 'white';
                    emailInput.style.border = '1px solid rgb(40, 116, 240)';
                    emailSave.style.display = 'inline-block';
                    this.innerText = 'Cancel';
                } else {
                    // Cancel action: simply disable and hide save button; remove any error
                    emailInput.disabled = true;
                    emailInput.style.cursor = 'not-allowed';
                    emailInput.style.color = 'rgb(135, 135, 135)';
                    emailInput.style.backgroundColor = 'rgb(250, 250, 250)';
                    emailInput.style.border = '1px solid rgb(224, 224, 224)';
                    emailSave.style.display = 'none';
                    this.innerText = 'Edit';
                    let errorMsg = document.getElementById('emailError');
                    if (errorMsg) errorMsg.remove();
                }
            });
            // When clicking "Save", check if the email is unchanged
            emailSave.addEventListener('click', function(event) {
                event.preventDefault();
                if (emailInput.value === emailInput.dataset.original) {
                    let errorMsg = document.getElementById('emailError');
                    if (!errorMsg) {
                        errorMsg = document.createElement('div');
                        errorMsg.id = 'emailError';
                        errorMsg.style.color = 'red';
                        errorMsg.innerText = 'New email is same as existing email';
                        emailInput.parentElement.appendChild(errorMsg);
                    }
                } else {
                    let errorMsg = document.getElementById('emailError');
                    if (errorMsg) errorMsg.remove();
                    // Email changed: disable input, hide save button, reset edit button
                    emailInput.disabled = true;
                    emailInput.style.cursor = 'not-allowed';
                    emailInput.style.color = 'rgb(135, 135, 135)';
                    emailInput.style.backgroundColor = 'rgb(250, 250, 250)';
                    emailInput.style.border = '1px solid rgb(224, 224, 224)';
                    emailSave.style.display = 'none';
                    emailEditButton.innerText = 'Edit';
                }
            });
        }

        // --- MOBILE Section ---
        let mobileInput = document.getElementById("mobileInput");
        if (mobileInput) {
            mobileInput.dataset.original = mobileInput.value;
        }
        let editMobileBtn = document.getElementById("editMobileBtn");
        let saveMobileBtn = document.getElementById("saveMobileBtn");
        if (editMobileBtn && saveMobileBtn) {
            editMobileBtn.innerText = "Edit";
            editMobileBtn.addEventListener("click", function(event) {
                event.preventDefault();
                let errorMsg = document.getElementById('mobileError');
                if (errorMsg) errorMsg.remove();
                if (this.innerText === "Edit") {
                    this.innerText = "Cancel";
                    mobileInput.disabled = false;
                    mobileInput.style.cursor = "text";
                    mobileInput.style.color = "black";
                    mobileInput.style.backgroundColor = "white";
                    mobileInput.style.border = "1px solid rgb(40, 116, 240)";
                    saveMobileBtn.style.display = "inline-block";
                } else {
                    if (mobileInput.value === mobileInput.dataset.original) {
                        if (!errorMsg) {
                            errorMsg = document.createElement('div');
                            errorMsg.id = 'mobileError';
                            errorMsg.style.color = 'red';
                            errorMsg.innerText = 'New phone number is same as existing phone number';
                            mobileInput.parentElement.appendChild(errorMsg);
                        }
                    } else {
                        if (errorMsg) errorMsg.remove();
                    }
                    this.innerText = "Edit";
                    mobileInput.disabled = true;
                    mobileInput.style.cursor = "not-allowed";
                    mobileInput.style.color = "rgb(135, 135, 135)";
                    mobileInput.style.backgroundColor = "rgb(250, 250, 250)";
                    mobileInput.style.border = "1px solid rgb(224, 224, 224)";
                    saveMobileBtn.style.display = "none";
                }
            });
            saveMobileBtn.addEventListener("click", function(event) {
                event.preventDefault();
                if (mobileInput.value === mobileInput.dataset.original) {
                    let errorMsg = document.getElementById('mobileError');
                    if (!errorMsg) {
                        errorMsg = document.createElement('div');
                        errorMsg.id = 'mobileError';
                        errorMsg.style.color = 'red';
                        errorMsg.innerText = 'New phone number is same as existing phone number';
                        mobileInput.parentElement.appendChild(errorMsg);
                    }
                } else {
                    let errorMsg = document.getElementById('mobileError');
                    if (errorMsg) errorMsg.remove();
                    editMobileBtn.innerText = "Edit";
                    mobileInput.disabled = true;
                    mobileInput.style.cursor = "not-allowed";
                    mobileInput.style.color = "rgb(135, 135, 135)";
                    mobileInput.style.backgroundColor = "rgb(250, 250, 250)";
                    mobileInput.style.border = "1px solid rgb(224, 224, 224)";
                    this.style.display = "none";
                }
            });
        }
    });
}


export { toggleEdit, initEditFunctions };
