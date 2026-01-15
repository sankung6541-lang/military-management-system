/**
 * Attendance Module - Check-in/Check-out Management
 * Handles attendance tracking for soldiers
 */

const attendance = {
    currentDate: new Date().toISOString().split('T')[0],

    /**
     * Initialize attendance module
     */
    init() {
        this.bindEvents();
        this.setDateInput();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        const dateInput = document.getElementById('attendance-date');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.render();
            });
        }
    },

    /**
     * Set date input to current date
     */
    setDateInput() {
        const dateInput = document.getElementById('attendance-date');
        if (dateInput) {
            dateInput.value = this.currentDate;
        }
    },

    /**
     * Go to previous day
     */
    prevDay() {
        const date = new Date(this.currentDate);
        date.setDate(date.getDate() - 1);
        this.currentDate = date.toISOString().split('T')[0];
        this.setDateInput();
        this.render();
    },

    /**
     * Go to next day
     */
    nextDay() {
        const date = new Date(this.currentDate);
        date.setDate(date.getDate() + 1);
        this.currentDate = date.toISOString().split('T')[0];
        this.setDateInput();
        this.render();
    },

    /**
     * Go to today
     */
    goToday() {
        this.currentDate = new Date().toISOString().split('T')[0];
        this.setDateInput();
        this.render();
    },

    /**
     * Get all attendance records
     * @returns {Array} Attendance records
     */
    getAll() {
        return storage.getAll(storage.KEYS.ATTENDANCE);
    },

    /**
     * Get attendance for a specific date
     * @param {string} date - Date (YYYY-MM-DD)
     * @returns {Array} Attendance records for date
     */
    getByDate(date) {
        return this.getAll().filter(a => a.date === date);
    },

    /**
     * Get attendance record for a soldier on a specific date
     * @param {string} soldierId - Soldier ID
     * @param {string} date - Date
     * @returns {Object|null} Attendance record
     */
    getRecord(soldierId, date) {
        return this.getAll().find(a => a.soldierId === soldierId && a.date === date);
    },

    /**
     * Check in a soldier
     * @param {string} soldierId - Soldier ID
     * @param {string} note - Optional note
     * @returns {Object} Attendance record
     */
    checkIn(soldierId, note = '') {
        const date = this.currentDate;
        const time = new Date().toTimeString().slice(0, 5);
        const settings = storage.getSettings();
        const workStart = settings.workStart || '08:00';

        // Determine status based on time
        let status = 'present';
        if (time > workStart) {
            status = 'late';
        }

        // Check if already checked in
        const existing = this.getRecord(soldierId, date);
        if (existing) {
            // Update existing record
            return storage.update(storage.KEYS.ATTENDANCE, existing.id, {
                checkIn: time,
                status,
                note
            });
        }

        // Create new record
        const record = {
            soldierId,
            date,
            checkIn: time,
            checkOut: null,
            status,
            note
        };

        return storage.add(storage.KEYS.ATTENDANCE, record);
    },

    /**
     * Check out a soldier
     * @param {string} soldierId - Soldier ID
     * @param {string} note - Optional note
     * @returns {Object|null} Updated record
     */
    checkOut(soldierId, note = '') {
        const date = this.currentDate;
        const time = new Date().toTimeString().slice(0, 5);

        const existing = this.getRecord(soldierId, date);
        if (existing) {
            return storage.update(storage.KEYS.ATTENDANCE, existing.id, {
                checkOut: time,
                note: note || existing.note
            });
        }

        // Create record with only check out (unusual case)
        const record = {
            soldierId,
            date,
            checkIn: null,
            checkOut: time,
            status: 'present',
            note
        };

        return storage.add(storage.KEYS.ATTENDANCE, record);
    },

    /**
     * Mark soldier as absent
     * @param {string} soldierId - Soldier ID
     * @param {string} note - Optional note
     */
    markAbsent(soldierId, note = '') {
        const date = this.currentDate;
        const existing = this.getRecord(soldierId, date);

        if (existing) {
            storage.update(storage.KEYS.ATTENDANCE, existing.id, {
                status: 'absent',
                note
            });
        } else {
            storage.add(storage.KEYS.ATTENDANCE, {
                soldierId,
                date,
                checkIn: null,
                checkOut: null,
                status: 'absent',
                note
            });
        }
    },

    /**
     * Show check-in modal
     */
    showCheckIn() {
        const soldiersList = soldiers.getForDropdown();

        if (soldiersList.length === 0) {
            app.showToast('warning', 'ไม่มีข้อมูล', 'กรุณาเพิ่มข้อมูลกำลังพลก่อน');
            return;
        }

        // Filter out soldiers who already checked in today
        const todayRecords = this.getByDate(this.currentDate);
        const checkedInIds = todayRecords.filter(r => r.checkIn).map(r => r.soldierId);
        const available = soldiersList.filter(s => !checkedInIds.includes(s.id));

        if (available.length === 0) {
            app.showToast('info', 'ลงเวลาครบแล้ว', 'กำลังพลทั้งหมดลงเวลาเข้าแล้ว');
            return;
        }

        const content = `
            <form id="checkin-form">
                <div class="form-group">
                    <label class="form-label required">เลือกกำลังพล</label>
                    <select class="form-select" name="soldierId" required>
                        <option value="">-- เลือกกำลังพล --</option>
                        ${available.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">เวลา</label>
                    <input type="time" class="form-input" name="time" value="${new Date().toTimeString().slice(0, 5)}">
                </div>
                <div class="form-group">
                    <label class="form-label">หมายเหตุ</label>
                    <textarea class="form-textarea" name="note" rows="2" placeholder="หมายเหตุ (ถ้ามี)"></textarea>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button type="button" class="btn btn-success" onclick="attendance.handleBulkCheckIn()" style="width: 100%;">
                        <i class="ph ph-users"></i>
                        ลงเวลาเข้าทั้งหมด (${available.length} คน)
                    </button>
                </div>
            </form>
        `;

        app.showModal('ลงเวลาเข้า', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-success', onclick: 'attendance.handleCheckIn()' }
        ]);
    },

    /**
     * Handle check-in form submission
     */
    handleCheckIn() {
        const form = document.getElementById('checkin-form');
        const formData = new FormData(form);
        const soldierId = formData.get('soldierId');
        const note = formData.get('note');

        if (!soldierId) {
            app.showToast('error', 'กรุณาเลือกกำลังพล', '');
            return;
        }

        this.checkIn(soldierId, note);
        app.closeModal();
        app.showToast('success', 'ลงเวลาเข้าสำเร็จ', '');
        this.render();
        dashboard.updateStats();
    },

    /**
     * Handle bulk check-in
     */
    handleBulkCheckIn() {
        const soldiersList = soldiers.getForDropdown();
        const todayRecords = this.getByDate(this.currentDate);
        const checkedInIds = todayRecords.filter(r => r.checkIn).map(r => r.soldierId);
        const available = soldiersList.filter(s => !checkedInIds.includes(s.id));

        available.forEach(s => {
            this.checkIn(s.id, 'ลงเวลาพร้อมกัน');
        });

        app.closeModal();
        app.showToast('success', 'ลงเวลาเข้าสำเร็จ', `ลงเวลาเข้า ${available.length} คน`);
        this.render();
        dashboard.updateStats();
    },

    /**
     * Show check-out modal
     */
    showCheckOut() {
        const todayRecords = this.getByDate(this.currentDate);
        const checkedIn = todayRecords.filter(r => r.checkIn && !r.checkOut);

        if (checkedIn.length === 0) {
            app.showToast('info', 'ไม่มีรายการ', 'ไม่มีกำลังพลที่ต้องลงเวลาออก');
            return;
        }

        const soldiersList = soldiers.getForDropdown();
        const available = checkedIn.map(r => {
            const soldier = soldiersList.find(s => s.id === r.soldierId);
            return soldier ? { ...soldier, recordId: r.id } : null;
        }).filter(Boolean);

        const content = `
            <form id="checkout-form">
                <div class="form-group">
                    <label class="form-label required">เลือกกำลังพล</label>
                    <select class="form-select" name="soldierId" required>
                        <option value="">-- เลือกกำลังพล --</option>
                        ${available.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">เวลา</label>
                    <input type="time" class="form-input" name="time" value="${new Date().toTimeString().slice(0, 5)}">
                </div>
                <div class="form-group">
                    <label class="form-label">หมายเหตุ</label>
                    <textarea class="form-textarea" name="note" rows="2" placeholder="หมายเหตุ (ถ้ามี)"></textarea>
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button type="button" class="btn btn-warning" onclick="attendance.handleBulkCheckOut()" style="width: 100%;">
                        <i class="ph ph-users"></i>
                        ลงเวลาออกทั้งหมด (${available.length} คน)
                    </button>
                </div>
            </form>
        `;

        app.showModal('ลงเวลาออก', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-warning', onclick: 'attendance.handleCheckOut()' }
        ]);
    },

    /**
     * Handle check-out form submission
     */
    handleCheckOut() {
        const form = document.getElementById('checkout-form');
        const formData = new FormData(form);
        const soldierId = formData.get('soldierId');
        const note = formData.get('note');

        if (!soldierId) {
            app.showToast('error', 'กรุณาเลือกกำลังพล', '');
            return;
        }

        this.checkOut(soldierId, note);
        app.closeModal();
        app.showToast('success', 'ลงเวลาออกสำเร็จ', '');
        this.render();
    },

    /**
     * Handle bulk check-out
     */
    handleBulkCheckOut() {
        const todayRecords = this.getByDate(this.currentDate);
        const checkedIn = todayRecords.filter(r => r.checkIn && !r.checkOut);

        checkedIn.forEach(r => {
            this.checkOut(r.soldierId, 'ลงเวลาพร้อมกัน');
        });

        app.closeModal();
        app.showToast('success', 'ลงเวลาออกสำเร็จ', `ลงเวลาออก ${checkedIn.length} คน`);
        this.render();
    },

    /**
     * Get attendance summary for current date
     * @returns {Object} Summary counts
     */
    getSummary() {
        const records = this.getByDate(this.currentDate);
        const allSoldiers = soldiers.getAll().filter(s => s.status === 'active');

        const present = records.filter(r => r.status === 'present').length;
        const late = records.filter(r => r.status === 'late').length;
        const onLeave = records.filter(r => r.status === 'leave').length;
        const absent = allSoldiers.length - (present + late + onLeave);

        return { present, late, absent: Math.max(0, absent), leave: onLeave };
    },

    /**
     * Render attendance page
     */
    render() {
        // Update summary
        const summary = this.getSummary();
        document.getElementById('att-present').textContent = summary.present;
        document.getElementById('att-late').textContent = summary.late;
        document.getElementById('att-absent').textContent = summary.absent;
        document.getElementById('att-leave').textContent = summary.leave;

        // Get records for current date with soldier info
        const records = this.getByDate(this.currentDate);
        const allSoldiers = soldiers.getAll().filter(s => s.status === 'active');

        // Create combined list
        const attendanceList = allSoldiers.map(soldier => {
            const record = records.find(r => r.soldierId === soldier.id);
            return {
                soldier,
                record: record || null,
                status: record?.status || 'absent'
            };
        });

        // Render table
        const tbody = document.getElementById('attendance-tbody');
        if (tbody) {
            if (attendanceList.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center" style="padding: 40px;">
                            <div class="empty-state">
                                <i class="ph ph-users"></i>
                                <p>ยังไม่มีข้อมูลกำลังพล</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = attendanceList.map(({ soldier, record, status }) => `
                    <tr>
                        <td>${soldier.soldierId || '-'}</td>
                        <td>${soldier.rank || ''} ${soldier.firstName || ''} ${soldier.lastName || ''}</td>
                        <td>${record?.checkIn || '-'}</td>
                        <td>${record?.checkOut || '-'}</td>
                        <td>${this.renderStatusBadge(status)}</td>
                        <td>${record?.note || '-'}</td>
                    </tr>
                `).join('');
            }
        }

        // Render mobile cards
        const cardsContainer = document.getElementById('attendance-cards');
        if (cardsContainer) {
            if (attendanceList.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="ph ph-users"></i>
                        <p>ยังไม่มีข้อมูลกำลังพล</p>
                    </div>
                `;
            } else {
                cardsContainer.innerHTML = attendanceList.map(({ soldier, record, status }) => `
                    <div class="data-card">
                        <div class="data-card-header">
                            <span class="data-card-title">${soldier.rank || ''} ${soldier.firstName || ''}</span>
                            ${this.renderStatusBadge(status)}
                        </div>
                        <div class="data-card-body">
                            <div class="data-card-row">
                                <span class="data-card-label">เข้า</span>
                                <span class="data-card-value">${record?.checkIn || '-'}</span>
                            </div>
                            <div class="data-card-row">
                                <span class="data-card-label">ออก</span>
                                <span class="data-card-value">${record?.checkOut || '-'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    },

    /**
     * Render status badge
     * @param {string} status - Status
     * @returns {string} Badge HTML
     */
    renderStatusBadge(status) {
        const badges = {
            present: '<span class="badge badge-success">มา</span>',
            late: '<span class="badge badge-warning">สาย</span>',
            absent: '<span class="badge badge-danger">ขาด</span>',
            leave: '<span class="badge badge-info">ลา</span>'
        };
        return badges[status] || badges.absent;
    },

    /**
     * Get today's present count
     * @returns {number} Count
     */
    getTodayPresentCount() {
        const today = new Date().toISOString().split('T')[0];
        const records = this.getByDate(today);
        return records.filter(r => r.checkIn && (r.status === 'present' || r.status === 'late')).length;
    }
};
