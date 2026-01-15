/**
 * Reports Module - Report Generation
 */

const reports = {
    init() {
        this.setDefaultDates();
    },

    setDefaultDates() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const startInput = document.getElementById('report-start');
        const endInput = document.getElementById('report-end');

        if (startInput) startInput.value = firstDay.toISOString().split('T')[0];
        if (endInput) endInput.value = lastDay.toISOString().split('T')[0];
    },

    generate() {
        const type = document.getElementById('report-type')?.value;
        const startDate = document.getElementById('report-start')?.value;
        const endDate = document.getElementById('report-end')?.value;

        if (!startDate || !endDate) {
            app.showToast('warning', 'กรุณาเลือกช่วงเวลา', '');
            return;
        }

        const container = document.getElementById('report-content');
        if (!container) return;

        switch (type) {
            case 'attendance':
                this.generateAttendanceReport(container, startDate, endDate);
                break;
            case 'leave':
                this.generateLeaveReport(container, startDate, endDate);
                break;
            case 'training':
                this.generateTrainingReport(container, startDate, endDate);
                break;
            case 'equipment':
                this.generateEquipmentReport(container, startDate, endDate);
                break;
        }
    },

    generateAttendanceReport(container, startDate, endDate) {
        const records = storage.getByDateRange(storage.KEYS.ATTENDANCE, 'date', startDate, endDate);
        const soldiersList = soldiers.getAll().filter(s => s.status === 'active');

        const stats = {};
        soldiersList.forEach(s => stats[s.id] = { present: 0, late: 0, absent: 0 });
        records.forEach(r => {
            if (stats[r.soldierId]) stats[r.soldierId][r.status]++;
        });

        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>รายงานการลงเวลา</h3>
                <p style="color: var(--text-secondary);">${this.formatDate(startDate)} - ${this.formatDate(endDate)}</p>
                <div class="data-table-container" style="display: block; margin-top: 20px;">
                    <table class="data-table" style="display: table;">
                        <thead><tr><th>ยศ-ชื่อ</th><th>มา</th><th>สาย</th><th>ขาด</th></tr></thead>
                        <tbody>
                            ${soldiersList.map(s => `
                                <tr>
                                    <td>${s.rank || ''} ${s.firstName || ''}</td>
                                    <td>${stats[s.id]?.present || 0}</td>
                                    <td>${stats[s.id]?.late || 0}</td>
                                    <td>${stats[s.id]?.absent || 0}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    generateLeaveReport(container, startDate, endDate) {
        const records = storage.getByDateRange(storage.KEYS.LEAVE, 'startDate', startDate, endDate);
        const approved = records.filter(r => r.status === 'approved').length;
        const pending = records.filter(r => r.status === 'pending').length;

        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>รายงานการลา</h3>
                <p style="color: var(--text-secondary);">${this.formatDate(startDate)} - ${this.formatDate(endDate)}</p>
                <div class="stats-grid" style="margin: 20px 0;">
                    <div class="stat-card"><div class="stat-info"><span class="stat-value">${records.length}</span><span class="stat-label">ทั้งหมด</span></div></div>
                    <div class="stat-card"><div class="stat-info"><span class="stat-value">${approved}</span><span class="stat-label">อนุมัติ</span></div></div>
                    <div class="stat-card"><div class="stat-info"><span class="stat-value">${pending}</span><span class="stat-label">รออนุมัติ</span></div></div>
                </div>
            </div>
        `;
    },

    generateTrainingReport(container, startDate, endDate) {
        const records = storage.getByDateRange(storage.KEYS.TRAINING, 'startDate', startDate, endDate);

        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>รายงานการฝึกอบรม</h3>
                <p style="color: var(--text-secondary);">${this.formatDate(startDate)} - ${this.formatDate(endDate)}</p>
                <div class="stat-card" style="margin: 20px 0;"><div class="stat-info"><span class="stat-value">${records.length}</span><span class="stat-label">การฝึกทั้งหมด</span></div></div>
            </div>
        `;
    },

    generateEquipmentReport(container, startDate, endDate) {
        const allEquipment = equipment.getAll();
        const totalItems = allEquipment.reduce((sum, e) => sum + e.quantity, 0);

        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>รายงานอุปกรณ์</h3>
                <div class="stats-grid" style="margin: 20px 0;">
                    <div class="stat-card"><div class="stat-info"><span class="stat-value">${allEquipment.length}</span><span class="stat-label">ประเภท</span></div></div>
                    <div class="stat-card"><div class="stat-info"><span class="stat-value">${totalItems}</span><span class="stat-label">จำนวนรวม</span></div></div>
                </div>
            </div>
        `;
    },

    formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    exportReport() {
        const content = document.getElementById('report-content');
        if (!content) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>รายงาน</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd}</style></head><body>${content.innerHTML}<script>window.print()</script></body></html>`);
        printWindow.document.close();
    }
};
