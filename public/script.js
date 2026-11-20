const API = "/api";

let collections = [];
let currentCollection = null;
let records = [];
let editingId = null;
let toastTimer = null;

// Collection descriptions and form fields.
const collectionSchemas = {
    students: {
        title: "Students",
        icon: "♙",
        description: "Student registration and academic information.",
        fields: [
            { name: "studentId", label: "Student ID", type: "text", required: true },
            { name: "fullName", label: "Full Name", type: "text", required: true },
            { name: "programme", label: "Programme", type: "text", required: true },
            { name: "year", label: "Year of Study", type: "number", required: true, min: 1 },
            { name: "email", label: "Email Address", type: "email", required: true },
            {
                name: "registrationStatus",
                label: "Registration Status",
                type: "select",
                options: ["Registered", "Pending"],
                required: true
            }
        ]
    },

    courses: {
        title: "Courses",
        icon: "▤",
        description: "Course and department information.",
        fields: [
            { name: "courseCode", label: "Course Code", type: "text", required: true },
            { name: "courseName", label: "Course Name", type: "text", required: true },
            { name: "department", label: "Department", type: "text", required: true },
            { name: "credits", label: "Credit Units", type: "number", required: true, min: 0 },
            { name: "level", label: "Course Level", type: "number", required: true, min: 1 }
        ]
    },

    payments: {
        title: "Payments",
        icon: "▣",
        description: "Student payment records.",
        fields: [
            { name: "paymentId", label: "Payment ID", type: "text", required: true },
            { name: "studentId", label: "Student ID", type: "text", required: true },
            { name: "amountUGX", label: "Amount (UGX)", type: "number", required: true, min: 0 },
            { name: "paymentDate", label: "Payment Date", type: "date", required: true },
            {
                name: "method",
                label: "Payment Method",
                type: "select",
                options: ["Mobile Money", "Bank", "Cash Office"],
                required: true
            },
            {
                name: "status",
                label: "Payment Status",
                type: "select",
                options: ["Confirmed", "Pending Verification"],
                required: true
            }
        ]
    },

    supportRequests: {
        title: "Support Requests",
        icon: "✉",
        description: "Student support and service requests.",
        fields: [
            { name: "requestId", label: "Request ID", type: "text", required: true },
            { name: "studentId", label: "Student ID", type: "text", required: true },
            {
                name: "category",
                label: "Request Category",
                type: "select",
                options: ["Registration", "Payment", "Portal Access", "Course Enrolment"],
                required: true
            },
            { name: "description", label: "Description", type: "textarea", required: true },
            {
                name: "status",
                label: "Request Status",
                type: "select",
                options: ["Open", "In Progress", "Resolved"],
                required: true
            },
            { name: "submittedDate", label: "Submission Date", type: "date", required: true }
        ]
    }
};

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function prettyName(name) {
    return collectionSchemas[name]?.title || name;
}

function notify(message, type = "success") {
    const toast = $("#toast");

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove("hidden");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(`${API}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || data.message || "Request failed.");
    }

    return data;
}

// Check backend connection.
async function checkConnection() {
    const status = $("#connectionStatus");

    status.innerHTML = '<span class="status-dot"></span> Checking connection...';

    try {
        const data = await apiRequest("/status");

        status.innerHTML =
            '<span class="status-dot"></span> Connected to database';

        $("#databaseName").textContent = data.database || "CampusSupportDB";

        return true;
    } catch (error) {
        status.innerHTML =
            '<span class="status-dot disconnected"></span> Connection failed';

        notify(error.message, "error");
        return false;
    }
}

// Load collection information.
async function loadCollections() {
    collections = await apiRequest("/collections");

    renderNavigation();
    renderDashboardCollections();
    updateStats();
}

// Sidebar collection navigation.
function renderNavigation() {
    const container = $("#collectionNav");

    container.innerHTML = collections.map((collection) => {
        const schema = collectionSchemas[collection.name];

        if (!schema) return "";

        return `
            <button class="nav-button collection-nav-button ${
                currentCollection === collection.name ? "active" : ""
            }"
                data-open-collection="${escapeHTML(collection.name)}">
                <span>${schema.icon}</span>
                ${escapeHTML(schema.title)}
                <small>${collection.count}</small>
            </button>
        `;
    }).join("");
}

// Dashboard collection table.
function renderDashboardCollections() {
    const body = $("#dashboardCollections");

    if (!collections.length) {
        body.innerHTML = `
            <tr><td colspan="4" class="empty-message">
                No collections found.
            </td></tr>`;
        return;
    }

    body.innerHTML = collections.map((collection) => {
        const schema = collectionSchemas[collection.name];

        return `
            <tr>
                <td><strong>${escapeHTML(schema?.title || collection.name)}</strong></td>
                <td>${escapeHTML(schema?.description || "")}</td>
                <td><span class="count-badge">${collection.count}</span></td>
                <td>
                    <button class="table-action"
                        data-action="open"
                        data-collection="${escapeHTML(collection.name)}">
                        View Records →
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Dashboard statistics.
function updateStats() {
    const count = (name) =>
        collections.find((item) => item.name === name)?.count || 0;

    $("#studentCount").textContent = count("students");
    $("#courseCount").textContent = count("courses");
    $("#paymentCount").textContent = count("payments");
    $("#supportCount").textContent = count("supportRequests");
}

// Display dashboard.
function showDashboard() {
    currentCollection = null;
    records = [];
    editingId = null;

    $("#dashboardView").classList.remove("hidden");
    $("#collectionView").classList.add("hidden");

    $("#pageTitle").textContent = "Dashboard";
    $("#dashboardNav").classList.add("active");

    renderNavigation();
}

// Open a collection.
async function openCollection(name) {
    if (!collectionSchemas[name]) {
        notify("Unknown collection.", "error");
        return;
    }

    currentCollection = name;

    $("#dashboardView").classList.add("hidden");
    $("#collectionView").classList.remove("hidden");

    $("#pageTitle").textContent = prettyName(name);
    $("#collectionHeading").textContent = prettyName(name);

    $("#searchInput").value = "";

    $("#dashboardNav").classList.remove("active");

    renderNavigation();

    await loadRecords();
}

// Fetch records.
async function loadRecords() {
    if (!currentCollection) return;

    try {
        records = await apiRequest(
            `/records/${encodeURIComponent(currentCollection)}`
        );

        $("#recordCount").textContent =
            `${records.length} record${records.length === 1 ? "" : "s"}`;

        renderRecords();
    } catch (error) {
        notify(error.message, "error");
    }
}

// Get collection fields from the fixed assignment schema.
function getFields() {
    return collectionSchemas[currentCollection]?.fields || [];
}

function displayValue(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

// Render collection records.
function renderRecords() {
    if (!currentCollection) return;

    const fields = getFields();
    const search = $("#searchInput").value.trim().toLowerCase();

    const filteredRecords = records.filter((record) =>
        JSON.stringify(record).toLowerCase().includes(search)
    );

    $("#recordsHead").innerHTML = `
        <tr>
            <th>MongoDB ID</th>
            ${fields.map((field) =>
                `<th>${escapeHTML(field.label)}</th>`
            ).join("")}
            <th>Actions</th>
        </tr>
    `;

    if (!filteredRecords.length) {
        $("#recordsBody").innerHTML = `
            <tr>
                <td colspan="${fields.length + 2}" class="empty-message">
                    ${records.length
                        ? "No matching records found."
                        : "No records in this collection yet. Click Add Record to create one."}
                </td>
            </tr>
        `;

        $("#tableSummary").textContent = "Showing 0 records";
        return;
    }

    $("#recordsBody").innerHTML = filteredRecords.map((record) => {
        const id = String(record._id);

        return `
            <tr>
                <td class="id-cell" title="${escapeHTML(id)}">
                    ${escapeHTML(id.slice(-8))}
                </td>

                ${fields.map((field) => `
                    <td>${escapeHTML(displayValue(record[field.name]))}</td>
                `).join("")}

                <td>
                    <div class="row-actions">
                        <button class="icon-button edit"
                            title="Edit record"
                            data-action="edit"
                            data-id="${escapeHTML(id)}">✎</button>

                        <button class="icon-button copy"
                            title="Copy record"
                            data-action="copy"
                            data-id="${escapeHTML(id)}">▢</button>

                        <button class="icon-button duplicate"
                            title="Duplicate record"
                            data-action="duplicate"
                            data-id="${escapeHTML(id)}">⧉</button>

                        <button class="icon-button delete"
                            title="Delete record"
                            data-action="delete"
                            data-id="${escapeHTML(id)}">×</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    $("#tableSummary").textContent =
        `Showing ${filteredRecords.length} of ${records.length} records`;
}

function clearSearch() {
    $("#searchInput").value = "";
    renderRecords();
}

async function refreshCurrent() {
    await loadRecords();
    await loadCollections();
    notify("Collection refreshed successfully.");
}

async function refreshAll() {
    try {
        await loadCollections();

        if (currentCollection) {
            await loadRecords();
        }

        notify("System refreshed successfully.");
    } catch (error) {
        notify(error.message, "error");
    }
}

// Build the form for a collection.
function buildForm(record = {}) {
    const fields = getFields();

    $("#formFields").innerHTML = fields.map((field) => {
        const value = record[field.name] ?? "";
        const required = field.required ? "required" : "";
        const min = field.min !== undefined ? `min="${field.min}"` : "";

        let control = "";

        if (field.type === "select") {
            const options = [...field.options];

            // Retain existing values not listed in the standard options.
            if (value && !options.includes(String(value))) {
                options.unshift(String(value));
            }

            control = `
                <select name="${escapeHTML(field.name)}" ${required}>
                    <option value="">Select ${escapeHTML(field.label)}</option>
                    ${options.map((option) => `
                        <option value="${escapeHTML(option)}"
                            ${String(value) === option ? "selected" : ""}>
                            ${escapeHTML(option)}
                        </option>
                    `).join("")}
                </select>
            `;
        } else if (field.type === "textarea") {
            control = `
                <textarea name="${escapeHTML(field.name)}"
                    rows="4" ${required}>${escapeHTML(value)}</textarea>
            `;
        } else {
            control = `
                <input
                    type="${escapeHTML(field.type)}"
                    name="${escapeHTML(field.name)}"
                    value="${escapeHTML(value)}"
                    ${min}
                    ${required}
                    ${field.type === "number" ? 'step="any"' : ""}
                >
            `;
        }

        return `
            <div class="form-group ${field.type === "textarea" ? "full-width" : ""}">
                <label for="field-${escapeHTML(field.name)}">
                    ${escapeHTML(field.label)}
                    ${field.required ? '<span class="required">*</span>' : ""}
                </label>
                ${control.replace(
                    `name="${escapeHTML(field.name)}"`,
                    `id="field-${escapeHTML(field.name)}" name="${escapeHTML(field.name)}"`
                )}
            </div>
        `;
    }).join("");
}

// Open Add Record modal.
function openAddModal() {
    if (!currentCollection) {
        notify("Please select a collection first.", "error");
        return;
    }

    editingId = null;

    $("#modalTitle").textContent = `Add ${prettyName(currentCollection)} Record`;
    $("#modalDescription").textContent =
        "Complete the fields below to create a new record.";

    $("#saveButton").textContent = "Save Record";

    buildForm();

    $("#recordModal").classList.remove("hidden");
}

// Edit a record.
function editRecord(id) {
    const record = records.find((item) => String(item._id) === String(id));

    if (!record) {
        notify("Record not found.", "error");
        return;
    }

    editingId = id;

    $("#modalTitle").textContent = "Edit Record";
    $("#modalDescription").textContent =
        "Update the information below. Other existing fields will be preserved.";

    $("#saveButton").textContent = "Update Record";

    buildForm(record);

    $("#recordModal").classList.remove("hidden");
}

// Close modal.
function closeModal() {
    $("#recordModal").classList.add("hidden");
    $("#recordForm").reset();
    $("#formFields").innerHTML = "";
    editingId = null;
}

// Convert form values into a database-ready object.
function getFormData() {
    const formData = new FormData($("#recordForm"));
    const data = {};

    for (const field of getFields()) {
        const rawValue = formData.get(field.name);

        if (field.type === "number") {
            data[field.name] =
                rawValue === "" ? null : Number(rawValue);
        } else {
            data[field.name] = String(rawValue ?? "").trim();
        }
    }

    return data;
}

// Save or update a record.
async function saveRecord(event) {
    event.preventDefault();

    if (!currentCollection) return;

    const data = getFormData();

    for (const field of getFields()) {
        if (field.required &&
            (data[field.name] === "" || data[field.name] === null ||
             (typeof data[field.name] === "number" &&
              !Number.isFinite(data[field.name])))) {
            notify(`Please provide a valid ${field.label}.`, "error");
            return;
        }
    }

    const isEditing = Boolean(editingId);

    try {
        if (isEditing) {
            await apiRequest(
                `/records/${encodeURIComponent(currentCollection)}/${encodeURIComponent(editingId)}`,
                {
                    method: "PUT",
                    body: JSON.stringify(data)
                }
            );

            notify("Record updated successfully.");
        } else {
            await apiRequest(
                `/records/${encodeURIComponent(currentCollection)}`,
                {
                    method: "POST",
                    body: JSON.stringify(data)
                }
            );

            notify("Record added successfully.");
        }

        closeModal();

        await refreshAll();
    } catch (error) {
        notify(error.message, "error");
    }
}

// Delete a record.
async function deleteRecord(id) {
    const confirmed = confirm(
        "Are you sure you want to permanently delete this record?"
    );

    if (!confirmed) return;

    try {
        await apiRequest(
            `/records/${encodeURIComponent(currentCollection)}/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        notify("Record deleted successfully.");
        await refreshAll();
    } catch (error) {
        notify(error.message, "error");
    }
}

// Copy record as JSON.
async function copyRecord(id) {
    const record = records.find((item) => String(item._id) === String(id));

    if (!record) return;

    try {
        await navigator.clipboard.writeText(
            JSON.stringify(record, null, 2)
        );

        notify("Record copied.");
    } catch {
        notify("Unable to access clipboard.", "error");
    }
}

// Duplicate record without the MongoDB _id.
async function duplicateRecord(id) {
    const record = records.find((item) => String(item._id) === String(id));

    if (!record) return;

    const confirmed = confirm("Create a duplicate of this record?");

    if (!confirmed) return;

    const duplicate = { ...record };
    delete duplicate._id;

    try {
        await apiRequest(
            `/records/${encodeURIComponent(currentCollection)}`,
            {
                method: "POST",
                body: JSON.stringify(duplicate)
            }
        );

        notify("Record duplicated successfully.");
        await refreshAll();
    } catch (error) {
        notify(error.message, "error");
    }
}

// Export records as a JSON file.
function exportRecords() {
    if (!currentCollection || !records.length) {
        notify("There are no records to export.", "error");
        return;
    }

    const blob = new Blob(
        [JSON.stringify(records, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${currentCollection}.json`;
    link.click();

    URL.revokeObjectURL(url);

    notify("Records exported successfully.");
}

// Import records from a JSON file.
async function importRecords(event) {
    const file = event.target.files[0];

    if (!file || !currentCollection) return;

    try {
        const text = await file.text();
        const importedRecords = JSON.parse(text);

        if (!Array.isArray(importedRecords)) {
            throw new Error("The JSON file must contain an array of records.");
        }

        if (!importedRecords.every((item) =>
            item && typeof item === "object" &&
            !Array.isArray(item)
        )) {
            throw new Error("Every imported record must be an object.");
        }

        if (!confirm(`Import ${importedRecords.length} records into ${prettyName(currentCollection)}?`)) {
            return;
        }

        let successful = 0;

        for (const item of importedRecords) {
            const newRecord = { ...item };
            delete newRecord._id;

            await apiRequest(
                `/records/${encodeURIComponent(currentCollection)}`,
                {
                    method: "POST",
                    body: JSON.stringify(newRecord)
                }
            );

            successful++;
        }

        notify(`${successful} records imported successfully.`);
        await refreshAll();
    } catch (error) {
        notify(error.message, "error");
    } finally {
        event.target.value = "";
    }
}

// Event delegation for navigation and table actions.
document.addEventListener("click", (event) => {
    const dashboardButton = event.target.closest("[data-dashboard]");

    if (dashboardButton) {
        showDashboard();
        return;
    }

    const collectionButton = event.target.closest("[data-open-collection]");

    if (collectionButton) {
        openCollection(collectionButton.dataset.openCollection);
        return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const id = actionButton.dataset.id;
    const collection = actionButton.dataset.collection;

    if (action === "open" && collection) {
        openCollection(collection);
    } else if (action === "edit" && id) {
        editRecord(id);
    } else if (action === "copy" && id) {
        copyRecord(id);
    } else if (action === "duplicate" && id) {
        duplicateRecord(id);
    } else if (action === "delete" && id) {
        deleteRecord(id);
    }
});

// Form submission.
$("#recordForm").addEventListener("submit", saveRecord);

// Close modal when clicking outside it.
$("#recordModal").addEventListener("click", (event) => {
    if (event.target.id === "recordModal") {
        closeModal();
    }
});

// Close modal using Escape key.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeModal();
    }
});

// Initialize application.
async function initialize() {
    const connected = await checkConnection();

    if (!connected) return;

    try {
        await loadCollections();
        showDashboard();
    } catch (error) {
        notify(error.message, "error");
    }
}

initialize();