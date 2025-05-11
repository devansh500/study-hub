const StudyHub = {
    sessionCount: 0,
    time: 25 * 60,
    totalTime: 25 * 60,
    timerInterval: null,
    sessionLog: [],
    dragSrcEl: null,
    tasks: [],
    goals: [],

    init() {
        console.log('Initializing StudyHub');
        this.loadState();
        this.setupEventListeners();
        this.setupServiceWorker();
    },

    loadState() {
        try {
            this.sessionCount = parseInt(localStorage.getItem('sessionCount') || '0');
            document.getElementById('sessionCount').textContent = this.sessionCount;
            if (localStorage.getItem('theme') === 'dark') this.toggleTheme();
            this.loadTasks();
            this.loadGoals();
            this.sessionLog = JSON.parse(localStorage.getItem('sessionLog') || '[]');
            if (!Array.isArray(this.sessionLog)) this.sessionLog = [];
        } catch (e) {
            console.error('Failed to load state:', e);
            this.showToast('Error loading data. Using fallback.');
        }
    },

    setupServiceWorker() {
        if ('caches' in window) {
            const CACHE_NAME = 'study-hub-v4';
            window.addEventListener('load', () => {
                caches.open(CACHE_NAME).then(cache => cache.addAll([
                    '/',
                    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
                    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
                    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.4.0/purify.min.js'
                ])).catch(e => console.error('Cache error:', e));
            });
            window.addEventListener('fetch', event => {
                event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
            });
        }
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    addTask() {
        const input = document.getElementById('taskInput');
        const dueDate = document.getElementById('dueDate');
        const category = document.getElementById('category').value;
        if (!input.value.trim()) {
            this.showToast('Please enter a task!');
            return;
        }
        const taskText = DOMPurify.sanitize(input.value);
        const task = { text: taskText, category, completed: false, dueDate: dueDate.value || '' };
        const li = this.createTaskElement(task);
        document.getElementById('taskList').appendChild(li);
        input.value = '';
        dueDate.value = '';
        this.saveTasks();
        this.showToast('Task added!');
    },

    createTaskElement(task) {
        const li = document.createElement('li');
        li.className = 'task-item flex justify-between items-center draggable';
        li.draggable = true;
        li.tabIndex = 0;
        li.dataset.category = task.category;
        li.dataset.completed = task.completed.toString();
        li.dataset.dueDate = task.dueDate;
        const badgeClass = `badge badge-${task.category.toLowerCase().replace(' ', '-')}`;
        li.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="${badgeClass}">${task.category}</span>
                <span class="task-text" ondblclick="StudyHub.editTask(this)">${task.text}${task.dueDate ? ` (${task.dueDate})` : ''}</span>
            </div>
            <div class="flex gap-1">
                <button class="btn btn-green text-xs" onclick="StudyHub.toggleTask(this)" aria-label="Mark task as done">Done</button>
                <button class="btn btn-red text-xs" onclick="StudyHub.deleteTask(this)" aria-label="Delete task">Delete</button>
            </div>
        `;
        if (task.completed) li.classList.add('line-through');
        this.addDragListeners(li);
        return li;
    },

    editTask(span) {
        const li = span.parentElement.parentElement;
        const text = span.textContent.split(' (')[0];
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = 'input';
        input.onblur = () => {
            const newText = DOMPurify.sanitize(input.value);
            if (newText.trim()) {
                span.textContent = newText + (li.dataset.dueDate ? ` (${li.dataset.dueDate})` : '');
                this.saveTasks();
                this.showToast('Task updated!');
            } else {
                this.showToast('Task cannot be empty!');
            }
            span.style.display = '';
            input.remove();
        };
        input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
        span.style.display = 'none';
        span.parentElement.insertBefore(input, span);
        input.focus();
    },

    toggleTask(btn) {
        const li = btn.parentElement.parentElement;
        li.classList.toggle('line-through');
        li.dataset.completed = li.classList.contains('line-through') ? 'true' : 'false';
        this.saveTasks();
        this.showToast(li.dataset.completed === 'true' ? 'Task completed!' : 'Task marked as pending.');
    },

    deleteTask(btn) {
        // Confirmation disabled. Uncomment to enable.
        // if (!confirm('Are you sure you want to delete this task?')) return;
        btn.parentElement.parentElement.remove();
        this.saveTasks();
        this.showToast('Task deleted.');
    },

    clearAllTasks() {
        if (!confirm('Are you sure you want to delete all tasks?')) return;
        document.getElementById('taskList').innerHTML = '';
        this.saveTasks();
        this.showToast('All tasks cleared.');
    },

    filterTasks(type) {
        const taskList = document.getElementById('taskList');
        Array.from(taskList.children).forEach(task => {
            task.style.display = type === 'all' ? '' : task.dataset.completed === (type === 'pending' ? 'false' : 'true') ? '' : 'none';
        });
    },

    sortTasksByDueDate() {
        const taskList = document.getElementById('taskList');
        const tasks = Array.from(taskList.children);
        tasks.sort((a, b) => {
            const dateA = a.dataset.dueDate ? new Date(a.dataset.dueDate) : new Date('9999-12-31');
            const dateB = b.dataset.dueDate ? new Date(b.dataset.dueDate) : new Date('9999-12-31');
            return dateA - dateB;
        });
        taskList.innerHTML = '';
        tasks.forEach(task => taskList.appendChild(task));
        this.showToast('Tasks sorted by due date.');
    },

    addDragListeners(el) {
        el.removeEventListener('dragstart', el.dragStartHandler);
        el.removeEventListener('dragover', el.dragOverHandler);
        el.removeEventListener('drop', el.dropHandler);
        el.removeEventListener('dragend', el.dragEndHandler);
        el.removeEventListener('keydown', el.keyDownHandler);

        el.dragStartHandler = e => {
            this.dragSrcEl = el;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', el.innerHTML);
            el.style.opacity = '0.5';
        };
        el.dragOverHandler = e => e.preventDefault();
        el.dropHandler = e => {
            e.preventDefault();
            if (this.dragSrcEl && this.dragSrcEl !== el) {
                this.dragSrcEl.innerHTML = el.innerHTML;
                el.innerHTML = e.dataTransfer.getData('text/html');
                this.addDragListeners(this.dragSrcEl);
                this.addDragListeners(el);
                this.saveTasks();
            }
        };
        el.dragEndHandler = () => el.style.opacity = '1';
        el.keyDownHandler = e => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const sibling = e.key === 'ArrowUp' ? el.previousElementSibling : el.nextElementSibling;
                if (sibling) {
                    const parent = el.parentElement;
                    if (e.key === 'ArrowUp') {
                        parent.insertBefore(el, sibling);
                    } else {
                        parent.insertBefore(sibling, el);
                    }
                    this.saveTasks();
                    el.focus();
                }
            }
        };

        el.addEventListener('dragstart', el.dragStartHandler);
        el.addEventListener('dragover', el.dragOverHandler);
        el.addEventListener('drop', el.dropHandler);
        el.addEventListener('dragend', el.dragEndHandler);
        el.addEventListener('keydown', el.keyDownHandler);
    },

    saveTasks() {
        try {
            const tasks = Array.from(document.querySelectorAll('#taskList li')).map(li => ({
                text: li.querySelector('.task-text').textContent.split(' (')[0],
                category: li.dataset.category,
                completed: li.dataset.completed === 'true',
                dueDate: li.dataset.dueDate
            }));
            this.tasks = tasks;
            localStorage.setItem('tasks', JSON.stringify(tasks));
        } catch (e) {
            console.error('Failed to save tasks:', e);
            this.showToast('Error saving tasks.');
        }
    },

    loadTasks() {
        try {
            const savedTasks = localStorage.getItem('tasks');
            if (!savedTasks) return;
            const tasks = JSON.parse(savedTasks);
            this.tasks = tasks;
            if (!Array.isArray(tasks)) return;
            const taskList = document.getElementById('taskList');
            taskList.innerHTML = '';
            tasks.forEach(task => {
                if (task && typeof task === 'object' && task.text && task.category && 'completed' in task) {
                    const li = this.createTaskElement(task);
                    taskList.appendChild(li);
                }
            });
        } catch (e) {
            console.error('Failed to load tasks:', e);
            this.tasks = [];
            this.showToast('Error loading tasks.');
        }
    },

    addGoal() {
        const input = document.getElementById('goalInput');
        if (!input.value.trim()) {
            this.showToast('Please enter a goal!');
            return;
        }
        const li = document.createElement('li');
        li.className = 'goal-item flex justify-between items-center';
        li.innerHTML = `
            <span>${DOMPurify.sanitize(input.value)}</span>
            <button class="btn btn-green text-xs" onclick="StudyHub.deleteGoal(this)" aria-label="Mark goal as done">Done</button>
        `;
        document.getElementById('goalList').appendChild(li);
        input.value = '';
        this.saveGoals();
        this.showToast('Goal added!');
    },

    deleteGoal(btn) {
        // Confirmation disabled. Uncomment to enable.
        // if (!confirm('Are you sure you want to mark this goal as done?')) return;
        btn.parentElement.remove();
        this.saveGoals();
        this.showToast('Goal completed.');
    },

    clearAllGoals() {
        if (!confirm('Are you sure you want to delete all goals?')) return;
        document.getElementById('goalList').innerHTML = '';
        this.saveGoals();
        this.showToast('All goals cleared.');
    },

    saveGoals() {
        try {
            const goals = document.getElementById('goalList').innerHTML;
            this.goals = goals;
            localStorage.setItem('goals', goals);
        } catch (e) {
            console.error('Failed to save goals:', e);
            this.showToast('Error saving goals.');
        }
    },

    loadGoals() {
        try {
            const savedGoals = localStorage.getItem('goals');
            if (savedGoals) {
                document.getElementById('goalList').innerHTML = savedGoals;
                this.goals = savedGoals;
            }
        } catch (e) {
            console.error('Failed to load goals:', e);
            this.goals = [];
            this.showToast('Error loading goals.');
        }
    },

    setProgress(percent) {
        const fill = document.getElementById('progressBarFill');
        if (fill) fill.style.width = `${percent}%`;
    },

    setTimer(minutes) {
        this.resetTimer();
        this.time = minutes * 60;
        this.totalTime = minutes * 60;
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = `${minutes}:00`;
        this.setProgress(100);
    },

    startTimer() {
        if (this.timerInterval) return;
        this.timerInterval = setInterval(() => {
            this.time--;
            const minutes = Math.floor(this.time / 60);
            const seconds = this.time % 60;
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            }
            this.setProgress((this.time / this.totalTime) * 100);
            if (this.time <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                const audio = new Audio('data:audio/mpeg;base64,/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
                audio.play().catch(e => console.error('Audio error:', e));
                const message = this.totalTime === 25 * 60 ? 'Time’s up! Take a break.' : 'Break over! Back to work.';
                this.showTimerModal(message);
                this.sessionCount++;
                const sessionEl = document.getElementById('sessionCount');
                if (sessionEl) sessionEl.textContent = this.sessionCount;
                try {
                    localStorage.setItem('sessionCount', this.sessionCount);
                } catch (e) {
                    this.showToast('Error saving session count.');
                }
                this.logSession(this.totalTime / 60);
                this.resetTimer();
            }
        }, 1000);
    },

    resetTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.time = 25 * 60;
        this.totalTime = 25 * 60;
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = '25:00';
        this.setProgress(100);
    },

    logSession(minutes) {
        this.sessionLog.push({ date: new Date().toLocaleString(), duration: minutes });
        try {
            localStorage.setItem('sessionLog', JSON.stringify(this.sessionLog));
        } catch (e) {
            console.error('Failed to save session log:', e);
            this.showToast('Error saving session log.');
        }
    },

    downloadLog() {
        const data = this.sessionLog.map(s => `${s.date}: ${s.duration} minutes`).join('\n');
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'study_sessions.txt';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Session log downloaded.');
    },

    showTimerModal(message) {
        const modal = document.getElementById('timerModal');
        const messageEl = document.getElementById('timerMessage');
        if (modal && messageEl) {
            messageEl.textContent = message;
            modal.classList.remove('hidden');
            modal.focus();
            this.trapFocus(modal);
        }
    },

    hideTimerModal() {
        const modal = document.getElementById('timerModal');
        if (modal) {
            modal.classList.add('hidden');
            document.querySelector('header h1').focus();
        }
    },

    quotes: [
        "Tanishka, you’re unstoppable—keep shining!",
        "Every step you take is progress, Tanishka!",
        "You’ve got this, Tanishka—keep pushing!",
        "Your hard work will pay off, Tanishka!",
        "Believe in yourself, Tanishka—you’re amazing!",
        "Dream big, work hard, stay focused, Tanishka!"
    ],
    newQuote() {
        const quoteEl = document.getElementById('quote');
        if (quoteEl) {
            quoteEl.classList.remove('fade-in');
            void quoteEl.offsetWidth;
            quoteEl.classList.add('fade-in');
            quoteEl.textContent = this.quotes[Math.floor(Math.random() * this.quotes.length)];
        }
    },

    toggleTheme() {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.className = document.body.classList.contains('dark-mode') ? 'fas fa-sun' : 'fas fa-moon';
        }
        try {
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        } catch (e) {
            this.showToast('Error saving theme.');
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.querySelector('.sidebar-toggle');
        if (sidebar && toggle) {
            sidebar.classList.toggle('open');
            toggle.setAttribute('aria-expanded', sidebar.classList.contains('open'));
        }
    },

    navigate(section) {
        const el = document.getElementById(section);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
            this.toggleSidebar();
        }
    },

    trapFocus(modal) {
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const handler = e => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            } else if (e.key === 'Escape') {
                this.hideTimerModal();
            }
        };
        modal.addEventListener('keydown', handler);
        modal.addEventListener('focusout', () => modal.focus(), { once: true });
    }
};

StudyHub.init();