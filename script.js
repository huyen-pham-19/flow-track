const USERS_STORAGE_KEY = "flowtrack-users";
const API_BASE_URL = "/api";
const APP_STORAGE_PREFIX = "flowtrack-v5";
const DEFAULT_THEME = "dark";
const DEFAULT_PAGE = "board";
const DEFAULT_BOARD_FILTER = "all";
const DEFAULT_CALENDAR_VIEW = "week";
const DEFAULT_START_TIME = "09:00";
const DONE_RETENTION_DAYS = 3;
const CALENDAR_START_HOUR = 6;
const CALENDAR_END_HOUR = 22;
const FALLBACK_UNSCHEDULED_HOUR = 8;
const TOAST_DURATION = 2600;

const PRIORITIES = ["low", "medium", "high"];
const COLUMN_COLOR_PALETTE = ["#f25ad4", "#8b5cf6", "#27c281", "#ffb648", "#38bdf8"];
const STATUS_TRANSITION_MESSAGES = {
  todo_to_doing: "Task đã được chuyển sang Doing.",
  doing_to_done: "Task đã được hoàn thành.",
  done_to_other: "Task đã được mở lại."
};

const DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do", color: "#f25ad4" },
  { id: "doing", title: "Doing", color: "#8b5cf6" },
  { id: "done", title: "Done", color: "#27c281" }
];

const DEFAULT_STATE = {
  theme: DEFAULT_THEME,
  activePage: DEFAULT_PAGE,
  boardFilter: DEFAULT_BOARD_FILTER,
  calendarView: DEFAULT_CALENDAR_VIEW,
  calendarDate: todayDate(),
  columns: structuredClone(DEFAULT_COLUMNS),
  tasks: []
};

let state = structuredClone(DEFAULT_STATE);

const els = {
  body: document.body,
  navButtons: Array.from(document.querySelectorAll(".nav-btn")),
  pages: {
    board: document.getElementById("boardPage"),
    calendar: document.getElementById("calendarPage")
  },
  pageTitle: document.getElementById("pageTitle"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  searchInput: document.getElementById("searchInput"),
  addTaskQuickBtn: document.getElementById("addTaskQuickBtn"),
  addColumnBtn: document.getElementById("addColumnBtn"),
  board: document.getElementById("board"),
  segmentedButtons: Array.from(document.querySelectorAll(".segmented-btn")),
  listCount: document.getElementById("listCount"),
  taskCount: document.getElementById("taskCount"),
  doneCount: document.getElementById("doneCount"),
  totalTasksStat: document.getElementById("totalTasksStat"),
  totalDurationStat: document.getElementById("totalDurationStat"),
  calendar: document.getElementById("calendar"),
  calendarTitle: document.getElementById("calendarTitle"),
  calendarTaskCount: document.getElementById("calendarTaskCount"),
  calendarDurationCount: document.getElementById("calendarDurationCount"),
  calendarViewBtns: Array.from(document.querySelectorAll(".calendar-view-btn")),
  prevPeriodBtn: document.getElementById("prevPeriodBtn"),
  nextPeriodBtn: document.getElementById("nextPeriodBtn"),
  todayBtn: document.getElementById("todayBtn"),
  modal: document.getElementById("taskModal"),
  modalTitleText: document.getElementById("modalTitleText"),
  taskTitle: document.getElementById("taskTitle"),
  taskDescription: document.getElementById("taskDescription"),
  taskStatus: document.getElementById("taskStatus"),
  taskPriority: document.getElementById("taskPriority"),
  taskDate: document.getElementById("taskDate"),
  taskStartHour: document.getElementById("taskStartHour"),
  taskStartMinute: document.getElementById("taskStartMinute"),
  taskStartPeriod: document.getElementById("taskStartPeriod"),
  taskDuration: document.getElementById("taskDuration"),
  taskTags: document.getElementById("taskTags"),
  saveTaskBtn: document.getElementById("saveTaskBtn"),
  deleteTaskBtn: document.getElementById("deleteTaskBtn")
};

const ui = {
  searchTerm: "",
  dragTaskId: null,
  modalTaskId: null
};

init();

async function init() {
  initTimePickerOptions();
  bindEvents();

  if (window.FlowTrackAuth) {
    window.FlowTrackAuth.init({
      onLogin: async () => {
        state = await loadState();
        normalizeState();
        applyTheme();
        renderAll();
      },
      onLogout: () => {
        state = structuredClone(DEFAULT_STATE);
        applyTheme();
        renderAll();
      }
    });
    return;
  }

  state = await loadState();
  normalizeState();
  applyTheme();
  renderAll();
}

function normalizeState() {
  ensureColumnsFallback();
  normalizeTasksShape();
  cleanupExpiredDoneTasks();
  normalizeTaskCompletion();
}

function bindEvents() {
  bindStaticControls();
  bindModalControls();
}

function bindStaticControls() {
  els.themeToggleBtn.addEventListener("click", handleThemeToggle);
  els.addTaskQuickBtn.addEventListener("click", () => openTaskModal());
  els.addColumnBtn.addEventListener("click", addColumn);
  els.prevPeriodBtn.addEventListener("click", () => shiftCalendar(-1));
  els.nextPeriodBtn.addEventListener("click", () => shiftCalendar(1));
  els.todayBtn.addEventListener("click", goToToday);

  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => setActivePage(button.dataset.page));
  });

  els.segmentedButtons.forEach((button) => {
    button.addEventListener("click", () => setBoardFilter(button.dataset.filter));
  });

  els.calendarViewBtns.forEach((button) => {
    button.addEventListener("click", () => setCalendarView(button.dataset.view));
  });

  els.searchInput.addEventListener("input", handleSearchInput);
}

function bindModalControls() {
  document.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      closeTaskModal();
    }
  });

  els.saveTaskBtn.addEventListener("click", saveTaskFromModal);
  els.deleteTaskBtn.addEventListener("click", deleteTaskFromModal);
  
}

async function handleThemeToggle() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  await persist();
  applyTheme();
}

async function setActivePage(page) {
  state.activePage = page;
  await persist();
  renderPages();
}

async function setBoardFilter(filter) {
  state.boardFilter = filter;
  await persist();
  renderBoard();
}

async function setCalendarView(view) {
  state.calendarView = view;
  await persist();
  renderCalendar();
}

function handleSearchInput(event) {
  ui.searchTerm = event.target.value.trim().toLowerCase();
  renderBoard();
  renderCalendar();
}

async function goToToday() {
  state.calendarDate = todayDate();
  await persist();
  renderCalendar();
}

function renderAll() {
  normalizeState();
  renderPages();
  renderBoard();
  renderCalendar();
  renderStats();
}

function renderPages() {
  Object.entries(els.pages).forEach(([key, page]) => {
    page.classList.toggle("active", key === state.activePage);
  });

  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === state.activePage);
  });

  els.pageTitle.textContent = state.activePage === "board" ? "Board" : "Calendar";
}

function renderBoard() {
  els.board.innerHTML = "";
  syncBoardFilterButtons();

  getVisibleColumns().forEach((column) => {
    els.board.appendChild(createColumnElement(column));
  });

  renderStats();
}

function syncBoardFilterButtons() {
  els.segmentedButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.boardFilter);
  });
}

function getVisibleColumns() {
  if (state.boardFilter === "all") return state.columns;
  return state.columns.filter((column) => column.id === state.boardFilter);
}

function createColumnElement(column) {
  const tasks = getTasksByStatus(column.id);
  const columnEl = document.createElement("section");

  columnEl.className = "column";
  columnEl.dataset.status = column.id;
  columnEl.innerHTML = getColumnTemplate(column, tasks.length);

  const listEl = columnEl.querySelector(".card-list");
  const addInColumnBtn = columnEl.querySelector(`[data-add-in-column="${column.id}"]`);
  const deleteColumnBtn = columnEl.querySelector(`[data-delete-column="${column.id}"]`);
  const quickInput = columnEl.querySelector(`[data-quick-input="${column.id}"]`);
  const quickAddBtn = columnEl.querySelector(`[data-quick-add="${column.id}"]`);

  bindColumnDropzone(listEl, column.id);
  tasks.forEach((task) => listEl.appendChild(createTaskCard(task)));

  addInColumnBtn.addEventListener("click", () => openTaskModal(null, column.id));

  if (deleteColumnBtn) {
    deleteColumnBtn.addEventListener("click", () => deleteColumn(column.id));
  }

  const handleQuickAdd = () => createQuickTask(column.id, quickInput.value, quickInput);
  quickAddBtn.addEventListener("click", handleQuickAdd);
  quickInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleQuickAdd();
  });

  return columnEl;
}

function getColumnTemplate(column, taskCount) {
  const deleteButton = state.columns.length > 1
    ? `<button class="icon-btn" type="button" data-delete-column="${column.id}">🗑</button>`
    : "";

  return `
    <div class="column-header">
      <div class="column-title-wrap">
        <span class="column-dot" style="background:${column.color}"></span>
        <div>
          <strong>${escapeHtml(column.title)}</strong>
          <div class="column-count">${taskCount} tasks</div>
        </div>
      </div>
      <div class="column-actions">
        <button class="icon-btn" type="button" data-add-in-column="${column.id}">＋</button>
        ${deleteButton}
      </div>
    </div>

    <div class="card-list" data-dropzone="${column.id}"></div>

    <div class="add-task-box">
      <input type="text" placeholder="Quick add task..." data-quick-input="${column.id}" />
      <button class="ghost-btn" type="button" data-quick-add="${column.id}">Add task</button>
    </div>
  `;
}

function bindColumnDropzone(dropzoneEl, targetStatus) {
  dropzoneEl.addEventListener("dragover", (event) => event.preventDefault());
  dropzoneEl.addEventListener("drop", () => handleTaskDrop(targetStatus));
}

function handleTaskDrop(targetStatus) {
  if (!ui.dragTaskId) return;

  const task = findTaskById(ui.dragTaskId);
  if (!task) return;

  const previousStatus = task.status;
  const transitionCheck = validateStatusTransition(previousStatus, targetStatus);

  if (!transitionCheck.allowed) {
    showToast(transitionCheck.message);
    return;
  }

  if (previousStatus === targetStatus) return;

  setTaskStatus(task, targetStatus);
  persist();
  renderAll();

  const transitionMessage = getTransitionMessage(previousStatus, targetStatus);
  if (transitionMessage) showToast(transitionMessage);
}

function createQuickTask(status, rawTitle, inputEl) {
  const title = rawTitle.trim();
  if (!title) return;

  const nextStatus = status === "done" ? "doing" : status;
  state.tasks.unshift(createTask({
    title,
    description: "",
    status: nextStatus,
    priority: "medium",
    date: "",
    startTime: DEFAULT_START_TIME,
    duration: 0,
    tags: []
  }));

  if (status === "done") {
    showToast("Task mới nên bắt đầu ở To Do hoặc Doing.");
  }

  inputEl.value = "";
  normalizeState();
  persist();
  renderAll();
}

function createTaskCard(task) {
  const card = document.createElement("article");
  const overdue = isTaskOverdue(task);

  card.className = `task-card${overdue ? " overdue" : ""}`;
  card.draggable = true;
  card.innerHTML = getTaskCardTemplate(task, overdue);

  card.addEventListener("click", (event) => {
    if (event.target.closest(".task-actions")) return;
    openTaskModal(task.id);
  });

  bindTaskCardActions(card, task);
  bindTaskCardDragEvents(card, task.id);

  return card;
}

function getTaskCardTemplate(task, overdue) {
  const metaParts = [
    task.date ? `<span class="meta-pill">📅 ${task.date}</span>` : "",
    task.startTime ? `<span class="meta-pill">🕒 ${formatDisplayTime(task.startTime)}</span>` : "",
    task.duration ? `<span class="meta-pill">⏱ ${task.duration}m</span>` : ""
  ].join("");

  const tagsHtml = Array.isArray(task.tags) && task.tags.length
    ? `<div class="tags-row">${task.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";

  const doneInfoHtml = task.status === "done" && task.completedAt
    ? `<div class="meta-row"><span class="meta-pill">✅ Done ${formatCompletedLabel(task.completedAt)}</span></div>`
    : "";

  const overdueHtml = overdue
    ? `
      <div class="overdue-warning">
        <strong>⚠ Task quá deadline</strong>
        <span>Hãy xử lý ngay hoặc chuyển sang Doing nếu bạn đã bắt đầu làm.</span>
      </div>
    `
    : "";

  return `
    <div class="card-head">
      <h4 class="card-title">${escapeHtml(task.title)}</h4>
      <span class="priority ${task.priority}">${task.priority}</span>
    </div>

    ${overdueHtml}

    <p class="card-desc">${escapeHtml(task.description || "No description yet.")}</p>

    <div class="meta-row">${metaParts}</div>

    ${doneInfoHtml}
    ${tagsHtml}
    ${getTaskActionButtons(task)}
  `;
}

function bindTaskCardActions(card, task) {
  const actionMap = {
    "mark-doing": () => moveTaskToDoing(task.id),
    "mark-done": () => moveTaskToDone(task.id),
    "reopen-task": () => reopenTask(task.id)
  };

  Object.entries(actionMap).forEach(([action, handler]) => {
    const button = card.querySelector(`[data-action="${action}"]`);
    if (!button) return;

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handler();
    });
  });
}

function bindTaskCardDragEvents(card, taskId) {
  card.addEventListener("dragstart", () => {
    ui.dragTaskId = taskId;
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    ui.dragTaskId = null;
    card.classList.remove("dragging");
  });
}

function getTaskActionButtons(task) {
  if (task.status === "todo") {
    return `
      <div class="task-actions">
        <button type="button" class="ghost-btn action-btn" data-action="mark-doing">▶ Mark doing</button>
      </div>
    `;
  }

  if (task.status === "doing") {
    return `
      <div class="task-actions">
        <button type="button" class="primary-btn action-btn" data-action="mark-done">✓ Completed</button>
      </div>
    `;
  }

  if (task.status === "done") {
    return `
      <div class="task-actions">
        <button type="button" class="ghost-btn action-btn" data-action="reopen-task">↺ Reopen</button>
      </div>
    `;
  }

  return "";
}

function moveTaskToDoing(taskId) {
  updateTaskStatus(taskId, "doing", {
    allowedFrom: ["todo"],
    successMessage: STATUS_TRANSITION_MESSAGES.todo_to_doing
  });
}

function moveTaskToDone(taskId) {
  updateTaskStatus(taskId, "done", {
    allowedFrom: ["doing"],
    invalidMessage: "Hãy chuyển task sang Doing trước khi hoàn thành.",
    successMessage: STATUS_TRANSITION_MESSAGES.doing_to_done
  });
}

function reopenTask(taskId) {
  updateTaskStatus(taskId, "doing", {
    allowedFrom: ["done"],
    successMessage: "Task đã được mở lại và chuyển về Doing."
  });
}

function updateTaskStatus(taskId, nextStatus, options = {}) {
  const task = findTaskById(taskId);
  if (!task) return false;

  const { allowedFrom, invalidMessage, successMessage } = options;

  if (Array.isArray(allowedFrom) && !allowedFrom.includes(task.status)) {
    if (invalidMessage) showToast(invalidMessage);
    return false;
  }

  setTaskStatus(task, nextStatus);
  normalizeState();
  persist();
  renderAll();

  if (successMessage) showToast(successMessage);
  return true;
}

function renderCalendar() {
  els.calendar.innerHTML = "";
  syncCalendarViewButtons();

  const baseDate = fromDateInputValue(state.calendarDate);

  if (state.calendarView === "day") {
    els.calendarTitle.textContent = formatLongDate(baseDate);
    renderDayCalendar(baseDate);
  } else {
    const weekStart = startOfWeek(baseDate);
    const weekEnd = addDateDays(weekStart, 6);
    els.calendarTitle.textContent = `${formatShortDate(weekStart)} — ${formatShortDate(weekEnd)}`;
    renderWeekCalendar(weekStart);
  }

  const visibleTasks = getCalendarTasksInView();
  const totalDuration = sumTaskDuration(visibleTasks);

  els.calendarTaskCount.textContent = visibleTasks.length;
  els.calendarDurationCount.textContent = formatHours(totalDuration);

  renderStats();
}

function syncCalendarViewButtons() {
  els.calendarViewBtns.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.calendarView);
  });
}

function renderWeekCalendar(weekStart) {
  const wrapper = document.createElement("div");
  wrapper.className = "week-grid";

  wrapper.appendChild(cell("corner-cell", ""));

  const weekDays = getWeekDays(weekStart);
  weekDays.forEach((date) => wrapper.appendChild(createDayHeader(date)));

  for (let hour = CALENDAR_START_HOUR; hour <= CALENDAR_END_HOUR; hour += 1) {
    wrapper.appendChild(cell("time-cell", `${pad(hour)}:00`));
    weekDays.forEach((date) => wrapper.appendChild(createCalendarDayCell(toDateInputValue(date), hour)));
  }

  els.calendar.appendChild(wrapper);
}

function renderDayCalendar(date) {
  const wrapper = document.createElement("div");
  wrapper.className = "day-grid";

  wrapper.appendChild(cell("corner-cell", ""));
  wrapper.appendChild(createDayHeader(date, true));

  for (let hour = CALENDAR_START_HOUR; hour <= CALENDAR_END_HOUR; hour += 1) {
    wrapper.appendChild(cell("time-cell", `${pad(hour)}:00`));
    wrapper.appendChild(createCalendarDayCell(toDateInputValue(date), hour));
  }

  els.calendar.appendChild(wrapper);
}

function createDayHeader(date, longLabel = false) {
  const header = document.createElement("div");
  header.className = "day-header";
  header.innerHTML = `
    <strong>${weekdayLabel(date)}</strong>
    <span>${longLabel ? formatLongDate(date) : formatShortDate(date)}</span>
  `;
  return header;
}

function createCalendarDayCell(dateStr, hour) {
  const cellEl = document.createElement("div");
  cellEl.className = "day-cell";

  getTasksForDate(dateStr, hour).forEach((task) => {
    cellEl.appendChild(createCalendarTaskElement(task));
  });

  return cellEl;
}

function createCalendarTaskElement(task) {
  const element = document.createElement("div");
  element.className = "calendar-task";
  element.innerHTML = `
    <strong>${escapeHtml(task.title)}</strong>
    <span>${task.startTime ? formatDisplayTime(task.startTime) : "--:--"} • ${task.duration || 0}m</span>
  `;
  element.addEventListener("click", () => openTaskModal(task.id));
  return element;
}

function renderStats() {
  const scheduledTasks = state.tasks.filter((task) => Boolean(task.date));
  const doneTasks = state.tasks.filter((task) => task.status === "done").length;

  els.listCount.textContent = state.columns.length;
  els.taskCount.textContent = state.tasks.length;
  els.doneCount.textContent = doneTasks;
  els.totalTasksStat.textContent = scheduledTasks.length;
  els.totalDurationStat.textContent = formatHours(sumTaskDuration(scheduledTasks));
}

function openTaskModal(taskId = null, defaultStatus = "todo") {
  ui.modalTaskId = taskId;
  populateStatusOptions();

  const task = taskId ? findTaskById(taskId) : null;
  const modalData = task ?? getEmptyModalTask(defaultStatus);

  els.modalTitleText.textContent = task ? "Edit task" : "Create task";
  els.taskTitle.value = modalData.title;
  els.taskDescription.value = modalData.description;
  els.taskStatus.value = modalData.status;
  els.taskPriority.value = modalData.priority;
  els.taskDate.value = modalData.date;
  setTimePickerValue(modalData.startTime);
  els.taskDuration.value = modalData.duration;
  els.taskTags.value = modalData.tags.join(", ");
  els.deleteTaskBtn.classList.toggle("hidden", !task);
  els.modal.classList.remove("hidden");
}

function getEmptyModalTask(defaultStatus) {
  return {
    title: "",
    description: "",
    status: defaultStatus,
    priority: "medium",
    date: "",
    startTime: DEFAULT_START_TIME,
    duration: "",
    tags: []
  };
}

function closeTaskModal() {
  els.modal.classList.add("hidden");
  ui.modalTaskId = null;
}

function populateStatusOptions() {
  els.taskStatus.innerHTML = state.columns
    .map((column) => `<option value="${column.id}">${escapeHtml(column.title)}</option>`)
    .join("");
}

function saveTaskFromModal() {
  const payload = getTaskPayloadFromModal();

  if (!payload.title) {
    alert("Please enter a task title.");
    return;
  }

  let success = false;

  if (ui.modalTaskId) {
    success = updateTaskFromModal(payload);
  } else {
    success = createTaskFromModal(payload);
  }

  if (!success) return;

  normalizeState();
  persist();
  closeTaskModal();
  renderAll();
}

function getTaskPayloadFromModal() {
  return {
    title: els.taskTitle.value.trim(),
    description: els.taskDescription.value.trim(),
    status: els.taskStatus.value,
    priority: PRIORITIES.includes(els.taskPriority.value) ? els.taskPriority.value : "medium",
    date: els.taskDate.value,
    startTime: getTimePickerValue(),
    duration: Math.max(0, Number(els.taskDuration.value || 0)),
    tags: parseTags(els.taskTags.value)
  };
}

function updateTaskFromModal(payload) {
  const task = findTaskById(ui.modalTaskId);
  if (!task) return false;

  const previousStatus = task.status;
  const transitionCheck = validateStatusTransition(previousStatus, payload.status);

  if (!transitionCheck.allowed) {
    showToast(transitionCheck.message);
    return false;
  }

  Object.assign(task, payload);
  updateTaskCompletionTimestamp(task, previousStatus, payload.status);
  return true;
}

function createTaskFromModal(payload) {
  const normalizedStatus = payload.status === "done" ? "doing" : payload.status;

  if (payload.status === "done") {
    showToast("Task mới nên bắt đầu ở To Do hoặc Doing.");
  }

  state.tasks.unshift(createTask({ ...payload, status: normalizedStatus }));
  return true;
}

function deleteTaskFromModal() {
  if (!ui.modalTaskId) return;

  state.tasks = state.tasks.filter((task) => task.id !== ui.modalTaskId);
  persist();
  closeTaskModal();
  renderAll();
}

function addColumn() {
  const name = prompt("Column name");
  if (!name) return;

  const title = name.trim();
  const id = slugify(title);

  if (state.columns.some((column) => column.id === id)) {
    alert("Column already exists.");
    return;
  }

  state.columns.push({
    id,
    title,
    color: randomAccent()
  });

  persist();
  renderAll();
}

function deleteColumn(columnId) {
  if (!confirm("Delete this column? Tasks inside it will move to To Do.")) return;

  state.columns = state.columns.filter((column) => column.id !== columnId);
  state.tasks = state.tasks.map((task) => {
    if (task.status !== columnId) return task;

    const updatedTask = { ...task };
    setTaskStatus(updatedTask, "todo");
    return updatedTask;
  });

  if (state.boardFilter === columnId) {
    state.boardFilter = "all";
  }

  persist();
  renderAll();
}

function shiftCalendar(direction) {
  const nextDate = fromDateInputValue(state.calendarDate);
  nextDate.setDate(nextDate.getDate() + (state.calendarView === "day" ? direction : direction * 7));

  state.calendarDate = toDateInputValue(nextDate);
  persist();
  renderCalendar();
}

function getFilteredTasks() {
  if (!ui.searchTerm) return state.tasks;

  return state.tasks.filter((task) => {
    const haystack = `${task.title} ${task.description} ${(task.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(ui.searchTerm);
  });
}

function getTasksByStatus(status) {
  return getFilteredTasks().filter((task) => task.status === status);
}

function getCalendarTasksInView() {
  const filteredTasks = getFilteredTasks();

  if (state.calendarView === "day") {
    return filteredTasks.filter((task) => task.date === state.calendarDate);
  }

  const visibleDates = getWeekDays(startOfWeek(fromDateInputValue(state.calendarDate)))
    .map((date) => toDateInputValue(date));

  return filteredTasks.filter((task) => visibleDates.includes(task.date));
}

function getTasksForDate(dateStr, hour) {
  return getFilteredTasks()
    .filter((task) => task.date === dateStr)
    .filter((task) => getTaskHour(task) === hour)
    .sort((left, right) => (left.startTime || "").localeCompare(right.startTime || ""));
}

function getTaskHour(task) {
  if (!task.startTime) return FALLBACK_UNSCHEDULED_HOUR;
  return Number(task.startTime.split(":")[0]);
}

function setTaskStatus(task, newStatus) {
  const previousStatus = task.status;
  task.status = newStatus;
  updateTaskCompletionTimestamp(task, previousStatus, newStatus);
}

function validateStatusTransition(previousStatus, nextStatus) {
  if (previousStatus === "todo" && nextStatus === "done") {
    return {
      allowed: false,
      message: "Hãy chuyển task sang Doing trước khi hoàn thành."
    };
  }

  return { allowed: true, message: "" };
}

function getTransitionMessage(previousStatus, nextStatus) {
  if (previousStatus === "todo" && nextStatus === "doing") {
    return STATUS_TRANSITION_MESSAGES.todo_to_doing;
  }

  if (previousStatus === "doing" && nextStatus === "done") {
    return STATUS_TRANSITION_MESSAGES.doing_to_done;
  }

  if (previousStatus === "done" && nextStatus !== "done") {
    return STATUS_TRANSITION_MESSAGES.done_to_other;
  }

  return "";
}

function updateTaskCompletionTimestamp(task, previousStatus, newStatus) {
  if (previousStatus !== "done" && newStatus === "done") {
    task.completedAt = nowIso();
    return;
  }

  if (previousStatus === "done" && newStatus !== "done") {
    task.completedAt = null;
    return;
  }

  if (newStatus === "done" && !task.completedAt) {
    task.completedAt = nowIso();
  }
}

function normalizeTaskCompletion() {
  let changed = false;

  state.tasks.forEach((task) => {
    if (task.status === "done" && !task.completedAt) {
      task.completedAt = nowIso();
      changed = true;
    }

    if (task.status !== "done" && task.completedAt) {
      task.completedAt = null;
      changed = true;
    }

    if (!task.createdAt) {
      task.createdAt = nowIso();
      changed = true;
    }
  });

  if (changed) persist();
}

function cleanupExpiredDoneTasks() {
  const initialCount = state.tasks.length;

  state.tasks = state.tasks.filter((task) => {
    if (task.status !== "done") return true;
    if (!task.completedAt) return true;
    return daysSince(task.completedAt) <= DONE_RETENTION_DAYS;
  });

  if (state.tasks.length !== initialCount) persist();
}

function normalizeTasksShape() {
  let changed = false;

  state.tasks = state.tasks.map((task) => {
    const normalized = {
      id: task.id || uid(),
      title: typeof task.title === "string" ? task.title : "",
      description: typeof task.description === "string" ? task.description : "",
      status: typeof task.status === "string" ? task.status : "todo",
      priority: PRIORITIES.includes(task.priority) ? task.priority : "medium",
      date: typeof task.date === "string" ? task.date : "",
      startTime: normalizeTimeValue(task.startTime),
      duration: Math.max(0, Number(task.duration || 0)),
      tags: Array.isArray(task.tags) ? task.tags.filter(Boolean) : [],
      completedAt: task.completedAt || null,
      createdAt: task.createdAt || nowIso()
    };

    if (!state.columns.some((column) => column.id === normalized.status)) {
      normalized.status = "todo";
      normalized.completedAt = null;
      changed = true;
    }

    if (
      normalized.id !== task.id ||
      normalized.title !== task.title ||
      normalized.description !== task.description ||
      normalized.status !== task.status ||
      normalized.priority !== task.priority ||
      normalized.date !== task.date ||
      normalized.startTime !== task.startTime ||
      normalized.duration !== Number(task.duration || 0) ||
      JSON.stringify(normalized.tags) !== JSON.stringify(task.tags || []) ||
      normalized.completedAt !== (task.completedAt || null) ||
      normalized.createdAt !== (task.createdAt || normalized.createdAt)
    ) {
      changed = true;
    }

    return normalized;
  });

  if (changed) persist();
}

function ensureColumnsFallback() {
  if (Array.isArray(state.columns) && state.columns.length) return;
  state.columns = structuredClone(DEFAULT_COLUMNS);
  persist();
}

function isTaskOverdue(task) {
  if (task.status !== "todo" || !task.date) return false;

  const now = new Date();
  const deadline = task.startTime
    ? new Date(`${task.date}T${task.startTime}:00`)
    : new Date(`${task.date}T23:59:59`);

  return deadline.getTime() < now.getTime();
}

function showToast(message) {
  let toast = document.getElementById("appToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, TOAST_DURATION);
}

function initTimePickerOptions() {
  els.taskStartHour.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const hour = String(index + 1).padStart(2, "0");
    return `<option value="${hour}">${hour}</option>`;
  }).join("");

  els.taskStartMinute.innerHTML = Array.from({ length: 60 }, (_, index) => {
    const minute = String(index).padStart(2, "0");
    return `<option value="${minute}">${minute}</option>`;
  }).join("");

  els.taskStartPeriod.innerHTML = `
    <option value="AM">AM</option>
    <option value="PM">PM</option>
  `;
}

function setTimePickerValue(time24) {
  const normalizedTime = normalizeTimeValue(time24);

  const [hours, minutes] = normalizedTime.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12;

  els.taskStartHour.value = String(hour12).padStart(2, "0");
  els.taskStartMinute.value = String(minutes).padStart(2, "0");
  els.taskStartPeriod.value = period;
}

function getTimePickerValue() {
  const hour = Number(els.taskStartHour.value || "9");
  const minute = Number(els.taskStartMinute.value || "0");
  const period = els.taskStartPeriod.value || "AM";

  let hour24 = hour % 12;
  if (period === "PM") hour24 += 12;
  if (period === "AM" && hour === 12) hour24 = 0;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplayTime(time24) {
  const normalizedTime = normalizeTimeValue(time24);
  const [hours, minutes] = normalizedTime.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12;

  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function normalizeTimeValue(time24) {
  if (typeof time24 !== "string" || !time24.includes(":")) {
    return DEFAULT_START_TIME;
  }

  const [rawHour, rawMinute] = time24.split(":");
  let hours = Number(rawHour);
  let minutes = Number(rawMinute);

  if (Number.isNaN(hours)) hours = 9;
  if (Number.isNaN(minutes)) minutes = 0;

  hours = Math.min(23, Math.max(0, hours));
  minutes = Math.min(59, Math.max(0, minutes));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function daysSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function formatCompletedLabel(isoDate) {
  const diff = daysSince(isoDate);

  if (diff < 1) return "today";
  if (diff < 2) return "1 day ago";
  return `${Math.floor(diff)} days ago`;
}

function applyTheme() {
  els.body.setAttribute("data-theme", state.theme);
}

async function loadState() {
  try {
    const token = window.FlowTrackAuth?.getToken?.();

    if (!token) {
      const raw = localStorage.getItem(`${APP_STORAGE_PREFIX}:guest`);
      if (!raw) return structuredClone(DEFAULT_STATE);

      const saved = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...saved,
        columns: Array.isArray(saved.columns) && saved.columns.length
          ? saved.columns
          : structuredClone(DEFAULT_COLUMNS),
        tasks: Array.isArray(saved.tasks)
          ? saved.tasks
          : structuredClone(DEFAULT_STATE.tasks)
      };
    }

    const response = await fetch(`${API_BASE_URL}/state`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return structuredClone(DEFAULT_STATE);
    }

    const data = await response.json();
    const saved = data.state || {};

    return {
      ...structuredClone(DEFAULT_STATE),
      ...saved,
      columns: Array.isArray(saved.columns) && saved.columns.length
        ? saved.columns
        : structuredClone(DEFAULT_COLUMNS),
      tasks: Array.isArray(saved.tasks)
        ? saved.tasks
        : structuredClone(DEFAULT_STATE.tasks)
    };
  } catch (error) {
    console.error("loadState error:", error);
    return structuredClone(DEFAULT_STATE);
  }
}

async function persist() {
  try {
    const token = window.FlowTrackAuth?.getToken?.();

    if (!token) {
      localStorage.setItem(`${APP_STORAGE_PREFIX}:guest`, JSON.stringify(state));
      return;
    }

    await fetch(`${API_BASE_URL}/state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(state)
    });
  } catch (error) {
    console.error("persist error:", error);
  }
}

function createTask(task) {
  const createdTask = {
    id: uid(),
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: PRIORITIES.includes(task.priority) ? task.priority : "medium",
    date: task.date ?? "",
    startTime: normalizeTimeValue(task.startTime),
    duration: Math.max(0, Number(task.duration || 0)),
    tags: Array.isArray(task.tags) ? task.tags : [],
    completedAt: null,
    createdAt: nowIso()
  };

  if (createdTask.status === "done") {
    createdTask.completedAt = nowIso();
  }

  return createdTask;
}

function findTaskById(taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function parseTags(rawValue) {
  return rawValue
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sumTaskDuration(tasks) {
  return tasks.reduce((sum, task) => sum + Number(task.duration || 0), 0);
}

function formatHours(totalMinutes) {
  return `${Math.round(totalMinutes / 60)}h`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || uid();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function randomAccent() {
  return COLUMN_COLOR_PALETTE[Math.floor(Math.random() * COLUMN_COLOR_PALETTE.length)];
}

function pad(num) {
  return String(num).padStart(2, "0");
}

function todayDate() {
  return toDateInputValue(new Date());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function addDays(dateStr, days) {
  const date = fromDateInputValue(dateStr);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function addDateDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);

  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addDateDays(weekStart, index));
}

function weekdayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function cell(className, text) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}