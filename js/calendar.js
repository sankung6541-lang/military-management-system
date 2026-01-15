/**
 * Calendar Module - ปฏิทินกิจกรรม
 * แสดงการลา, ฝึกอบรม, เวรยามในรูปแบบปฏิทิน
 */

const calendar = {
    currentDate: new Date(),
    selectedDate: null,

    /**
     * Initialize calendar
     */
    init() {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.render();
    },

    /**
     * Go to previous month
     */
    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    },

    /**
     * Go to next month
     */
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    },

    /**
     * Go to today
     */
    goToday() {
        this.currentDate = new Date();
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.render();
    },

    /**
     * Render calendar
     */
    render() {
        this.renderMonth();
        this.renderGrid();
        this.renderEvents();
    },

    /**
     * Render month header
     */
    renderMonth() {
        const monthEl = document.getElementById('calendar-month');
        if (!monthEl) return;

        const options = { year: 'numeric', month: 'long' };
        monthEl.textContent = this.currentDate.toLocaleDateString('th-TH', options);
    },

    /**
     * Render calendar grid
     */
    renderGrid() {
        const gridEl = document.getElementById('calendar-grid');
        if (!gridEl) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        // Get events for this month
        const events = this.getMonthEvents(year, month);

        let html = '';

        // Empty cells before first day
        for (let i = 0; i < startDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Days of month
        const today = new Date().toISOString().split('T')[0];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            const isToday = dateStr === today;
            const isSelected = dateStr === this.selectedDate;

            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (dayEvents.length > 0) classes += ' has-events';

            html += `
                <div class="${classes}" onclick="calendar.selectDate('${dateStr}')">
                    <span class="day-number">${day}</span>
                    <div class="day-events">
                        ${dayEvents.slice(0, 3).map(e => `<span class="event-dot" style="background: ${e.color};"></span>`).join('')}
                    </div>
                </div>
            `;
        }

        gridEl.innerHTML = html;
    },

    /**
     * Get events for month
     */
    getMonthEvents(year, month) {
        const events = [];

        // Get leaves
        const leaves = storage.getAll(storage.KEYS.LEAVE);
        leaves.forEach(l => {
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getFullYear() === year && d.getMonth() === month) {
                    events.push({
                        date: d.toISOString().split('T')[0],
                        type: 'leave',
                        color: '#ef4444',
                        data: l
                    });
                }
            }
        });

        // Get training
        const training = storage.getAll(storage.KEYS.TRAINING);
        training.forEach(t => {
            const start = new Date(t.startDate);
            const end = new Date(t.endDate);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getFullYear() === year && d.getMonth() === month) {
                    events.push({
                        date: d.toISOString().split('T')[0],
                        type: 'training',
                        color: '#3b82f6',
                        data: t
                    });
                }
            }
        });

        // Get guard patrol
        const patrols = storage.getAll(storage.KEYS.GUARD_PATROL);
        patrols.forEach(p => {
            if (p.date) {
                const d = new Date(p.date);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    events.push({
                        date: p.date,
                        type: 'patrol',
                        color: '#22c55e',
                        data: p
                    });
                }
            }
        });

        return events;
    },

    /**
     * Select a date
     */
    selectDate(dateStr) {
        this.selectedDate = dateStr;
        this.render();
    },

    /**
     * Render events for selected date
     */
    renderEvents() {
        const titleEl = document.getElementById('calendar-selected-date');
        const containerEl = document.getElementById('calendar-events');

        if (!containerEl) return;

        if (titleEl) {
            const date = new Date(this.selectedDate);
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            titleEl.innerHTML = `<i class="ph ph-list-bullets"></i> ${date.toLocaleDateString('th-TH', options)}`;
        }

        const year = new Date(this.selectedDate).getFullYear();
        const month = new Date(this.selectedDate).getMonth();
        const events = this.getMonthEvents(year, month).filter(e => e.date === this.selectedDate);

        if (events.length === 0) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-calendar-blank"></i>
                    <p>ไม่มีกิจกรรมในวันนี้</p>
                </div>
            `;
            return;
        }

        containerEl.innerHTML = events.map(e => {
            let title = '';
            let subtitle = '';
            let icon = '';

            if (e.type === 'leave') {
                const soldier = soldiers.getById(e.data.soldierId);
                const name = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : '-';
                title = `${name} - ${leave.TYPES[e.data.leaveType] || e.data.leaveType}`;
                subtitle = `${e.data.startDate} - ${e.data.endDate}`;
                icon = 'calendar-x';
            } else if (e.type === 'training') {
                title = e.data.trainingName || 'ฝึกอบรม';
                subtitle = e.data.location || '-';
                icon = 'target';
            } else if (e.type === 'patrol') {
                const guard = soldiers.getById(e.data.guardId);
                const name = guard ? `${guard.rank || ''} ${guard.firstName || ''}`.trim() : '-';
                title = `ตรวจป้อม: ${e.data.checkpointName || '-'}`;
                subtitle = `${e.data.time || '-'} - ${name}`;
                icon = 'shield-checkered';
            }

            return `
                <div class="event-item" style="border-left: 4px solid ${e.color};">
                    <div class="event-icon" style="color: ${e.color};">
                        <i class="ph ph-${icon}"></i>
                    </div>
                    <div class="event-content">
                        <div class="event-title">${title}</div>
                        <div class="event-subtitle">${subtitle}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
};
