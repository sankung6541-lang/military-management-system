/**
 * Equipment Module - Equipment Management
 * Handles equipment inventory and borrowing
 */

const equipment = {
    // Equipment categories
    CATEGORIES: {
        weapons: 'อาวุธ',
        vehicles: 'ยานพาหนะ',
        communication: 'อุปกรณ์สื่อสาร',
        uniform: 'เครื่องแบบ',
        tools: 'เครื่องมือ',
        medical: 'อุปกรณ์การแพทย์',
        other: 'อื่นๆ'
    },

    // Status options
    STATUS: {
        available: 'พร้อมใช้งาน',
        borrowed: 'ถูกเบิก',
        maintenance: 'ซ่อมบำรุง',
        damaged: 'ชำรุด',
        disposed: 'จำหน่าย'
    },

    currentTab: 'inventory',

    /**
     * Initialize equipment module
     */
    init() {
        this.bindEvents();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab switching
        document.querySelectorAll('#page-equipment .tab').forEach(tab => {
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

        document.querySelectorAll('#page-equipment .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        this.render();
    },

    /**
     * Get all equipment
     * @returns {Array} Equipment list
     */
    getAll() {
        return storage.getAll(storage.KEYS.EQUIPMENT);
    },

    /**
     * Get equipment by ID
     * @param {string} id - Equipment ID
     * @returns {Object|null} Equipment record
     */
    getById(id) {
        return storage.getById(storage.KEYS.EQUIPMENT, id);
    },

    /**
     * Get all borrow logs
     * @returns {Array} Borrow logs
     */
    getLogs() {
        return storage.getAll(storage.KEYS.EQUIPMENT_LOG);
    },

    /**
     * Get active borrows
     * @returns {Array} Active borrow records
     */
    getActiveBorrows() {
        return this.getLogs().filter(log => log.action === 'borrow' && !log.returnDate);
    },

    /**
     * Add new equipment
     * @param {Object} data - Equipment data
     * @returns {Object} Added equipment
     */
    add(data) {
        const record = {
            equipmentId: this.generateId(),
            name: data.name,
            category: data.category,
            quantity: parseInt(data.quantity) || 1,
            unit: data.unit || 'ชิ้น',
            location: data.location || '',
            description: data.description || '',
            status: data.status || 'available',
            lastCheck: new Date().toISOString().split('T')[0]
        };

        const added = storage.add(storage.KEYS.EQUIPMENT, record);
        api.uploadItem('equipment', added);
        return added;
    },

    /**
     * Update equipment
     * @param {string} id - Equipment ID
     * @param {Object} data - Updated data
     * @returns {Object|null} Updated equipment
     */
    update(id, data) {
        const updated = storage.update(storage.KEYS.EQUIPMENT, id, data);
        if (updated) {
            api.updateItem('equipment', updated);
        }
        return updated;
    },

    /**
     * Delete equipment
     * @param {string} id - Equipment ID
     * @returns {boolean} Success status
     */
    delete(id) {
        const success = storage.delete(storage.KEYS.EQUIPMENT, id);
        if (success) {
            api.deleteItem('equipment', id);
        }
        return success;
    },

    /**
     * Borrow equipment
     * @param {Object} data - Borrow data
     * @returns {Object} Borrow log
     */
    borrow(data) {
        const equipment = this.getById(data.equipmentId);
        if (!equipment) {
            throw new Error('ไม่พบอุปกรณ์');
        }

        const borrowQty = parseInt(data.quantity) || 1;
        if (borrowQty > equipment.quantity) {
            throw new Error('จำนวนไม่เพียงพอ');
        }

        // Create borrow log
        const log = {
            equipmentId: data.equipmentId,
            soldierId: data.soldierId,
            action: 'borrow',
            quantity: borrowQty,
            date: new Date().toISOString().split('T')[0],
            returnDate: null,
            expectedReturn: data.expectedReturn || null,
            note: data.note || ''
        };

        const added = storage.add(storage.KEYS.EQUIPMENT_LOG, log);

        // Update equipment quantity
        this.update(data.equipmentId, {
            quantity: equipment.quantity - borrowQty
        });

        return added;
    },

    /**
     * Return equipment
     * @param {string} logId - Borrow log ID
     * @param {Object} data - Return data
     * @returns {Object|null} Updated log
     */
    return(logId, data = {}) {
        const log = storage.getById(storage.KEYS.EQUIPMENT_LOG, logId);
        if (!log) {
            throw new Error('ไม่พบรายการเบิก');
        }

        // Update log
        const updated = storage.update(storage.KEYS.EQUIPMENT_LOG, logId, {
            returnDate: new Date().toISOString().split('T')[0],
            returnNote: data.note || ''
        });

        // Update equipment quantity
        const equipment = this.getById(log.equipmentId);
        if (equipment) {
            this.update(log.equipmentId, {
                quantity: equipment.quantity + log.quantity
            });
        }

        return updated;
    },

    /**
     * Generate equipment ID
     * @returns {string} Equipment ID
     */
    generateId() {
        const year = new Date().getFullYear().toString().slice(-2);
        const count = this.getAll().length + 1;
        return `E${year}${count.toString().padStart(4, '0')}`;
    },

    /**
     * Show add form modal
     */
    showAddForm() {
        const content = `
            <form id="equipment-form">
                <div class="form-group">
                    <label class="form-label required">ชื่ออุปกรณ์</label>
                    <input type="text" class="form-input" name="name" required placeholder="ระบุชื่ออุปกรณ์">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">หมวดหมู่</label>
                        <select class="form-select" name="category" required>
                            ${Object.entries(this.CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">จำนวน</label>
                        <input type="number" class="form-input" name="quantity" required min="1" value="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">หน่วยนับ</label>
                        <input type="text" class="form-input" name="unit" value="ชิ้น" placeholder="ชิ้น, กระบอก, คัน">
                    </div>
                    <div class="form-group">
                        <label class="form-label">สถานที่เก็บ</label>
                        <input type="text" class="form-input" name="location" placeholder="ตำแหน่งจัดเก็บ">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">รายละเอียด</label>
                    <textarea class="form-textarea" name="description" rows="2" placeholder="รายละเอียดเพิ่มเติม"></textarea>
                </div>
            </form>
        `;

        app.showModal('เพิ่มอุปกรณ์ใหม่', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'equipment.handleSubmit()' }
        ]);
    },

    /**
     * Show edit form modal
     * @param {string} id - Equipment ID
     */
    showEditForm(id) {
        const record = this.getById(id);
        if (!record) {
            app.showToast('error', 'ไม่พบข้อมูล', '');
            return;
        }

        const content = `
            <form id="equipment-form" data-id="${id}">
                <div class="form-group">
                    <label class="form-label required">ชื่ออุปกรณ์</label>
                    <input type="text" class="form-input" name="name" required value="${record.name || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">หมวดหมู่</label>
                        <select class="form-select" name="category" required>
                            ${Object.entries(this.CATEGORIES).map(([k, v]) =>
            `<option value="${k}" ${record.category === k ? 'selected' : ''}>${v}</option>`
        ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">จำนวน</label>
                        <input type="number" class="form-input" name="quantity" required min="0" value="${record.quantity || 0}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">หน่วยนับ</label>
                        <input type="text" class="form-input" name="unit" value="${record.unit || 'ชิ้น'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">สถานะ</label>
                        <select class="form-select" name="status">
                            ${Object.entries(this.STATUS).map(([k, v]) =>
            `<option value="${k}" ${record.status === k ? 'selected' : ''}>${v}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">สถานที่เก็บ</label>
                    <input type="text" class="form-input" name="location" value="${record.location || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">รายละเอียด</label>
                    <textarea class="form-textarea" name="description" rows="2">${record.description || ''}</textarea>
                </div>
            </form>
        `;

        app.showModal('แก้ไขอุปกรณ์', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'equipment.handleSubmit()' }
        ]);
    },

    /**
     * Handle form submission
     */
    handleSubmit() {
        const form = document.getElementById('equipment-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = form.dataset.id;

        try {
            if (id) {
                this.update(id, data);
                app.showToast('success', 'บันทึกสำเร็จ', 'แก้ไขอุปกรณ์เรียบร้อยแล้ว');
            } else {
                this.add(data);
                app.showToast('success', 'บันทึกสำเร็จ', 'เพิ่มอุปกรณ์ใหม่เรียบร้อยแล้ว');
            }

            app.closeModal();
            this.render();
        } catch (error) {
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
        }
    },

    /**
     * Show borrow form modal
     */
    showBorrowForm() {
        const equipmentList = this.getAll().filter(e => e.quantity > 0 && e.status === 'available');
        const soldiersList = soldiers.getForDropdown();

        if (equipmentList.length === 0) {
            app.showToast('warning', 'ไม่มีอุปกรณ์', 'ไม่มีอุปกรณ์ที่พร้อมใช้งาน');
            return;
        }

        if (soldiersList.length === 0) {
            app.showToast('warning', 'ไม่มีข้อมูล', 'กรุณาเพิ่มข้อมูลกำลังพลก่อน');
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        const content = `
            <form id="borrow-form">
                <div class="form-group">
                    <label class="form-label required">อุปกรณ์</label>
                    <select class="form-select" name="equipmentId" required onchange="equipment.updateMaxQuantity(this)">
                        <option value="">-- เลือกอุปกรณ์ --</option>
                        ${equipmentList.map(e => `<option value="${e.id}" data-max="${e.quantity}">${e.name} (${e.quantity} ${e.unit})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label required">ผู้เบิก</label>
                    <select class="form-select" name="soldierId" required>
                        <option value="">-- เลือกกำลังพล --</option>
                        ${soldiersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">จำนวน</label>
                        <input type="number" class="form-input" name="quantity" id="borrow-quantity" required min="1" value="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">กำหนดคืน</label>
                        <input type="date" class="form-input" name="expectedReturn" value="${today}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">หมายเหตุ</label>
                    <textarea class="form-textarea" name="note" rows="2" placeholder="วัตถุประสงค์การเบิก"></textarea>
                </div>
            </form>
        `;

        app.showModal('เบิกอุปกรณ์', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'เบิก', class: 'btn-primary', onclick: 'equipment.handleBorrow()' }
        ]);
    },

    /**
     * Update max quantity based on selected equipment
     * @param {HTMLSelectElement} select - Select element
     */
    updateMaxQuantity(select) {
        const option = select.options[select.selectedIndex];
        const max = option.dataset.max || 1;
        const quantityInput = document.getElementById('borrow-quantity');
        if (quantityInput) {
            quantityInput.max = max;
            if (parseInt(quantityInput.value) > parseInt(max)) {
                quantityInput.value = max;
            }
        }
    },

    /**
     * Handle borrow form submission
     */
    handleBorrow() {
        const form = document.getElementById('borrow-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            this.borrow(data);
            app.showToast('success', 'เบิกสำเร็จ', 'บันทึกการเบิกอุปกรณ์เรียบร้อยแล้ว');
            app.closeModal();
            this.render();
        } catch (error) {
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
        }
    },

    /**
     * Show return modal
     * @param {string} logId - Borrow log ID
     */
    showReturnModal(logId) {
        const log = storage.getById(storage.KEYS.EQUIPMENT_LOG, logId);
        if (!log) return;

        const equip = this.getById(log.equipmentId);
        const soldier = soldiers.getById(log.soldierId);

        const content = `
            <div class="card-body">
                <div class="card-info">
                    <i class="ph ph-package"></i>
                    <span>${equip?.name || '-'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-user"></i>
                    <span>${soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : '-'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-hash"></i>
                    <span>จำนวน: ${log.quantity} ${equip?.unit || 'ชิ้น'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-calendar"></i>
                    <span>เบิกเมื่อ: ${new Date(log.date).toLocaleDateString('th-TH')}</span>
                </div>
            </div>
            <form id="return-form">
                <div class="form-group">
                    <label class="form-label">หมายเหตุการคืน</label>
                    <textarea class="form-textarea" name="note" rows="2" placeholder="สภาพอุปกรณ์, หมายเหตุ"></textarea>
                </div>
            </form>
        `;

        app.showModal('คืนอุปกรณ์', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ยืนยันคืน', class: 'btn-success', onclick: `equipment.handleReturn('${logId}')` }
        ]);
    },

    /**
     * Handle return
     * @param {string} logId - Borrow log ID
     */
    handleReturn(logId) {
        const form = document.getElementById('return-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            this.return(logId, data);
            app.showToast('success', 'คืนสำเร็จ', 'บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว');
            app.closeModal();
            this.render();
        } catch (error) {
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
        }
    },

    /**
     * Confirm delete
     * @param {string} id - Equipment ID
     */
    confirmDelete(id) {
        const record = this.getById(id);
        if (!record) return;

        app.showConfirm(
            'ยืนยันการลบ',
            `คุณต้องการลบอุปกรณ์ "${record.name}" หรือไม่?`,
            () => {
                this.delete(id);
                app.showToast('success', 'ลบสำเร็จ', 'ลบอุปกรณ์เรียบร้อยแล้ว');
                this.render();
            }
        );
    },

    /**
     * Render equipment page
     */
    render() {
        const container = document.getElementById('equipment-grid');
        if (!container) return;

        let data = [];

        switch (this.currentTab) {
            case 'inventory':
                data = this.getAll();
                this.renderInventory(container, data);
                break;
            case 'borrowed':
                data = this.getActiveBorrows();
                this.renderBorrowed(container, data);
                break;
            case 'history':
                data = this.getLogs();
                this.renderHistory(container, data);
                break;
        }
    },

    /**
     * Render inventory grid
     * @param {HTMLElement} container - Container element
     * @param {Array} data - Equipment list
     */
    renderInventory(container, data) {
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="ph ph-toolbox"></i>
                    <p>ยังไม่มีอุปกรณ์</p>
                    <button class="btn btn-primary mt-2" onclick="equipment.showAddForm()">
                        <i class="ph ph-plus"></i>
                        เพิ่มอุปกรณ์
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = data.map(e => `
            <div class="equipment-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${e.name}</div>
                        <div class="card-subtitle">${e.equipmentId}</div>
                    </div>
                    ${this.renderStatusBadge(e.status)}
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <i class="ph ph-tag"></i>
                        <span>${this.CATEGORIES[e.category] || e.category}</span>
                    </div>
                    <div class="card-info">
                        <i class="ph ph-stack"></i>
                        <span>${e.quantity} ${e.unit}</span>
                    </div>
                    <div class="card-info">
                        <i class="ph ph-map-pin"></i>
                        <span>${e.location || '-'}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-outline" onclick="equipment.showEditForm('${e.id}')">
                        <i class="ph ph-pencil"></i>
                    </button>
                    <button class="btn btn-danger" onclick="equipment.confirmDelete('${e.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render borrowed items
     * @param {HTMLElement} container - Container element
     * @param {Array} data - Borrow logs
     */
    renderBorrowed(container, data) {
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="ph ph-check-circle"></i>
                    <p>ไม่มีอุปกรณ์ที่ถูกเบิก</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.map(log => {
            const equip = this.getById(log.equipmentId);
            const soldier = soldiers.getById(log.soldierId);
            const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : '-';

            return `
                <div class="equipment-card">
                    <div class="card-header">
                        <div class="card-title">${equip?.name || '-'}</div>
                        <span class="badge badge-warning">เบิกไป</span>
                    </div>
                    <div class="card-body">
                        <div class="card-info">
                            <i class="ph ph-user"></i>
                            <span>${soldierName}</span>
                        </div>
                        <div class="card-info">
                            <i class="ph ph-stack"></i>
                            <span>${log.quantity} ${equip?.unit || 'ชิ้น'}</span>
                        </div>
                        <div class="card-info">
                            <i class="ph ph-calendar"></i>
                            <span>เบิก: ${new Date(log.date).toLocaleDateString('th-TH')}</span>
                        </div>
                        ${log.expectedReturn ? `
                        <div class="card-info">
                            <i class="ph ph-calendar-check"></i>
                            <span>กำหนดคืน: ${new Date(log.expectedReturn).toLocaleDateString('th-TH')}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-success" onclick="equipment.showReturnModal('${log.id}')" style="width: 100%;">
                            <i class="ph ph-arrow-u-up-left"></i>
                            คืน
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render history
     * @param {HTMLElement} container - Container element
     * @param {Array} data - All logs
     */
    renderHistory(container, data) {
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="ph ph-clock-counter-clockwise"></i>
                    <p>ไม่มีประวัติการเบิก-คืน</p>
                </div>
            `;
            return;
        }

        // Sort by date descending
        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = data.slice(0, 20).map(log => {
            const equip = this.getById(log.equipmentId);
            const soldier = soldiers.getById(log.soldierId);
            const soldierName = soldier ? `${soldier.rank || ''} ${soldier.firstName || ''}`.trim() : '-';
            const isReturned = !!log.returnDate;

            return `
                <div class="equipment-card">
                    <div class="card-header">
                        <div class="card-title">${equip?.name || '-'}</div>
                        ${isReturned ?
                    '<span class="badge badge-success">คืนแล้ว</span>' :
                    '<span class="badge badge-warning">ยังไม่คืน</span>'
                }
                    </div>
                    <div class="card-body">
                        <div class="card-info">
                            <i class="ph ph-user"></i>
                            <span>${soldierName}</span>
                        </div>
                        <div class="card-info">
                            <i class="ph ph-arrow-right"></i>
                            <span>เบิก: ${new Date(log.date).toLocaleDateString('th-TH')}</span>
                        </div>
                        ${isReturned ? `
                        <div class="card-info">
                            <i class="ph ph-arrow-u-up-left"></i>
                            <span>คืน: ${new Date(log.returnDate).toLocaleDateString('th-TH')}</span>
                        </div>
                        ` : ''}
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
            available: '<span class="badge badge-success">พร้อมใช้</span>',
            borrowed: '<span class="badge badge-warning">ถูกเบิก</span>',
            maintenance: '<span class="badge badge-info">ซ่อมบำรุง</span>',
            damaged: '<span class="badge badge-danger">ชำรุด</span>',
            disposed: '<span class="badge badge-neutral">จำหน่าย</span>'
        };
        return badges[status] || badges.available;
    }
};
