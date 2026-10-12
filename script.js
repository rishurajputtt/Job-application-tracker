
const STORAGE_KEY = "careerflow_applications_v1";

const $ = (id) => document.getElementById(id);

const dialog = $("applicationDialog");
const form = $("applicationForm");

let applications = loadApplications();
let toastTimer;

function loadApplications() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter((a) =>
          a && typeof a === "object" &&
          typeof a.id === "string" &&
          typeof a.company === "string" &&
          typeof a.role === "string" &&
          typeof a.dateApplied === "string" &&
          ["Applied", "Interview", "Offer", "Rejected"].includes(a.status)
        )
      : [];
  } catch {
    return [];
  }
}

function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    return true;
  } catch {
    showToast("Could not save data. Check your browser storage.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeJobURL(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(date + "T00:00:00");
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function updateStats() {
  $("totalCount").textContent = applications.length;
  $("interviewCount").textContent = applications.filter(
    (a) => a.status === "Interview" || a.status === "Offer"
  ).length;
  $("offerCount").textContent = applications.filter(
    (a) => a.status === "Offer"
  ).length;
  $("rejectedCount").textContent = applications.filter(
    (a) => a.status === "Rejected"
  ).length;
}

function renderApplications() {
  const query = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const sort = $("sortFilter").value;

  let filtered = applications.filter((a) => {
    const matchesSearch =
      a.company.toLowerCase().includes(query) ||
      a.role.toLowerCase().includes(query);

    const matchesStatus = status === "All" || a.status === status;
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === "company") {
      return a.company.localeCompare(b.company);
    }

    const comparison = a.dateApplied.localeCompare(b.dateApplied);
    return sort === "oldest" ? comparison : -comparison;
  });

  $("applicationList").innerHTML = filtered.map((a) => {
    const company = escapeHTML(a.company);
    const role = escapeHTML(a.role);
    const initial = escapeHTML(a.company.trim().charAt(0).toUpperCase());
    const statusClass = a.status.toLowerCase();
    const link = safeJobURL(a.jobLink);
    const jobLinkHTML = link
      ? `<a class="job-link" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">View job ↗</a>`
      : `<span style="color:var(--muted)">No link</span>`;

    return `
      <tr>
        <td>
          <div class="company-cell">
            <div class="company-avatar">${initial || "?"}</div>
            <div>
              <div class="company-name">${company}</div>
              <div class="job-role">${role}</div>
            </div>
          </div>
        </td>
        <td>${formatDate(a.dateApplied)}</td>
        <td>
          <span class="status status-${statusClass}">
            ${escapeHTML(a.status)}
          </span>
        </td>
        <td>${jobLinkHTML}</td>
        <td>
          <div class="action-group">
            <button class="icon-btn" data-action="edit" data-id="${escapeHTML(a.id)}" aria-label="Edit ${company}">Edit</button>
            <button class="icon-btn delete" data-action="delete" data-id="${escapeHTML(a.id)}" aria-label="Delete ${company}">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const isEmpty = filtered.length === 0;
  $("emptyState").style.display = isEmpty ? "block" : "none";
  $("applicationList").parentElement.style.display = isEmpty ? "none" : "table";
  $("resultCount").textContent =
    `Showing ${filtered.length} of ${applications.length} applications`;

  updateStats();
}

function openAddDialog() {
  form.reset();
  $("editId").value = "";
  $("dialogTitle").textContent = "Add application";
  $("saveButton").textContent = "Save application";
  $("dateApplied").value = new Date().toLocaleDateString("en-CA");
  $("formError").textContent = "";
  dialog.showModal();
  $("company").focus();
}

function openEditDialog(id) {
  const app = applications.find((a) => a.id === id);
  if (!app) return;

  $("editId").value = app.id;
  $("company").value = app.company;
  $("role").value = app.role;
  $("dateApplied").value = app.dateApplied;
  $("status").value = app.status;
  $("jobLink").value = app.jobLink || "";
  $("notes").value = app.notes || "";

  $("dialogTitle").textContent = "Edit application";
  $("saveButton").textContent = "Update application";
  $("formError").textContent = "";
  dialog.showModal();
}

function deleteApplication(id) {
  const app = applications.find((a) => a.id === id);
  if (!app) return;

  if (!confirm(`Delete the application for ${app.company}?`)) return;

  const previous = applications;
  applications = applications.filter((a) => a.id !== id);

  if (!saveApplications()) {
    applications = previous;
    return;
  }

  renderApplications();
  showToast("Application deleted.");
}

function handleFormSubmit(event) {
  event.preventDefault();
  $("formError").textContent = "";

  if (!form.reportValidity()) return;

  const company = $("company").value.trim();
  const role = $("role").value.trim();
  const dateApplied = $("dateApplied").value;
  const rawLink = $("jobLink").value.trim();
  const jobLink = rawLink ? safeJobURL(rawLink) : "";
  const notes = $("notes").value.trim();

  if (!company || !role || !dateApplied) {
    $("formError").textContent = "Please complete all required fields.";
    return;
  }

  if (rawLink && !jobLink) {
    $("formError").textContent = "Enter a valid HTTP or HTTPS job URL.";
    return;
  }

  const editId = $("editId").value;
  const existing = applications.find((a) => a.id === editId);

  const record = {
    id: existing
      ? existing.id
      : (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`),
    company,
    role,
    dateApplied,
    status: $("status").value,
    jobLink,
    notes,
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  const previous = applications;

  if (existing) {
    applications = applications.map((a) =>
      a.id === editId ? record : a
    );
  } else {
    applications.push(record);
  }

  if (!saveApplications()) {
    applications = previous;
    return;
  }

  dialog.close();
  renderApplications();
  showToast(existing ? "Application updated!" : "Application added!");
}

function exportCSV() {
  if (applications.length === 0) {
    showToast("Add an application before exporting.");
    return;
  }

  const columns = [
    "Company", "Job Title", "Date Applied",
    "Status", "Job URL", "Notes"
  ];

  const rows = applications.map((a) => [
    a.company, a.role, a.dateApplied,
    a.status, a.jobLink || "", a.notes || ""
  ]);

  // Escape CSV fields and protect against spreadsheet formulas.
  const csvCell = (value) => {
    let text = String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [columns, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "careerflow-applications.csv";
  anchor.click();
  URL.revokeObjectURL(url);

  showToast("CSV exported successfully!");
}

$("addButton").addEventListener("click", openAddDialog);
$("emptyAddButton").addEventListener("click", openAddDialog);
$("closeDialog").addEventListener("click", () => dialog.close());
$("cancelButton").addEventListener("click", () => dialog.close());
$("exportButton").addEventListener("click", exportCSV);
form.addEventListener("submit", handleFormSubmit);

$("searchInput").addEventListener("input", renderApplications);
$("statusFilter").addEventListener("change", renderApplications);
$("sortFilter").addEventListener("change", renderApplications);

$("applicationList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") openEditDialog(id);
  if (action === "delete") deleteApplication(id);
});

renderApplications();
