/**
 * Dashboard Module - Overview and Statistics
 * Displays summary statistics and quick access features
 */

const dashboard = {
    /**
     * Initialize dashboard
     */
    init() {
        this.updateStats();
        this.updatePending();
        this.updateActivities();
        this.updateCharts();
    },

    /**
     * Update main statistics
     */
    updateStats() {
        const stats = storage.getStats();

        // Update stat cards
        document.getElementById('stat-soldiers').textContent = stats.totalSoldiers;
        document.getElementById('stat-present').textContent = stats.presentToday;
        document.getElementById('stat-leave').textContent = stats.onLeaveToday;
        document.getElementById('stat-training').textContent = stats.inTraining;
    },

    /**
     * Update pending items list
     */
    updatePending() {
        const container = document.getElementById('pending-list');
        if (!container) return;

        const pendingLeaves = leave.getByStatus('pending');

        if (pendingLeaves.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-check-circle"></i>
                    <p>ไม่มีรายการรอดำเนินการ</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pendingLeaves.slice(0, 5).map(l => {
            const soldier = soldiers.getById(l.soldierId);
            const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : '-';

            return `
                <div class="list-item" onclick="app.navigateTo('leave'); leave.showApproveModal('${l.id}')">
                    <div class="list-item-icon" style="background: var(--color-warning); color: white;">
                        <i class="ph ph-calendar-check"></i>
                    </div>
                    <div class="list-item-content">
                        <div class="list-item-title">${soldierName}</div>
                        <div class="list-item-subtitle">${leave.TYPES[l.leaveType] || l.leaveType} - ${leave.formatDateRange(l.startDate, l.endDate)}</div>
                    </div>
                    <div class="list-item-action">
                        <i class="ph ph-caret-right"></i>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Update recent activities list
     */
    updateActivities() {
        const container = document.getElementById('activity-list');
        if (!container) return;

        const activities = storage.getRecentActivities(5);

        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-note-blank"></i>
                    <p>ยังไม่มีกิจกรรม</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(a => {
            const icon = this.getActivityIcon(a.action);
            const time = this.formatTime(a.timestamp);

            return `
                <div class="list-item">
                    <div class="list-item-icon" style="background: ${icon.color}; color: white;">
                        <i class="ph ph-${icon.name}"></i>
                    </div>
                    <div class="list-item-content">
                        <div class="list-item-title">${a.summary}</div>
                        <div class="list-item-subtitle">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Get activity icon
     * @param {string} action - Action type
     * @returns {Object} Icon name and color
     */
    getActivityIcon(action) {
        const icons = {
            add: { name: 'plus-circle', color: 'var(--color-success)' },
            update: { name: 'pencil', color: 'var(--color-info)' },
            delete: { name: 'trash', color: 'var(--color-danger)' }
        };
        return icons[action] || { name: 'circle', color: 'var(--color-gray-500)' };
    },

    /**
     * Format timestamp to relative time
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Formatted time
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'เมื่อสักครู่';
        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
        if (days < 7) return `${days} วันที่แล้ว`;

        return date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short'
        });
    },

    /**
     * Refresh dashboard
     */
    refresh() {
        this.updateStats();
        this.updatePending();
        this.updateActivities();
        this.updateCharts();
    },

    // Chart instances
    charts: {},

    /**
     * Initialize and update all charts
     */
    updateCharts() {
        if (typeof Chart === 'undefined') {
            console.log('Chart.js not loaded');
            return;
        }

        this.renderStatusChart();
        this.renderRankChart();
        this.renderAttendanceChart();
        this.renderLeaveChart();
    },

    /**
     * Render personnel status chart (Doughnut)
     */
    renderStatusChart() {
        const ctx = document.getElementById('chart-status');
        if (!ctx) return;

        const allSoldiers = storage.getAll(storage.KEYS.SOLDIERS);
        const statusCounts = {
            active: allSoldiers.filter(s => s.status === 'active').length,
            leave: allSoldiers.filter(s => s.status === 'leave').length,
            training: allSoldiers.filter(s => s.status === 'training').length,
            inactive: allSoldiers.filter(s => s.status === 'inactive').length
        };

        if (this.charts.status) this.charts.status.destroy();

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['ประจำการ', 'ลา', 'ฝึก', 'ไม่ประจำการ'],
                datasets: [{
                    data: [statusCounts.active, statusCounts.leave, statusCounts.training, statusCounts.inactive],
                    backgroundColor: ['#22c55e', '#f59e0b', '#3b82f6', '#94a3b8'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    },

    /**
     * Render rank distribution chart (Bar)
     */
    renderRankChart() {
        const ctx = document.getElementById('chart-rank');
        if (!ctx) return;

        const allSoldiers = storage.getAll(storage.KEYS.SOLDIERS);
        const officerRanks = ['พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.',
            'พลเอก', 'พลโท', 'พลตรี', 'พันเอก', 'พันโท', 'พันตรี', 'ร้อยเอก', 'ร้อยโท', 'ร้อยตรี'];
        const ncoRanks = ['จ.ส.อ.', 'จ.ส.ท.', 'จ.ส.ต.', 'ส.อ.', 'ส.ท.', 'ส.ต.',
            'จ่าสิบเอก', 'จ่าสิบโท', 'จ่าสิบตรี', 'สิบเอก', 'สิบโท', 'สิบตรี'];

        const counts = {
            officers: allSoldiers.filter(s => officerRanks.includes(s.rank)).length,
            nco: allSoldiers.filter(s => ncoRanks.includes(s.rank)).length,
            privates: allSoldiers.filter(s => s.rank === 'พลฯ' || s.rank === 'พลทหาร').length
        };

        if (this.charts.rank) this.charts.rank.destroy();

        this.charts.rank = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['สัญญาบัตร', 'นายประทวน', 'พลทหาร'],
                datasets: [{
                    label: 'จำนวน (นาย)',
                    data: [counts.officers, counts.nco, counts.privates],
                    backgroundColor: ['#2D5016', '#C5A572', '#4ade80']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    },

    /**
     * Render attendance chart (Bar - last 7 days)
     */
    renderAttendanceChart() {
        const ctx = document.getElementById('chart-attendance');
        if (!ctx) return;

        const attendance = storage.getAll(storage.KEYS.ATTENDANCE);
        const last7Days = [];
        const onTime = [];
        const late = [];
        const absent = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayData = attendance.filter(a => a.date === dateStr);
            last7Days.push(date.toLocaleDateString('th-TH', { weekday: 'short' }));
            onTime.push(dayData.filter(a => a.status === 'present').length);
            late.push(dayData.filter(a => a.status === 'late').length);
            absent.push(dayData.filter(a => a.status === 'absent').length);
        }

        if (this.charts.attendance) this.charts.attendance.destroy();

        this.charts.attendance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days,
                datasets: [
                    { label: 'ตรงเวลา', data: onTime, backgroundColor: '#22c55e' },
                    { label: 'สาย', data: late, backgroundColor: '#f59e0b' },
                    { label: 'ขาด', data: absent, backgroundColor: '#ef4444' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    },

    /**
     * Render leave type chart (Pie)
     */
    renderLeaveChart() {
        const ctx = document.getElementById('chart-leave');
        if (!ctx) return;

        const allLeave = storage.getAll(storage.KEYS.LEAVE);
        const typeCounts = {
            sick: allLeave.filter(l => l.leaveType === 'sick').length,
            personal: allLeave.filter(l => l.leaveType === 'personal').length,
            vacation: allLeave.filter(l => l.leaveType === 'vacation').length,
            other: allLeave.filter(l => !['sick', 'personal', 'vacation'].includes(l.leaveType)).length
        };

        if (this.charts.leave) this.charts.leave.destroy();

        this.charts.leave = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['ลาป่วย', 'ลากิจ', 'พักผ่อน', 'อื่นๆ'],
                datasets: [{
                    data: [typeCounts.sick, typeCounts.personal, typeCounts.vacation, typeCounts.other],
                    backgroundColor: ['#ef4444', '#f59e0b', '#22c55e', '#94a3b8'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
};
