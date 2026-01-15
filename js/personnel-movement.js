/**
 * Personnel Movement Module - บันทึกการเข้าออกหน่วย
 * Handles entry/exit records for personnel including night shifts
 */

const personnelMovement = {
    // Movement types
    TYPES: {
        dispatch: 'ไปราชการ',
        return_duty: 'กลับจากราชการ',
        transfer_out: 'ย้ายออก',
        transfer_in: 'ย้ายเข้า',
        resign: 'ลาออก',
        retire: 'เกษียณ',
        night_exit: 'ออกกลางคืน',
        night_entry: 'เข้ากลางคืน',
        other: 'อื่นๆ'
    },

    // Movement categories
    CATEGORIES: {
        in: ['return_duty', 'transfer_in', 'night_entry'],
        out: ['dispatch', 'transfer_out', 'resign', 'retire', 'night_exit', 'other']
    },

    // Time periods
    TIME_PERIODS: {
        day: 'กลางวัน (06:00-18:00)',
        night: 'กลางคืน (18:00-06:00)'
    },

    currentTab: 'all',
    currentFilter: { type: '', startDate: '', endDate: '' },

    /**
     * Initialize module
     */
    init() {
        this.bindEvents();
        this.setDefaultDates();
        this.render();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab switching
        document.querySelectorAll('#page-movement .tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Filter changes
        const typeFilter = document.getElementById('movement-filter-type');
        const startDate = document.getElementById('movement-start-date');
        const endDate = document.getElementById('movement-end-date');

        if (typeFilter) typeFilter.addEventListener('change', () => this.applyFilters());
        if (startDate) startDate.addEventListener('change', () => this.applyFilters());
        if (endDate) endDate.addEventListener('change', () => this.applyFilters());
    },

    /**
     * Set default date range (current month)
     */
    setDefaultDates() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const startInput = document.getElementById('movement-start-date');
        const endInput = document.getElementById('movement-end-date');

        if (startInput) startInput.value = firstDay.toISOString().split('T')[0];
        if (endInput) endInput.value = lastDay.toISOString().split('T')[0];

        this.currentFilter.startDate = startInput?.value || '';
        this.currentFilter.endDate = endInput?.value || '';
    },

    /**
     * Switch tab
     * @param {string} tab - Tab name
     */
    switchTab(tab) {
        this.currentTab = tab;

        // Update tab UI
        document.querySelectorAll('#page-movement .tabs .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        this.render();
    },

    /**
     * Apply filters
     */
    applyFilters() {
        const typeFilter = document.getElementById('movement-filter-type');
        const startDate = document.getElementById('movement-start-date');
        const endDate = document.getElementById('movement-end-date');

        this.currentFilter = {
            type: typeFilter?.value || '',
            startDate: startDate?.value || '',
            endDate: endDate?.value || ''
        };

        this.render();
    },

    /**
     * Get all movement records
     * @returns {Array} Movement records
     */
    getAll() {
        return storage.getAll(storage.KEYS.MOVEMENT) || [];
    },

    /**
     * Get movement by ID
     * @param {string} id - Movement ID
     * @returns {Object|null} Movement record
     */
    getById(id) {
        return storage.getById(storage.KEYS.MOVEMENT, id);
    },

    /**
     * Add new movement record
     * @param {Object} data - Movement data
     * @returns {Object} Added movement
     */
    add(data) {
        const now = new Date();
        const movementTime = data.time || now.toTimeString().slice(0, 5);
        const hour = parseInt(movementTime.split(':')[0]);
        const isNight = hour >= 18 || hour < 6;

        const movement = {
            ...data,
            id: storage.generateId(),
            time: movementTime,
            period: isNight ? 'night' : 'day',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };

        const added = storage.add(storage.KEYS.MOVEMENT, movement);

        // Log activity
        let name = 'ไม่ระบุ';
        if (movement.isVisitor) {
            name = `${movement.visitorName} (Visitor)`;
        } else {
            const soldier = soldiers.getById(data.soldierId);
            name = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : 'ไม่ระบุ';
        }
        storage.logActivity('add', 'movement', {
            summary: `บันทึก${this.TYPES[data.movementType]} - ${name}`
        });

        // Upload to API
        api.uploadItem('movement', added);

        return added;
    },

    /**
     * Update movement record
     * @param {string} id - Movement ID
     * @param {Object} data - Updated data
     * @returns {Object|null} Updated movement
     */
    update(id, data) {
        const updated = storage.update(storage.KEYS.MOVEMENT, id, {
            ...data,
            updatedAt: new Date().toISOString()
        });

        if (updated) {
            api.updateItem('Movement', updated);
        }

        return updated;
    },

    /**
     * Delete movement record
     * @param {string} id - Movement ID
     * @returns {boolean} Success status
     */
    delete(id) {
        const movement = this.getById(id);
        if (!movement) return false;

        const success = storage.delete(storage.KEYS.MOVEMENT, id);

        if (success) {
            storage.logActivity('delete', 'movement', { summary: 'ลบบันทึกการเข้าออก' });
            api.deleteItem('Movement', id);
        }

        return success;
    },

    /**
     * Get filtered movements
     * @returns {Array} Filtered movements
     */
    getFiltered() {
        let records = this.getAll();

        // Filter by tab
        if (this.currentTab === 'in') {
            records = records.filter(r => this.CATEGORIES.in.includes(r.movementType));
        } else if (this.currentTab === 'out') {
            records = records.filter(r => this.CATEGORIES.out.includes(r.movementType));
        } else if (this.currentTab === 'night') {
            records = records.filter(r => r.period === 'night');
        }

        // Filter by type
        if (this.currentFilter.type) {
            records = records.filter(r => r.movementType === this.currentFilter.type);
        }

        // Filter by date range
        if (this.currentFilter.startDate && this.currentFilter.endDate) {
            records = records.filter(r => {
                const date = r.date;
                return date >= this.currentFilter.startDate && date <= this.currentFilter.endDate;
            });
        }

        // Sort by date descending
        records.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

        return records;
    },

    /**
     * Get statistics
     * @returns {Object} Stats object
     */
    getStats() {
        const records = this.getAll();
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const thisMonth = records.filter(r => r.date && r.date.startsWith(now.toISOString().slice(0, 7)));

        return {
            total: records.length,
            todayIn: records.filter(r => r.date === today && this.CATEGORIES.in.includes(r.movementType)).length,
            todayOut: records.filter(r => r.date === today && this.CATEGORIES.out.includes(r.movementType)).length,
            nightMovements: records.filter(r => r.period === 'night').length,
            monthIn: thisMonth.filter(r => this.CATEGORIES.in.includes(r.movementType)).length,
            monthOut: thisMonth.filter(r => this.CATEGORIES.out.includes(r.movementType)).length
        };
    },

    /**
     * Show add form modal
     */
    showAddForm() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const currentDate = now.toISOString().split('T')[0];
        const hour = now.getHours();
        const isNight = hour >= 18 || hour < 6;

        // Default type based on time
        const defaultType = isNight ? 'night_exit' : 'dispatch';

        const soldiersOptions = soldiers.getForDropdown()
            .map(s => `<option value="${s.id}">${s.name}</option>`)
            .join('');

        const typeOptions = Object.entries(this.TYPES)
            .map(([key, label]) => `<option value="${key}" ${key === defaultType ? 'selected' : ''}>${label}</option>`)
            .join('');

        const modalBody = `
            <form id="movement-form" class="form">
                <!-- Toggle Visitor Mode -->
                <div class="form-group" style="text-align: center; margin-bottom: 15px;">
                    <div class="btn-group" role="group">
                        <input type="radio" class="btn-check" name="personnelType" id="type-soldier" value="soldier" checked onchange="personnelMovement.toggleFormMode()">
                        <label class="btn btn-outline" for="type-soldier">💂 กำลังพล</label>

                        <input type="radio" class="btn-check" name="personnelType" id="type-visitor" value="visitor" onchange="personnelMovement.toggleFormMode()">
                        <label class="btn btn-outline" for="type-visitor">👤 บุคคลภายนอก</label>
                    </div>
                </div>

                <!-- Soldier Input -->
                <div id="field-soldier" class="form-group">
                    <label class="form-label">กำลังพล <span class="required">*</span></label>
                    <select id="movement-soldier" class="form-select">
                        <option value="">เลือกกำลังพล</option>
                        ${soldiersOptions}
                    </select>
                </div>

                <!-- Visitor Inputs -->
                <div id="field-visitor" class="hidden">
                    <div class="form-group">
                        <label class="form-label">ชื่อ-สกุล (ผู้มาติดต่อ) <span class="required">*</span></label>
                        <input type="text" id="movement-visitor-name" class="form-input" placeholder="ระบุชื่อ-สกุล">
                    </div>
                    <div class="form-group">
                        <label class="form-label">มาจาก (หน่วยงาน/ที่อยู่)</label>
                        <input type="text" id="movement-origin" class="form-input" placeholder="เช่น บ.จัดส่ง, ญาติ">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ยานพาหนะ/เลขบัตร</label>
                        <input type="text" id="movement-vehicle" class="form-input" placeholder="ทะเบียนรถ / เลขบัตร">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">ประเภท <span class="required">*</span></label>
                        <select id="movement-type" class="form-select" required>
                            ${typeOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">ช่วงเวลา</label>
                        <div class="period-indicator ${isNight ? 'night' : 'day'}">
                            <i class="ph ph-${isNight ? 'moon' : 'sun'}"></i>
                            <span>${isNight ? 'กลางคืน' : 'กลางวัน'}</span>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">วันที่ <span class="required">*</span></label>
                        <input type="date" id="movement-date" class="form-input" value="${currentDate}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">เวลา <span class="required">*</span></label>
                        <input type="time" id="movement-time" class="form-input" value="${currentTime}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">จุดหมาย / มาติดต่อเรื่อง</label>
                    <input type="text" id="movement-destination" class="form-input" placeholder="ระบุปลายทาง หรือ เรื่องที่มาติดต่อ">
                </div>
                <div class="form-group">
                    <label class="form-label">เหตุผล/รายละเอียด</label>
                    <textarea id="movement-reason" class="form-textarea" rows="2" placeholder="ระบุรายละเอียด..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">กำหนดกลับ (ถ้ามี)</label>
                    <input type="date" id="movement-return-date" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">หมายเหตุ</label>
                    <input type="text" id="movement-note" class="form-input" placeholder="หมายเหตุเพิ่มเติม...">
                </div>
            </form>
        `;

        app.showModal('บันทึกการเข้าออกหน่วย', modalBody, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'personnelMovement.handleSubmit()' }
        ]);

        // Init Mode
        this.toggleFormMode();

        // Update period indicator when time changes
        document.getElementById('movement-time')?.addEventListener('change', (e) => {
            const hour = parseInt(e.target.value.split(':')[0]);
            const isNight = hour >= 18 || hour < 6;
            const indicator = document.querySelector('.period-indicator');
            if (indicator) {
                indicator.className = `period-indicator ${isNight ? 'night' : 'day'}`;
                indicator.innerHTML = `
                    <i class="ph ph-${isNight ? 'moon' : 'sun'}"></i>
                    <span>${isNight ? 'กลางคืน' : 'กลางวัน'}</span>
                `;
            }
        });
    },

    /**
     * Toggle Form Mode (Soldier vs Visitor)
     */
    toggleFormMode() {
        const isVisitor = document.getElementById('type-visitor').checked;
        const fieldSoldier = document.getElementById('field-soldier');
        const fieldVisitor = document.getElementById('field-visitor');

        if (isVisitor) {
            fieldSoldier.classList.add('hidden');
            fieldVisitor.classList.remove('hidden');
        } else {
            fieldSoldier.classList.remove('hidden');
            fieldVisitor.classList.add('hidden');
        }
    },

    /**
     * Handle form submission
     */
    handleSubmit() {
        const isVisitor = document.getElementById('type-visitor').checked;

        // Common Fields
        const movementType = document.getElementById('movement-type')?.value;
        const date = document.getElementById('movement-date')?.value;
        const time = document.getElementById('movement-time')?.value;
        const destination = document.getElementById('movement-destination')?.value;
        const reason = document.getElementById('movement-reason')?.value;
        const returnDate = document.getElementById('movement-return-date')?.value;
        const note = document.getElementById('movement-note')?.value;

        // Specific Fields
        let soldierId = null;
        let visitorData = {};

        if (isVisitor) {
            const visitorName = document.getElementById('movement-visitor-name')?.value;
            const origin = document.getElementById('movement-origin')?.value;
            const vehicle = document.getElementById('movement-vehicle')?.value;

            if (!visitorName) {
                app.showToast('warning', 'ข้อมูลไม่ครบ', 'กรุณาระบุชื่อผู้มาติดต่อ');
                return;
            }
            visitorData = { visitorName, origin, vehicle };
        } else {
            soldierId = document.getElementById('movement-soldier')?.value;
            if (!soldierId) {
                app.showToast('warning', 'ข้อมูลไม่ครบ', 'กรุณาเลือกกำลังพล');
                return;
            }
        }

        if (!movementType || !date || !time) {
            app.showToast('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่จำเป็น');
            return;
        }

        this.add({
            soldierId,
            ...visitorData,
            movementType,
            date,
            time,
            destination,
            reason,
            returnDate,
            note,
            isVisitor
        });

        app.closeModal();
        app.showToast('success', 'บันทึกสำเร็จ', 'บันทึกการเข้าออกหน่วยแล้ว');
        this.render();
        dashboard.refresh();
    },

    /**
     * Confirm delete
     * @param {string} id - Movement ID
     */
    confirmDelete(id) {
        const movement = this.getById(id);
        if (!movement) return;

        const soldier = soldiers.getById(movement.soldierId);
        const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : 'ไม่ระบุ';

        app.showModal('ยืนยันการลบ', `
            <div class="confirm-delete">
                <i class="ph ph-warning" style="color: var(--color-danger); font-size: 3rem;"></i>
                <p>ต้องการลบบันทึกการ${this.TYPES[movement.movementType]}</p>
                <p>ของ ${soldierName} ใช่หรือไม่?</p>
            </div>
        `, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ลบ', class: 'btn-danger', onclick: `personnelMovement.executeDelete('${id}')` }
        ]);
    },

    /**
     * Execute delete (called from modal button)
     * @param {string} id - Movement ID
     */
    executeDelete(id) {
        this.delete(id);
        app.closeModal();
        app.showToast('success', 'ลบสำเร็จ', 'ลบบันทึกแล้ว');
        this.render();
    },

    /**
     * Render movement list
     */
    render() {
        const container = document.getElementById('movement-list');
        if (!container) return;

        const records = this.getFiltered();
        const stats = this.getStats();

        // Update stats
        this.updateStats(stats);

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-signpost"></i>
                    <p>ไม่มีบันทึกการเข้าออกหน่วย</p>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(r => {
            const soldier = soldiers.getById(r.soldierId);
            const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''} ${soldier.lastName || ''}`.trim() : 'ไม่ระบุ';
            const isIn = this.CATEGORIES.in.includes(r.movementType);
            const isNight = r.period === 'night';

            return `
                <div class="movement-card ${isIn ? 'type-in' : 'type-out'} ${isNight ? 'night' : ''}">
                    <div class="movement-header">
                        <div class="movement-soldier">
                            <div class="soldier-avatar ${isNight ? 'night' : ''}">
                                <i class="ph ph-user"></i>
                            </div>
                            <div class="soldier-info">
                                <span class="soldier-name">${soldierName}</span>
                                <span class="soldier-id">${soldier?.soldierId || ''}</span>
                            </div>
                        </div>
                        <div class="movement-badges">
                            ${isNight ? '<span class="badge night"><i class="ph ph-moon"></i></span>' : ''}
                            <span class="badge ${isIn ? 'success' : 'warning'}">${this.TYPES[r.movementType]}</span>
                        </div>
                    </div>
                    <div class="movement-body">
                        <div class="movement-detail">
                            <i class="ph ph-calendar"></i>
                            <span>${this.formatDate(r.date)}</span>
                        </div>
                        <div class="movement-detail">
                            <i class="ph ph-clock"></i>
                            <span>${r.time}</span>
                        </div>
                        ${r.destination ? `
                            <div class="movement-detail">
                                <i class="ph ph-map-pin"></i>
                                <span>${r.destination}</span>
                            </div>
                        ` : ''}
                        ${r.returnDate ? `
                            <div class="movement-detail">
                                <i class="ph ph-calendar-check"></i>
                                <span>กำหนดกลับ: ${this.formatDate(r.returnDate)}</span>
                            </div>
                        ` : ''}
                        ${r.reason ? `<div class="movement-reason">${r.reason}</div>` : ''}
                    </div>
                    <div class="movement-actions">
                        <button class="btn btn-sm btn-outline" onclick="personnelMovement.confirmDelete('${r.id}')">
                            <i class="ph ph-trash"></i>
                            ลบ
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Update statistics display
     * @param {Object} stats - Stats object
     */
    updateStats(stats) {
        const elements = {
            'stat-movement-in': stats.todayIn,
            'stat-movement-out': stats.todayOut,
            'stat-movement-night': stats.nightMovements,
            'stat-movement-total': stats.total
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    },

    /**
     * Format date
     * @param {string} dateStr - Date string
     * @returns {string} Formatted date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: '2-digit'
        });
    },

    /**
     * Get today's night movements
     * @returns {number} Count
     */
    getNightMovementCount() {
        const today = new Date().toISOString().split('T')[0];
        return this.getAll().filter(r => r.date === today && r.period === 'night').length;
    }
};
