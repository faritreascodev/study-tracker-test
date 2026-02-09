// ========================================
// Study Tracker Pro - Main Application
// Sistema Profesional de Gestión de Estudios
// ========================================

'use strict';

// ========== CONFIGURATION ==========
const CONFIG = {
    storage: {
        prefix: 'studytracker_',
        keys: {
            tasks: 'tasks',
            habits: 'habits',
            notes: 'notes',
            sessions: 'sessions',
            settings: 'settings',
            stats: 'stats'
        }
    },
    timer: {
        focus: 25,
        shortBreak: 5,
        longBreak: 15,
        autoStart: false,
        sound: true
    },
    app: {
        version: '1.0.0',
        name: 'Study Tracker Pro'
    }
};

// ========== STATE MANAGEMENT ==========
const state = {
    currentTab: 'dashboard',
    timer: {
        mode: 'focus',
        duration: CONFIG.timer.focus * 60,
        remaining: CONFIG.timer.focus * 60,
        isRunning: false,
        interval: null,
        currentTask: '',
        pomodoroCount: 0
    },
    tasks: [],
    habits: [],
    notes: [],
    sessions: [],
    settings: {
        userName: 'Usuario',
        theme: 'light',
        ...CONFIG.timer
    },
    draggedElement: null
};

// ========== STORAGE MANAGER ==========
class StorageManager {
    static save(key, data) {
        try {
            const storageKey = CONFIG.storage.prefix + key;
            localStorage.setItem(storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            showNotification('Error al guardar datos', 'error');
            return false;
        }
    }

    static load(key) {
        try {
            const storageKey = CONFIG.storage.prefix + key;
            const data = localStorage.getItem(storageKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    static remove(key) {
        try {
            const storageKey = CONFIG.storage.prefix + key;
            localStorage.removeItem(storageKey);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    static clear() {
        try {
            Object.values(CONFIG.storage.keys).forEach(key => {
                this.remove(key);
            });
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    static exportData() {
        const exportData = {
            version: CONFIG.app.version,
            exportDate: new Date().toISOString(),
            tasks: state.tasks,
            habits: state.habits,
            notes: state.notes,
            sessions: state.sessions,
            settings: state.settings
        };
        return JSON.stringify(exportData, null, 2);
    }

    static importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (data.tasks) state.tasks = data.tasks;
            if (data.habits) state.habits = data.habits;
            if (data.notes) state.notes = data.notes;
            if (data.sessions) state.sessions = data.sessions;
            if (data.settings) state.settings = { ...state.settings, ...data.settings };

            this.saveAll();
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    static saveAll() {
        this.save(CONFIG.storage.keys.tasks, state.tasks);
        this.save(CONFIG.storage.keys.habits, state.habits);
        this.save(CONFIG.storage.keys.notes, state.notes);
        this.save(CONFIG.storage.keys.sessions, state.sessions);
        this.save(CONFIG.storage.keys.settings, state.settings);
    }

    static loadAll() {
        state.tasks = this.load(CONFIG.storage.keys.tasks) || [];
        state.habits = this.load(CONFIG.storage.keys.habits) || [];
        state.notes = this.load(CONFIG.storage.keys.notes) || [];
        state.sessions = this.load(CONFIG.storage.keys.sessions) || [];
        state.settings = { ...state.settings, ...this.load(CONFIG.storage.keys.settings) };
    }
}

// ========== TASK MANAGER ==========
class TaskManager {
    static create(taskData) {
        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description || '',
            status: taskData.status || 'todo',
            priority: taskData.priority || 'medium',
            category: taskData.category || 'estudio',
            tags: taskData.tags || [],
            dueDate: taskData.dueDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null
        };

        state.tasks.push(task);
        StorageManager.save(CONFIG.storage.keys.tasks, state.tasks);
        ActivityLogger.log('task', `Tarea creada: ${task.title}`);
        showNotification('Tarea creada exitosamente', 'success');
        return task;
    }

    static update(id, updates) {
        const taskIndex = state.tasks.findIndex(t => t.id === id);
        if (taskIndex === -1) return false;

        state.tasks[taskIndex] = {
            ...state.tasks[taskIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        if (updates.status === 'done' && state.tasks[taskIndex].completedAt === null) {
            state.tasks[taskIndex].completedAt = new Date().toISOString();
            ActivityLogger.log('task', `Tarea completada: ${state.tasks[taskIndex].title}`);
            showNotification('¡Tarea completada! 🎉', 'success');
        }

        StorageManager.save(CONFIG.storage.keys.tasks, state.tasks);
        return state.tasks[taskIndex];
    }

    static delete(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return false;

        state.tasks = state.tasks.filter(t => t.id !== id);
        StorageManager.save(CONFIG.storage.keys.tasks, state.tasks);
        ActivityLogger.log('task', `Tarea eliminada: ${task.title}`);
        showNotification('Tarea eliminada', 'info');
        return true;
    }

    static getById(id) {
        return state.tasks.find(t => t.id === id);
    }

    static getByStatus(status) {
        return state.tasks.filter(t => t.status === status);
    }

    static getAll() {
        return state.tasks;
    }

    static updateStatus(id, newStatus) {
        return this.update(id, { status: newStatus });
    }

    static getStats() {
        const today = dayjs().format('YYYY-MM-DD');
        return {
            total: state.tasks.length,
            completed: state.tasks.filter(t => t.status === 'done').length,
            pending: state.tasks.filter(t => t.status !== 'done').length,
            completedToday: state.tasks.filter(t =>
                t.completedAt && dayjs(t.completedAt).format('YYYY-MM-DD') === today
            ).length
        };
    }
}

// ========== HABIT MANAGER ==========
class HabitManager {
    static create(habitData) {
        const habit = {
            id: Date.now().toString(),
            name: habitData.name,
            description: habitData.description || '',
            category: habitData.category || 'estudio',
            icon: habitData.icon || 'fa-check',
            goal: habitData.goal || '',
            createdAt: new Date().toISOString(),
            completions: [],
            streak: 0,
            longestStreak: 0
        };

        state.habits.push(habit);
        StorageManager.save(CONFIG.storage.keys.habits, state.habits);
        ActivityLogger.log('habit', `Hábito creado: ${habit.name}`);
        showNotification('Hábito creado exitosamente', 'success');
        return habit;
    }

    static update(id, updates) {
        const habitIndex = state.habits.findIndex(h => h.id === id);
        if (habitIndex === -1) return false;

        state.habits[habitIndex] = {
            ...state.habits[habitIndex],
            ...updates
        };

        StorageManager.save(CONFIG.storage.keys.habits, state.habits);
        return state.habits[habitIndex];
    }

    static delete(id) {
        const habit = state.habits.find(h => h.id === id);
        if (!habit) return false;

        state.habits = state.habits.filter(h => h.id !== id);
        StorageManager.save(CONFIG.storage.keys.habits, state.habits);
        ActivityLogger.log('habit', `Hábito eliminado: ${habit.name}`);
        showNotification('Hábito eliminado', 'info');
        return true;
    }

    static toggle(id) {
        const habit = state.habits.find(h => h.id === id);
        if (!habit) return false;

        const today = dayjs().format('YYYY-MM-DD');
        const completionIndex = habit.completions.indexOf(today);

        if (completionIndex > -1) {
            habit.completions.splice(completionIndex, 1);
            showNotification('Hábito marcado como no completado', 'info');
        } else {
            habit.completions.push(today);
            ActivityLogger.log('habit', `Hábito completado: ${habit.name}`);
            showNotification('¡Hábito completado! 🎉', 'success');
        }

        this.updateStreak(habit);
        StorageManager.save(CONFIG.storage.keys.habits, state.habits);
        return habit;
    }

    static updateStreak(habit) {
        if (!habit.completions.length) {
            habit.streak = 0;
            return;
        }

        habit.completions.sort().reverse();
        let streak = 0;
        let checkDate = dayjs();

        for (const completion of habit.completions) {
            const completionDate = dayjs(completion);
            if (completionDate.isSame(checkDate, 'day') ||
                completionDate.isSame(checkDate.subtract(1, 'day'), 'day')) {
                streak++;
                checkDate = completionDate;
            } else {
                break;
            }
        }

        habit.streak = streak;
        habit.longestStreak = Math.max(habit.longestStreak, streak);
    }

    static isCompletedToday(id) {
        const habit = state.habits.find(h => h.id === id);
        if (!habit) return false;

        const today = dayjs().format('YYYY-MM-DD');
        return habit.completions.includes(today);
    }

    static getStats() {
        const today = dayjs().format('YYYY-MM-DD');
        const completedToday = state.habits.filter(h =>
            h.completions.includes(today)
        ).length;

        return {
            total: state.habits.length,
            completedToday,
            pendingToday: state.habits.length - completedToday,
            longestStreak: Math.max(...state.habits.map(h => h.longestStreak), 0),
            currentStreak: Math.max(...state.habits.map(h => h.streak), 0)
        };
    }
}

// ========== NOTE MANAGER ==========
class NoteManager {
    static create(noteData) {
        const note = {
            id: Date.now().toString(),
            title: noteData.title,
            content: noteData.content,
            category: noteData.category || 'general',
            color: noteData.color || '#FEF3C7',
            tags: noteData.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        state.notes.unshift(note);
        StorageManager.save(CONFIG.storage.keys.notes, state.notes);
        ActivityLogger.log('note', `Nota creada: ${note.title}`);
        showNotification('Nota creada exitosamente', 'success');
        return note;
    }

    static update(id, updates) {
        const noteIndex = state.notes.findIndex(n => n.id === id);
        if (noteIndex === -1) return false;

        state.notes[noteIndex] = {
            ...state.notes[noteIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        StorageManager.save(CONFIG.storage.keys.notes, state.notes);
        showNotification('Nota actualizada', 'success');
        return state.notes[noteIndex];
    }

    static delete(id) {
        const note = state.notes.find(n => n.id === id);
        if (!note) return false;

        state.notes = state.notes.filter(n => n.id !== id);
        StorageManager.save(CONFIG.storage.keys.notes, state.notes);
        ActivityLogger.log('note', `Nota eliminada: ${note.title}`);
        showNotification('Nota eliminada', 'info');
        return true;
    }

    static getById(id) {
        return state.notes.find(n => n.id === id);
    }

    static getByCategory(category) {
        return state.notes.filter(n => n.category === category);
    }

    static getAll() {
        return state.notes;
    }

    static search(query) {
        const lowerQuery = query.toLowerCase();
        return state.notes.filter(note =>
            note.title.toLowerCase().includes(lowerQuery) ||
            note.content.toLowerCase().includes(lowerQuery)
        );
    }
}

// ========== SESSION MANAGER ==========
class SessionManager {
    static create(sessionData) {
        const session = {
            id: Date.now().toString(),
            task: sessionData.task || 'Sesión de estudio',
            duration: sessionData.duration || 25,
            type: sessionData.type || 'focus',
            completedAt: new Date().toISOString(),
            date: dayjs().format('YYYY-MM-DD')
        };

        state.sessions.unshift(session);
        StorageManager.save(CONFIG.storage.keys.sessions, state.sessions);
        ActivityLogger.log('session', `Sesión completada: ${session.duration} minutos`);
        return session;
    }

    static getToday() {
        const today = dayjs().format('YYYY-MM-DD');
        return state.sessions.filter(s => s.date === today);
    }

    static getTodayMinutes() {
        return this.getToday()
            .filter(s => s.type === 'focus')
            .reduce((total, s) => total + s.duration, 0);
    }

    static getWeekly() {
        const weekStart = dayjs().startOf('week');
        return state.sessions.filter(s =>
            dayjs(s.date).isAfter(weekStart) || dayjs(s.date).isSame(weekStart, 'day')
        );
    }

    static getStats() {
        const today = this.getToday();
        const todayMinutes = this.getTodayMinutes();

        return {
            todaySessions: today.length,
            todayMinutes,
            totalSessions: state.sessions.length,
            totalMinutes: state.sessions
                .filter(s => s.type === 'focus')
                .reduce((total, s) => total + s.duration, 0)
        };
    }

    static getWeeklyData() {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const data = new Array(7).fill(0);

        state.sessions.forEach(session => {
            const dayIndex = dayjs(session.date).day();
            const daysAgo = dayjs().diff(dayjs(session.date), 'day');
            if (daysAgo < 7 && session.type === 'focus') {
                data[dayIndex] += session.duration;
            }
        });

        return {
            labels: days,
            data
        };
    }
}

// ========== ACTIVITY LOGGER ==========
class ActivityLogger {
    static log(type, message) {
        const activity = {
            id: Date.now().toString(),
            type,
            message,
            timestamp: new Date().toISOString()
        };

        let activities = StorageManager.load('activities') || [];
        activities.unshift(activity);
        activities = activities.slice(0, 50);
        StorageManager.save('activities', activities);
    }

    static getRecent(limit = 10) {
        const activities = StorageManager.load('activities') || [];
        return activities.slice(0, limit);
    }
}

// ========== TIMER CONTROLLER ==========
class TimerController {
    static start() {
        if (state.timer.isRunning) return;

        state.timer.isRunning = true;
        state.timer.currentTask = document.getElementById('sessionTask').value || 'Sesión de estudio';

        document.getElementById('timerStart').classList.add('hidden');
        document.getElementById('timerPause').classList.remove('hidden');
        document.getElementById('timerLabel').textContent =
            state.timer.mode === 'focus' ? 'Enfocado...' : 'Descansando...';

        state.timer.interval = setInterval(() => {
            if (state.timer.remaining > 0) {
                state.timer.remaining--;
                this.updateDisplay();
            } else {
                this.complete();
            }
        }, 1000);

        showNotification('Timer iniciado', 'info');
    }

    static pause() {
        if (!state.timer.isRunning) return;

        state.timer.isRunning = false;
        clearInterval(state.timer.interval);

        document.getElementById('timerStart').classList.remove('hidden');
        document.getElementById('timerPause').classList.add('hidden');
        document.getElementById('timerLabel').textContent = 'Pausado';

        showNotification('Timer pausado', 'info');
    }

    static reset() {
        this.pause();

        const durations = {
            focus: state.settings.focus * 60,
            short: state.settings.shortBreak * 60,
            long: state.settings.longBreak * 60
        };

        state.timer.remaining = durations[state.timer.mode];
        state.timer.duration = durations[state.timer.mode];
        this.updateDisplay();
        document.getElementById('timerLabel').textContent = 'Listo para comenzar';
    }

    static skip() {
        this.pause();
        this.nextMode();
        this.reset();
        showNotification('Sesión saltada', 'info');
    }

    static complete() {
        this.pause();

        if (state.timer.mode === 'focus') {
            SessionManager.create({
                task: state.timer.currentTask,
                duration: state.timer.duration / 60,
                type: 'focus'
            });

            state.timer.pomodoroCount++;
            this.updatePomodoroCircles();

            showNotification('¡Sesión completada! 🎉 Tiempo de descanso', 'success');

            if (state.settings.sound) {
                this.playSound();
            }
        } else {
            showNotification('Descanso completado. ¡A trabajar!', 'success');
        }

        this.nextMode();
        this.reset();

        if (state.settings.autoStart) {
            setTimeout(() => this.start(), 2000);
        }

        renderAllUI();
    }

    static nextMode() {
        if (state.timer.mode === 'focus') {
            state.timer.mode = state.timer.pomodoroCount % 4 === 0 ? 'long' : 'short';
        } else {
            state.timer.mode = 'focus';
        }

        document.querySelectorAll('.timer-mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === state.timer.mode) {
                btn.classList.add('active');
            }
        });
    }

    static switchMode(mode, duration) {
        if (state.timer.isRunning) {
            this.pause();
        }

        state.timer.mode = mode;
        state.timer.duration = duration * 60;
        state.timer.remaining = duration * 60;

        document.querySelectorAll('.timer-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this.updateDisplay();
        document.getElementById('timerLabel').textContent = 'Listo para comenzar';
    }

    static updateDisplay() {
        const minutes = Math.floor(state.timer.remaining / 60);
        const seconds = state.timer.remaining % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('timerTime').textContent = display;

        const progress = 1 - (state.timer.remaining / state.timer.duration);
        const circumference = 2 * Math.PI * 140;
        const offset = circumference * (1 - progress);
        document.getElementById('timerCircle').style.strokeDashoffset = offset;

        if (state.timer.isRunning) {
            document.title = `${display} - Study Tracker Pro`;
        } else {
            document.title = 'Study Tracker Pro';
        }
    }

    static updatePomodoroCircles() {
        const circles = document.querySelectorAll('.pomo-circle');
        circles.forEach((circle, index) => {
            if (index < state.timer.pomodoroCount % 4) {
                circle.classList.add('completed');
            } else {
                circle.classList.remove('completed');
            }
        });

        document.getElementById('pomodoroCount').textContent =
            `${state.timer.pomodoroCount % 4}/4`;
    }

    static playSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Audio not supported');
        }
    }
}

// ========== UI RENDERER ==========
class UIRenderer {
    static renderDashboard() {
        this.renderDashboardStats();
        this.renderActivityTimeline();
        this.renderDashboardTasks();
    }

    static renderDashboardStats() {
        const sessionStats = SessionManager.getStats();
        const taskStats = TaskManager.getStats();

        document.getElementById('todayMinutes').textContent = sessionStats.todayMinutes;
        document.getElementById('todaySessions').textContent = sessionStats.todaySessions;
        document.getElementById('tasksCompleted').textContent = taskStats.completedToday;
    }

    static renderActivityTimeline() {
        const container = document.getElementById('activityTimeline');
        const activities = ActivityLogger.getRecent(10);

        if (!activities.length) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>No hay actividad reciente</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => {
            const icon = {
                session: 'fa-clock',
                task: 'fa-check',
                habit: 'fa-leaf',
                note: 'fa-sticky-note'
            }[activity.type] || 'fa-info';

            return `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-text">${activity.message}</p>
                        <p class="activity-time">${dayjs(activity.timestamp).fromNow()}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    static renderDashboardTasks() {
        const container = document.getElementById('dashboardTasks');
        const pendingTasks = state.tasks
            .filter(t => t.status !== 'done')
            .sort((a, b) => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            })
            .slice(0, 5);

        if (!pendingTasks.length) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <i class="fas fa-clipboard-check text-3xl mb-2"></i>
                    <p>No hay tareas pendientes</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pendingTasks.map(task => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer" 
                 onclick="switchTab('kanban')">
                <div class="flex items-center space-x-3 flex-1">
                    <div class="w-2 h-2 rounded-full bg-${this.getPriorityColor(task.priority)}-500"></div>
                    <span class="text-sm font-medium text-gray-700 truncate">${task.title}</span>
                </div>
                <span class="priority-badge priority-${task.priority}">${this.getPriorityLabel(task.priority)}</span>
            </div>
        `).join('');
    }

    static renderSessionHistory() {
        const container = document.getElementById('sessionHistory');
        const todaySessions = SessionManager.getToday().filter(s => s.type === 'focus');

        const totalMinutes = SessionManager.getTodayMinutes();
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        document.getElementById('todayTotal').textContent = `${hours}h ${minutes}m`;

        if (!todaySessions.length) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-clipboard-list text-3xl mb-2"></i>
                    <p class="text-sm">No hay sesiones hoy</p>
                </div>
            `;
            return;
        }

        container.innerHTML = todaySessions.map(session => `
            <div class="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg">
                <p class="font-semibold text-gray-800 text-sm mb-1 truncate">${session.task}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-indigo-600 font-medium">
                        <i class="fas fa-clock mr-1"></i>${session.duration} min
                    </span>
                    <span class="text-xs text-gray-500">
                        ${dayjs(session.completedAt).format('HH:mm')}
                    </span>
                </div>
            </div>
        `).join('');
    }

    static renderKanban() {
        const statuses = ['backlog', 'todo', 'inprogress', 'done'];

        statuses.forEach(status => {
            const container = document.getElementById(status);
            const tasks = TaskManager.getByStatus(status);

            document.getElementById(`${status}Count`).textContent = tasks.length;

            container.innerHTML = '';

            if (!tasks.length) {
                container.innerHTML = this.getEmptyState(status);
                return;
            }

            tasks.forEach(task => {
                container.appendChild(this.createKanbanCard(task));
            });
        });
    }

    static createKanbanCard(task) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.id = task.id;

        const dueDate = task.dueDate ? dayjs(task.dueDate) : null;
        const isOverdue = dueDate && dueDate.isBefore(dayjs(), 'day');

        card.innerHTML = `
            <div class="kanban-card-header">
                <h4 class="kanban-card-title">${task.title}</h4>
                <div class="kanban-card-menu">
                    <button class="kanban-card-menu-btn" onclick="editTask('${task.id}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
            ${task.description ? `<p class="kanban-card-description">${task.description}</p>` : ''}
            <div class="kanban-card-footer">
                <div class="kanban-card-tags">
                    <span class="priority-badge priority-${task.priority}">
                        ${this.getPriorityLabel(task.priority)}
                    </span>
                    ${task.tags.slice(0, 2).map(tag =>
            `<span class="kanban-card-tag">${tag}</span>`
        ).join('')}
                </div>
                ${dueDate ? `
                    <div class="kanban-card-due ${isOverdue ? 'overdue' : ''}">
                        <i class="fas fa-calendar"></i>
                        <span>${dueDate.format('DD/MM')}</span>
                    </div>
                ` : ''}
            </div>
        `;

        return card;
    }

    static getEmptyState(status) {
        const states = {
            backlog: '<i class="fas fa-inbox text-3xl mb-2 opacity-30"></i><p>Sin tareas en backlog</p>',
            todo: '<i class="fas fa-list text-3xl mb-2 opacity-30"></i><p>Sin tareas pendientes</p>',
            inprogress: '<i class="fas fa-spinner text-3xl mb-2 opacity-30"></i><p>Sin tareas en progreso</p>',
            done: '<i class="fas fa-check text-3xl mb-2 opacity-30"></i><p>Sin tareas completadas</p>'
        };

        return `<div class="empty-state">${states[status]}</div>`;
    }

    static renderHabits() {
        const container = document.getElementById('habitsList');

        if (!state.habits.length) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-12">
                    <i class="fas fa-seedling text-5xl mb-3"></i>
                    <p class="text-lg mb-2">No tienes hábitos creados</p>
                    <p class="text-sm">Crea tu primer hábito para comenzar a construir tu rutina</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.habits.map(habit => {
            const isCompleted = HabitManager.isCompletedToday(habit.id);

            return `
                <div class="habit-card ${isCompleted ? 'completed' : ''}" onclick="toggleHabit('${habit.id}')">
                    <div class="habit-checkbox">
                        ${isCompleted ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="habit-icon">
                        <i class="fas ${habit.icon}"></i>
                    </div>
                    <div class="habit-info">
                        <div class="habit-name">${habit.name}</div>
                        <div class="habit-description">${habit.goal || habit.category}</div>
                    </div>
                    <div class="habit-streak">
                        <div class="habit-streak-number">${habit.streak}</div>
                        <div class="habit-streak-label">días</div>
                    </div>
                    <button class="kanban-card-menu-btn ml-2" onclick="event.stopPropagation(); deleteHabit('${habit.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');

        this.updateHabitStats();
    }

    static updateHabitStats() {
        const stats = HabitManager.getStats();

        document.getElementById('currentStreak').textContent = stats.currentStreak;
        document.getElementById('longestStreak').textContent = stats.longestStreak;
        document.getElementById('habitProgress').textContent = `${stats.completedToday}/${stats.total}`;

        const percentage = stats.total > 0 ? (stats.completedToday / stats.total) * 100 : 0;
        document.getElementById('habitProgressBar').style.width = `${percentage}%`;
    }

    static renderNotes() {
        const container = document.getElementById('notesGrid');
        const filter = document.getElementById('notesFilter').value;

        let filteredNotes = filter === 'all' ?
            state.notes :
            NoteManager.getByCategory(filter);

        if (!filteredNotes.length) {
            container.innerHTML = `
                <div class="col-span-full text-center text-gray-400 py-12">
                    <i class="fas fa-book-open text-5xl mb-3"></i>
                    <p class="text-lg mb-2">No tienes notas guardadas</p>
                    <p class="text-sm">Crea tu primera nota para comenzar</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredNotes.map(note => `
            <div class="note-card" style="background-color: ${note.color}" onclick="editNote('${note.id}')">
                <div class="note-card-header">
                    <h3 class="note-card-title">${note.title}</h3>
                    <button class="note-card-menu-btn" onclick="event.stopPropagation(); deleteNote('${note.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="note-card-content line-clamp-3">${note.content}</div>
                <div class="note-card-footer">
                    <span class="note-card-category">${note.category}</span>
                    <span class="note-card-date">${dayjs(note.updatedAt).fromNow()}</span>
                </div>
            </div>
        `).join('');
    }

    static renderAnalytics() {
        this.renderAnalyticsStats();
        this.renderWeeklyChart();
        this.renderCategoryChart();
    }

    static renderAnalyticsStats() {
        const sessionStats = SessionManager.getStats();
        const habitStats = HabitManager.getStats();

        const hours = Math.floor(sessionStats.totalMinutes / 60);
        document.getElementById('totalStudyTime').textContent = `${hours}h`;
        document.getElementById('totalSessions').textContent = sessionStats.totalSessions;
        document.getElementById('activeHabits').textContent = habitStats.total;

        const productivity = habitStats.total > 0 ?
            Math.round((habitStats.completedToday / habitStats.total) * 100) : 0;
        document.getElementById('productivityScore').textContent = `${productivity}%`;
    }

    static renderWeeklyChart() {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;

        const weeklyData = SessionManager.getWeeklyData();

        if (window.weeklyChartInstance) {
            window.weeklyChartInstance.destroy();
        }

        window.weeklyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    label: 'Minutos de estudio',
                    data: weeklyData.data,
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return value + ' min';
                            }
                        }
                    }
                }
            }
        });
    }

    static renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        const categories = {};
        state.tasks.forEach(task => {
            categories[task.category] = (categories[task.category] || 0) + 1;
        });

        const labels = Object.keys(categories);
        const data = Object.values(categories);

        if (window.categoryChartInstance) {
            window.categoryChartInstance.destroy();
        }

        window.categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#4F46E5',
                        '#7C3AED',
                        '#10B981',
                        '#F59E0B',
                        '#EF4444',
                        '#3B82F6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    static getPriorityColor(priority) {
        return {
            low: 'blue',
            medium: 'yellow',
            high: 'orange',
            urgent: 'red'
        }[priority] || 'gray';
    }

    static getPriorityLabel(priority) {
        return {
            low: 'Baja',
            medium: 'Media',
            high: 'Alta',
            urgent: 'Urgente'
        }[priority] || 'Media';
    }
}

// ========== GLOBAL FUNCTIONS ==========
function switchTab(tabName) {
    state.currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== tabName);
        content.classList.toggle('active', content.id === tabName);
    });

    renderTabContent(tabName);
}

function renderTabContent(tabName) {
    switch (tabName) {
        case 'dashboard':
            UIRenderer.renderDashboard();
            break;
        case 'pomodoro':
            UIRenderer.renderSessionHistory();
            break;
        case 'kanban':
            UIRenderer.renderKanban();
            break;
        case 'habits':
            UIRenderer.renderHabits();
            break;
        case 'notes':
            UIRenderer.renderNotes();
            break;
        case 'analytics':
            UIRenderer.renderAnalytics();
            break;
    }
}

function renderAllUI() {
    renderTabContent(state.currentTab);
    updateHeaderStats();
}

function updateHeaderStats() {
    const habitStats = HabitManager.getStats();
    document.getElementById('headerStreak').textContent = habitStats.currentStreak;
}

function showNotification(message, type = 'info') {
    const backgrounds = {
        success: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        error: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        warning: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        info: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
    };

    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: backgrounds[type] || backgrounds.info,
            borderRadius: '0.75rem',
            fontWeight: '600'
        }
    }).showToast();
}

// ========== MODAL FUNCTIONS ==========
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';

        const form = modal.querySelector('form');
        if (form) form.reset();

        const idField = modal.querySelector('input[type="hidden"]');
        if (idField) idField.value = '';
    }
}

// ========== TASK FUNCTIONS ==========
function openTaskModal(taskId = null) {
    if (taskId) {
        const task = TaskManager.getById(taskId);
        if (!task) return;

        document.getElementById('taskModalTitle').textContent = 'Editar Tarea';
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskDueDate').value = task.dueDate || '';
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskTags').value = task.tags.join(', ');
    } else {
        document.getElementById('taskModalTitle').textContent = 'Nueva Tarea';
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
    }

    openModal('taskModal');
}

function editTask(taskId) {
    openTaskModal(taskId);
}

function deleteTask(taskId) {
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
        TaskManager.delete(taskId);
        renderAllUI();
    }
}

// ========== HABIT FUNCTIONS ==========
function openHabitModal(habitId = null) {
    if (habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        if (!habit) return;

        document.getElementById('habitModalTitle').textContent = 'Editar Hábito';
        document.getElementById('habitId').value = habit.id;
        document.getElementById('habitName').value = habit.name;
        document.getElementById('habitDescription').value = habit.description;
        document.getElementById('habitCategory').value = habit.category;
        document.getElementById('habitIcon').value = habit.icon;
        document.getElementById('habitGoal').value = habit.goal;
    } else {
        document.getElementById('habitModalTitle').textContent = 'Nuevo Hábito';
        document.getElementById('habitForm').reset();
        document.getElementById('habitId').value = '';
    }

    openModal('habitModal');
}

function toggleHabit(habitId) {
    HabitManager.toggle(habitId);
    renderAllUI();
}

function deleteHabit(habitId) {
    if (confirm('¿Estás seguro de eliminar este hábito?')) {
        HabitManager.delete(habitId);
        renderAllUI();
    }
}

// ========== NOTE FUNCTIONS ==========
function openNoteModal(noteId = null) {
    if (noteId) {
        const note = NoteManager.getById(noteId);
        if (!note) return;

        document.getElementById('noteModalTitle').textContent = 'Editar Nota';
        document.getElementById('noteId').value = note.id;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').value = note.content;
        document.getElementById('noteCategory').value = note.category;
        document.getElementById('noteColor').value = note.color;
        document.getElementById('noteTags').value = note.tags.join(', ');
    } else {
        document.getElementById('noteModalTitle').textContent = 'Nueva Nota';
        document.getElementById('noteForm').reset();
        document.getElementById('noteId').value = '';
    }

    openModal('noteModal');
}

function editNote(noteId) {
    openNoteModal(noteId);
}

function deleteNote(noteId) {
    if (confirm('¿Estás seguro de eliminar esta nota?')) {
        NoteManager.delete(noteId);
        renderAllUI();
    }
}

// ========== DRAG AND DROP ==========
function initializeDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-cards');

    columns.forEach(column => {
        new Sortable(column, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'dragging',
            dragClass: 'dragging',
            onEnd: function (evt) {
                const taskId = evt.item.dataset.id;
                const newStatus = evt.to.dataset.status;

                if (taskId && newStatus) {
                    TaskManager.updateStatus(taskId, newStatus);
                    renderAllUI();
                }
            }
        });
    });
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    dayjs.locale('es');
    dayjs.extend(window.dayjs_plugin_relativeTime);
    dayjs.extend(window.dayjs_plugin_calendar);

    updateDateTime();
    setInterval(updateDateTime, 60000);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('timerStart').addEventListener('click', () => TimerController.start());
    document.getElementById('timerPause').addEventListener('click', () => TimerController.pause());
    document.getElementById('timerReset').addEventListener('click', () => TimerController.reset());
    document.getElementById('timerSkip').addEventListener('click', () => TimerController.skip());

    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            const duration = parseInt(btn.dataset.duration);
            TimerController.switchMode(mode, duration);
        });
    });

    ['focusDuration', 'shortBreakDuration', 'longBreakDuration'].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('change', () => {
            const setting = id.replace('Duration', '');
            const mappedSetting = setting === 'focus' ? 'focus' : setting === 'shortBreak' ? 'shortBreak' : 'longBreak';
            state.settings[mappedSetting] = parseInt(input.value);
            StorageManager.save(CONFIG.storage.keys.settings, state.settings);

            if ((mappedSetting === 'focus' && state.timer.mode === 'focus') ||
                (mappedSetting === 'shortBreak' && state.timer.mode === 'short') ||
                (mappedSetting === 'longBreak' && state.timer.mode === 'long')) {
                TimerController.reset();
            }
        });
    });

    document.getElementById('autoStartBreak').addEventListener('change', (e) => {
        state.settings.autoStart = e.target.checked;
        StorageManager.save(CONFIG.storage.keys.settings, state.settings);
    });

    document.getElementById('soundEnabled').addEventListener('change', (e) => {
        state.settings.sound = e.target.checked;
        StorageManager.save(CONFIG.storage.keys.settings, state.settings);
    });

    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            switch (action) {
                case 'pomodoro':
                    switchTab('pomodoro');
                    break;
                case 'task':
                    openTaskModal();
                    break;
                case 'note':
                    openNoteModal();
                    break;
                case 'habit':
                    openHabitModal();
                    break;
            }
        });
    });

    document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('addHabitBtn').addEventListener('click', () => openHabitModal());
    document.getElementById('addNoteBtn').addEventListener('click', () => openNoteModal());

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal || btn.closest('.modal').id;
            closeModal(modalId);
        });
    });

    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.modal);
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            closeModal(overlay.closest('.modal').id);
        });
    });

    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const taskId = document.getElementById('taskId').value;
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            category: document.getElementById('taskCategory').value,
            dueDate: document.getElementById('taskDueDate').value || null,
            tags: document.getElementById('taskTags').value
                .split(',')
                .map(t => t.trim())
                .filter(t => t)
        };

        if (taskId) {
            TaskManager.update(taskId, taskData);
        } else {
            TaskManager.create(taskData);
        }

        closeModal('taskModal');
        renderAllUI();
    });

    document.getElementById('habitForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const habitId = document.getElementById('habitId').value;
        const habitData = {
            name: document.getElementById('habitName').value,
            description: document.getElementById('habitDescription').value,
            category: document.getElementById('habitCategory').value,
            icon: document.getElementById('habitIcon').value,
            goal: document.getElementById('habitGoal').value
        };

        if (habitId) {
            HabitManager.update(habitId, habitData);
        } else {
            HabitManager.create(habitData);
        }

        closeModal('habitModal');
        renderAllUI();
    });

    document.getElementById('noteForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const noteId = document.getElementById('noteId').value;
        const noteData = {
            title: document.getElementById('noteTitle').value,
            content: document.getElementById('noteContent').value,
            category: document.getElementById('noteCategory').value,
            color: document.getElementById('noteColor').value,
            tags: document.getElementById('noteTags').value
                .split(',')
                .map(t => t.trim())
                .filter(t => t)
        };

        if (noteId) {
            NoteManager.update(noteId, noteData);
        } else {
            NoteManager.create(noteData);
        }

        closeModal('noteModal');
        renderAllUI();
    });

    document.getElementById('notesFilter').addEventListener('change', () => {
        UIRenderer.renderNotes();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsUserName').value = state.settings.userName;
        openModal('settingsModal');
    });

    document.getElementById('settingsUserName').addEventListener('change', (e) => {
        state.settings.userName = e.target.value;
        document.getElementById('userName').textContent = e.target.value;
        document.getElementById('userAvatar').textContent = e.target.value.charAt(0).toUpperCase();
        StorageManager.save(CONFIG.storage.keys.settings, state.settings);
    });

    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('exportBtn').addEventListener('click', exportData);

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (StorageManager.importData(event.target.result)) {
                showNotification('Datos importados exitosamente', 'success');
                location.reload();
            } else {
                showNotification('Error al importar datos', 'error');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('clearDataBtn').addEventListener('click', () => {
        if (confirm('¿Estás seguro? Esto eliminará TODOS tus datos de forma permanente.')) {
            if (confirm('¿REALMENTE seguro? Esta acción no se puede deshacer.')) {
                StorageManager.clear();
                showNotification('Datos eliminados', 'info');
                setTimeout(() => location.reload(), 1000);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openTaskModal();
        }

        if (e.code === 'Space' && state.currentTab === 'pomodoro' &&
            !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            e.preventDefault();
            if (state.timer.isRunning) {
                TimerController.pause();
            } else {
                TimerController.start();
            }
        }
    });
}

function updateDateTime() {
    const now = dayjs();
    document.getElementById('currentDateTime').textContent = now.format('HH:mm');

    const userName = state.settings.userName || 'Usuario';
    document.getElementById('userName').textContent = userName;
    document.getElementById('userAvatar').textContent = userName.charAt(0).toUpperCase();
}

function exportData() {
    const data = StorageManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studytracker_backup_${dayjs().format('YYYY-MM-DD')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Datos exportados exitosamente', 'success');
}

// ========== INITIALIZATION ==========
function initializeApp() {
    console.log('🚀 Initializing Study Tracker Pro...');

    StorageManager.loadAll();
    setupEventListeners();
    TimerController.updateDisplay();
    TimerController.updatePomodoroCircles();

    setTimeout(() => initializeDragAndDrop(), 100);

    renderAllUI();

    console.log('✅ Study Tracker Pro initialized successfully!');
    showNotification('¡Bienvenido a Study Tracker Pro!', 'success');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

setInterval(() => {
    StorageManager.saveAll();
}, 30000);

window.addEventListener('beforeunload', () => {
    StorageManager.saveAll();
});