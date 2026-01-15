/**
 * Leave Module - Leave Management
 * Handles leave requests and approvals
 */

const leave = {
    // Leave types
    TYPES: {
        sick: 'ลาป่วย',
        personal: 'ลากิจ',
        vacation: 'ลาพักผ่อน',
        maternity: 'ลาคลอด',
        military: 'ลาราชการ',
        other: 'อื่นๆ'
    },

    // Leave status
    STATUS: {
        pending: 'รออนุมัติ',
        approved: 'อนุมัติ',
        rejected: 'ไม่อนุมัติ',
        cancelled: 'ยกเลิก'
    },

    currentTab: 'pending',

    /**
     * Initialize leave module
     */
    init() {
        this.bindEvents();
        this.updatePendingCount();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab switching
        document.querySelectorAll('#page-leave .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    },

    /**
     * Switch tab
     * @param {string} tab - Tab name
     */
    switchTab(tab) {
        this.currentTab = tab;

        document.querySelectorAll('#page-leave .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        this.render();
    },

    /**
     * Update pending count badge
     */
    updatePendingCount() {
        const count = this.getByStatus('pending').length;
        const badge = document.getElementById('leave-pending-count');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    },

    /**
     * Get all leave records
     * @returns {Array} Leave records
     */
    getAll() {
        return storage.getAll(storage.KEYS.LEAVE);
    },

    /**
     * Get leave by ID
     * @param {string} id - Leave ID
     * @returns {Object|null} Leave record
     */
    getById(id) {
        return storage.getById(storage.KEYS.LEAVE, id);
    },

    /**
     * Get leave by status
     * @param {string} status - Status filter
     * @returns {Array} Filtered records
     */
    getByStatus(status) {
        if (status === 'all') {
            return this.getAll();
        }
        return this.getAll().filter(l => l.status === status);
    },

    /**
     * Get active leaves for today
     * @returns {Array} Active leaves
     */
    getActiveToday() {
        const today = new Date().toISOString().split('T')[0];
        return this.getAll().filter(l =>
            l.status === 'approved' &&
            l.startDate <= today &&
            l.endDate >= today
        );
    },

    /**
     * Add new leave request
     * @param {Object} data - Leave data
     * @returns {Object} Added leave
     */
    add(data) {
        const record = {
            leaveId: this.generateId(),
            soldierId: data.soldierId,
            leaveType: data.leaveType,
            startDate: data.startDate,
            endDate: data.endDate,
            reason: data.reason || '',
            contact: data.contact || '',
            status: 'pending',
            approvedBy: null,
            approvedDate: null,
            rejectReason: null
        };

        const added = storage.add(storage.KEYS.LEAVE, record);
        api.uploadItem('leave', added);
        this.updatePendingCount();
        return added;
    },

    /**
     * Approve leave
     * @param {string} id - Leave ID
     * @param {string} approver - Approver name
     */
    approve(id, approver = 'ผู้อนุมัติ') {
        const updated = storage.update(storage.KEYS.LEAVE, id, {
            status: 'approved',
            approvedBy: approver,
            approvedDate: new Date().toISOString()
        });

        if (updated) {
            api.updateItem('leave', updated);
            this.updatePendingCount();

            // Update soldier status
            const leave = this.getById(id);
            if (leave) {
                soldiers.update(leave.soldierId, { status: 'leave' });
            }
        }
    },

    /**
     * Reject leave
     * @param {string} id - Leave ID
     * @param {string} reason - Reject reason
     */
    reject(id, reason = '') {
        const updated = storage.update(storage.KEYS.LEAVE, id, {
            status: 'rejected',
            rejectReason: reason,
            approvedDate: new Date().toISOString()
        });

        if (updated) {
            api.updateItem('leave', updated);
            this.updatePendingCount();
        }
    },

    /**
     * Cancel leave
     * @param {string} id - Leave ID
     */
    cancel(id) {
        const updated = storage.update(storage.KEYS.LEAVE, id, {
            status: 'cancelled'
        });

        if (updated) {
            api.updateItem('leave', updated);
            this.updatePendingCount();

            // Update soldier status back to active
            const leave = this.getById(id);
            if (leave) {
                soldiers.update(leave.soldierId, { status: 'active' });
            }
        }
    },

    /**
     * Delete leave
     * @param {string} id - Leave ID
     * @returns {boolean} Success status
     */
    delete(id) {
        const success = storage.delete(storage.KEYS.LEAVE, id);
        if (success) {
            api.deleteItem('leave', id);
            this.updatePendingCount();
        }
        return success;
    },

    /**
     * Generate leave ID
     * @returns {string} Leave ID
     */
    generateId() {
        const year = new Date().getFullYear().toString().slice(-2);
        const count = this.getAll().length + 1;
        return `L${year}${count.toString().padStart(4, '0')}`;
    },

    /**
     * Calculate leave days
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {number} Number of days
     */
    calculateDays(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = end.getTime() - start.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    },

    /**
     * Show add form modal
     */
    showAddForm() {
        const soldiersList = soldiers.getForDropdown();
        const today = new Date().toISOString().split('T')[0];

        if (soldiersList.length === 0) {
            app.showToast('warning', 'ไม่มีข้อมูล', 'กรุณาเพิ่มข้อมูลกำลังพลก่อน');
            return;
        }

        const content = `
            <form id="leave-form">
                <div class="form-group">
                    <label class="form-label required">กำลังพล</label>
                    <select class="form-select" name="soldierId" required>
                        <option value="">-- เลือกกำลังพล --</option>
                        ${soldiersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label required">ประเภทการลา</label>
                    <select class="form-select" name="leaveType" required>
                        ${Object.entries(this.TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">วันเริ่มลา</label>
                        <input type="date" class="form-input" name="startDate" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">วันสิ้นสุด</label>
                        <input type="date" class="form-input" name="endDate" required value="${today}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">เหตุผล</label>
                    <textarea class="form-textarea" name="reason" rows="3" placeholder="ระบุเหตุผลการลา"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">เบอร์ติดต่อระหว่างลา</label>
                    <input type="tel" class="form-input" name="contact" placeholder="0xx-xxx-xxxx">
                </div>
            </form>
        `;

        app.showModal('ยื่นใบลา', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ยื่นใบลา', class: 'btn-primary', onclick: 'leave.handleSubmit()' }
        ]);
    },

    /**
     * Handle form submission
     */
    handleSubmit() {
        const form = document.getElementById('leave-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            this.add(data);
            app.showToast('success', 'ยื่นใบลาสำเร็จ', 'ใบลาถูกส่งไปรออนุมัติแล้ว');
            app.closeModal();
            this.render();
            dashboard.updatePending();
        } catch (error) {
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
        }
    },

    /**
     * Show approve modal
     * @param {string} id - Leave ID
     */
    showApproveModal(id) {
        const record = this.getById(id);
        if (!record) return;

        const soldier = soldiers.getById(record.soldierId);
        const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''} ${soldier.lastName || ''}`.trim() : '-';
        const days = this.calculateDays(record.startDate, record.endDate);

        const content = `
            <div style="text-align: center; margin-bottom: 20px;">
                <i class="ph ph-calendar-check" style="font-size: 3rem; color: var(--color-secondary);"></i>
                <h3 style="margin-top: 10px;">ใบลา ${record.leaveId}</h3>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <i class="ph ph-user"></i>
                    <span>${soldierName}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-note"></i>
                    <span>${this.TYPES[record.leaveType] || record.leaveType}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-calendar"></i>
                    <span>${this.formatDateRange(record.startDate, record.endDate)} (${days} วัน)</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-chat-text"></i>
                    <span>${record.reason || '-'}</span>
                </div>
            </div>
        `;

        app.showModal('อนุมัติใบลา', content, [
            { text: 'ไม่อนุมัติ', class: 'btn-danger', onclick: `leave.showRejectModal('${id}')` },
            { text: 'อนุมัติ', class: 'btn-success', onclick: `leave.handleApprove('${id}')` }
        ]);
    },

    /**
     * Handle approve
     * @param {string} id - Leave ID
     */
    handleApprove(id) {
        this.approve(id);
        app.closeModal();
        app.showToast('success', 'อนุมัติสำเร็จ', 'ใบลาได้รับการอนุมัติแล้ว');
        this.render();
        dashboard.updateStats();
        dashboard.updatePending();
    },

    /**
     * Show reject modal
     * @param {string} id - Leave ID
     */
    showRejectModal(id) {
        const content = `
            <form id="reject-form">
                <div class="form-group">
                    <label class="form-label">เหตุผลที่ไม่อนุมัติ</label>
                    <textarea class="form-textarea" name="reason" rows="3" placeholder="ระบุเหตุผล"></textarea>
                </div>
            </form>
        `;

        app.showModal('ไม่อนุมัติใบลา', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ยืนยัน', class: 'btn-danger', onclick: `leave.handleReject('${id}')` }
        ]);
    },

    /**
     * Handle reject
     * @param {string} id - Leave ID
     */
    handleReject(id) {
        const form = document.getElementById('reject-form');
        const formData = new FormData(form);
        const reason = formData.get('reason');

        this.reject(id, reason);
        app.closeModal();
        app.showToast('info', 'ไม่อนุมัติใบลา', '');
        this.render();
        dashboard.updatePending();
    },

    /**
     * Confirm cancel
     * @param {string} id - Leave ID
     */
    confirmCancel(id) {
        app.showConfirm(
            'ยืนยันการยกเลิก',
            'คุณต้องการยกเลิกใบลานี้หรือไม่?',
            () => {
                this.cancel(id);
                app.showToast('success', 'ยกเลิกสำเร็จ', '');
                this.render();
                dashboard.updateStats();
            }
        );
    },

    /**
     * Confirm delete
     * @param {string} id - Leave ID
     */
    confirmDelete(id) {
        app.showConfirm(
            'ยืนยันการลบ',
            'คุณต้องการลบใบลานี้หรือไม่?',
            () => {
                this.delete(id);
                app.showToast('success', 'ลบสำเร็จ', '');
                this.render();
            }
        );
    },

    /**
     * Render leave list
     */
    render() {
        const records = this.getByStatus(this.currentTab);
        const container = document.getElementById('leave-list');

        if (!container) return;

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="ph ph-calendar-check"></i>
                    <p>ไม่มีใบลา</p>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(l => {
            const soldier = soldiers.getById(l.soldierId);
            const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : '-';
            const days = this.calculateDays(l.startDate, l.endDate);

            return `
                <div class="leave-card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${soldierName}</div>
                            <div class="card-subtitle">${l.leaveId}</div>
                        </div>
                        ${this.renderStatusBadge(l.status)}
                    </div>
                    <div class="card-body">
                        <div class="card-info">
                            <i class="ph ph-note"></i>
                            <span>${this.TYPES[l.leaveType] || l.leaveType}</span>
                        </div>
                        <div class="card-info">
                            <i class="ph ph-calendar"></i>
                            <span>${this.formatDateRange(l.startDate, l.endDate)} (${days} วัน)</span>
                        </div>
                        ${l.reason ? `
                        <div class="card-info">
                            <i class="ph ph-chat-text"></i>
                            <span>${l.reason}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="card-footer">
                        ${this.renderActions(l)}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render status badge
     * @param {string} status - Status
     * @returns {string} Badge HTML
     */
    renderStatusBadge(status) {
        const badges = {
            pending: '<span class="badge badge-warning">รออนุมัติ</span>',
            approved: '<span class="badge badge-success">อนุมัติ</span>',
            rejected: '<span class="badge badge-danger">ไม่อนุมัติ</span>',
            cancelled: '<span class="badge badge-neutral">ยกเลิก</span>'
        };
        return badges[status] || '';
    },

    /**
     * Render action buttons based on status
     * @param {Object} leave - Leave record
     * @returns {string} Buttons HTML
     */
    renderActions(l) {
        if (l.status === 'pending') {
            return `
                <button class="btn btn-success" onclick="leave.showApproveModal('${l.id}')">
                    <i class="ph ph-check"></i>
                    อนุมัติ
                </button>
                <button class="btn btn-danger" onclick="leave.showRejectModal('${l.id}')">
                    <i class="ph ph-x"></i>
                    ไม่อนุมัติ
                </button>
            `;
        } else if (l.status === 'approved') {
            return `
                <button class="btn btn-outline" onclick="leave.confirmCancel('${l.id}')">
                    <i class="ph ph-x-circle"></i>
                    ยกเลิก
                </button>
            `;
        } else {
            return `
                <button class="btn btn-outline" onclick="leave.confirmDelete('${l.id}')">
                    <i class="ph ph-trash"></i>
                    ลบ
                </button>
            `;
        }
    },

    /**
     * Format date range
     * @param {string} start - Start date
     * @param {string} end - End date
     * @returns {string} Formatted range
     */
    formatDateRange(start, end) {
        const options = { day: 'numeric', month: 'short' };
        const startDate = new Date(start).toLocaleDateString('th-TH', options);
        const endDate = new Date(end).toLocaleDateString('th-TH', options);

        if (start === end) {
            return startDate;
        }
        return `${startDate} - ${endDate}`;
    },

    /**
     * Get today's leave count
     * @returns {number} Count
     */
    getTodayLeaveCount() {
        return this.getActiveToday().length;
    },

    /**
     * Get pending count
     * @returns {number} Count
     */
    getPendingCount() {
        return this.getByStatus('pending').length;
    }
};
