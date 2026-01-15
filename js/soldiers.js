/**
 * Soldiers Module - Soldier Management
 * Handles CRUD operations for soldiers/personnel
 */

const soldiers = {
    // Thai military ranks
    RANKS: [
        'พลทหาร', 'สิบตรี', 'สิบโท', 'สิบเอก',
        'จ่าสิบตรี', 'จ่าสิบโท', 'จ่าสิบเอก',
        'ร้อยตรี', 'ร้อยโท', 'ร้อยเอก',
        'พันตรี', 'พันโท', 'พันเอก',
        'พลตรี', 'พลโท', 'พลเอก'
    ],

    // Blood types
    BLOOD_TYPES: ['A', 'B', 'AB', 'O'],

    // Status options
    STATUS: {
        active: 'ประจำการ',
        leave: 'ลา',
        training: 'ฝึก',
        inactive: 'ไม่ประจำการ'
    },

    /**
     * Initialize soldiers module
     */
    init() {
        this.bindEvents();
        this.populateFilters();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search
        const searchInput = document.getElementById('soldier-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAndRender();
            });
        }

        // Filters
        ['soldier-filter-rank', 'soldier-filter-unit', 'soldier-filter-status'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.filterAndRender());
            }
        });
    },

    /**
     * Populate filter dropdowns
     */
    populateFilters() {
        // Ranks filter
        const rankFilter = document.getElementById('soldier-filter-rank');
        if (rankFilter) {
            rankFilter.innerHTML = '<option value="">ยศทั้งหมด</option>';
            this.RANKS.forEach(rank => {
                rankFilter.innerHTML += `<option value="${rank}">${rank}</option>`;
            });
        }

        // Units filter - get unique units from data
        const soldiers = storage.getAll(storage.KEYS.SOLDIERS);
        const units = [...new Set(soldiers.map(s => s.unit).filter(Boolean))];

        const unitFilter = document.getElementById('soldier-filter-unit');
        if (unitFilter) {
            unitFilter.innerHTML = '<option value="">หน่วยทั้งหมด</option>';
            units.forEach(unit => {
                unitFilter.innerHTML += `<option value="${unit}">${unit}</option>`;
            });
        }
    },

    /**
     * Get all soldiers
     * @returns {Array} Soldiers list
     */
    getAll() {
        return storage.getAll(storage.KEYS.SOLDIERS);
    },

    /**
     * Get soldier by ID
     * @param {string} id - Soldier ID
     * @returns {Object|null} Soldier or null
     */
    getById(id) {
        return storage.getById(storage.KEYS.SOLDIERS, id);
    },

    /**
     * Add new soldier
     * @param {Object} data - Soldier data
     * @returns {Object} Added soldier
     */
    add(data) {
        const soldier = {
            soldierId: data.soldierId || this.generateSoldierId(),
            rank: data.rank,
            firstName: data.firstName,
            lastName: data.lastName,
            position: data.position || '',
            unit: data.unit || '',
            phone: data.phone || '',
            bloodType: data.bloodType || '',
            joinDate: data.joinDate || new Date().toISOString().split('T')[0],
            status: data.status || 'active'
        };

        const added = storage.add(storage.KEYS.SOLDIERS, soldier);

        // Sync to Google Sheets if connected
        api.uploadItem('soldiers', added);

        return added;
    },

    /**
     * Update soldier
     * @param {string} id - Soldier ID
     * @param {Object} data - Updated data
     * @returns {Object|null} Updated soldier
     */
    update(id, data) {
        const updated = storage.update(storage.KEYS.SOLDIERS, id, data);

        if (updated) {
            api.updateItem('soldiers', updated);
        }

        return updated;
    },

    /**
     * Delete soldier
     * @param {string} id - Soldier ID
     * @returns {boolean} Success status
     */
    delete(id) {
        const success = storage.delete(storage.KEYS.SOLDIERS, id);

        if (success) {
            api.deleteItem('soldiers', id);
        }

        return success;
    },

    /**
     * Generate soldier ID
     * @returns {string} Soldier ID
     */
    generateSoldierId() {
        const year = new Date().getFullYear().toString().slice(-2);
        const count = storage.getAll(storage.KEYS.SOLDIERS).length + 1;
        return `S${year}${count.toString().padStart(4, '0')}`;
    },

    /**
     * Filter and render soldiers
     */
    filterAndRender() {
        const searchQuery = document.getElementById('soldier-search')?.value || '';
        const rankFilter = document.getElementById('soldier-filter-rank')?.value || '';
        const unitFilter = document.getElementById('soldier-filter-unit')?.value || '';
        const statusFilter = document.getElementById('soldier-filter-status')?.value || '';

        let data = this.getAll();

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(s =>
                s.soldierId?.toLowerCase().includes(query) ||
                s.firstName?.toLowerCase().includes(query) ||
                s.lastName?.toLowerCase().includes(query) ||
                s.rank?.toLowerCase().includes(query) ||
                s.position?.toLowerCase().includes(query)
            );
        }

        // Apply filters
        if (rankFilter) {
            data = data.filter(s => s.rank === rankFilter);
        }
        if (unitFilter) {
            data = data.filter(s => s.unit === unitFilter);
        }
        if (statusFilter) {
            data = data.filter(s => s.status === statusFilter);
        }

        this.render(data);
    },

    /**
     * Render soldiers list - แยกกลุ่มนายทหารสัญญาบัตและประทวน/พลทหาร
     * @param {Array} data - Soldiers to render (optional)
     */
    render(data = null) {
        const allSoldiers = data || this.getAll();

        // แยกกลุ่มตามยศ
        const officerRanks = ['พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.',
            'พลเอก', 'พลโท', 'พลตรี', 'พันเอก', 'พันโท', 'พันตรี', 'ร้อยเอก', 'ร้อยโท', 'ร้อยตรี'];

        const officers = allSoldiers.filter(s => officerRanks.includes(s.rank));
        const enlisted = allSoldiers.filter(s => !officerRanks.includes(s.rank));

        // Render mobile cards with groups
        const cardsContainer = document.getElementById('soldiers-cards');
        if (cardsContainer) {
            if (allSoldiers.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="ph ph-users"></i>
                        <p>ยังไม่มีข้อมูลกำลังพล</p>
                        <button class="btn btn-primary mt-2" onclick="soldiers.showAddForm()">
                            <i class="ph ph-user-plus"></i>
                            เพิ่มกำลังพล
                        </button>
                    </div>
                `;
            } else {
                let html = '';

                // นายทหารสัญญาบัตร
                if (officers.length > 0) {
                    html += `
                        <div class="soldier-group">
                            <h3 class="soldier-group-title">
                                <i class="ph ph-star"></i>
                                นายทหารสัญญาบัตร (${officers.length} นาย)
                            </h3>
                            <div class="soldier-group-list">
                                ${officers.map(s => this.renderSoldierCard(s)).join('')}
                            </div>
                        </div>
                    `;
                }

                // นายประทวน + พลทหาร
                if (enlisted.length > 0) {
                    html += `
                        <div class="soldier-group">
                            <h3 class="soldier-group-title">
                                <i class="ph ph-users"></i>
                                นายประทวน / พลทหาร (${enlisted.length} นาย)
                            </h3>
                            <div class="soldier-group-list">
                                ${enlisted.map(s => this.renderSoldierCard(s)).join('')}
                            </div>
                        </div>
                    `;
                }

                cardsContainer.innerHTML = html;
            }
        }

        // Render table with groups
        const tbody = document.getElementById('soldiers-tbody');
        if (tbody) {
            if (allSoldiers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center" style="padding: 40px;">
                            <div class="empty-state">
                                <i class="ph ph-users"></i>
                                <p>ยังไม่มีข้อมูลกำลังพล</p>
                                <button class="btn btn-primary mt-2" onclick="soldiers.showAddForm()">
                                    <i class="ph ph-user-plus"></i>
                                    เพิ่มกำลังพล
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                let rows = '';

                // นายทหารสัญญาบัตร
                if (officers.length > 0) {
                    rows += `
                        <tr class="group-header-row">
                            <td colspan="6" style="background: var(--color-primary); color: white; padding: 10px 15px; font-weight: 600;">
                                <i class="ph ph-star"></i> นายทหารสัญญาบัตร (${officers.length} นาย)
                            </td>
                        </tr>
                    `;
                    rows += officers.map(s => this.renderSoldierRow(s)).join('');
                }

                // นายประทวน + พลทหาร
                if (enlisted.length > 0) {
                    rows += `
                        <tr class="group-header-row">
                            <td colspan="6" style="background: var(--color-secondary); color: white; padding: 10px 15px; font-weight: 600;">
                                <i class="ph ph-users"></i> นายประทวน / พลทหาร (${enlisted.length} นาย)
                            </td>
                        </tr>
                    `;
                    rows += enlisted.map(s => this.renderSoldierRow(s)).join('');
                }

                tbody.innerHTML = rows;
            }
        }
    },

    /**
     * Render single soldier card (mobile)
     */
    renderSoldierCard(s) {
        return `
            <div class="data-card" onclick="soldiers.showDetail('${s.id}')">
                <div class="data-card-header">
                    <span class="data-card-title">${s.rank || ''} ${s.firstName || ''} ${s.lastName || ''}</span>
                    ${this.renderStatusBadge(s.status)}
                </div>
                <div class="data-card-body">
                    <div class="data-card-row">
                        <span class="data-card-label">รหัส</span>
                        <span class="data-card-value">${s.soldierId || '-'}</span>
                    </div>
                    <div class="data-card-row">
                        <span class="data-card-label">ตำแหน่ง</span>
                        <span class="data-card-value">${s.position || '-'}</span>
                    </div>
                    <div class="data-card-row">
                        <span class="data-card-label">หน่วย</span>
                        <span class="data-card-value">${s.unit || '-'}</span>
                    </div>
                </div>
                <div class="data-card-actions">
                    <button class="btn btn-outline" onclick="event.stopPropagation(); soldiers.showEditForm('${s.id}')">
                        <i class="ph ph-pencil"></i>
                        แก้ไข
                    </button>
                    <button class="btn btn-danger" onclick="event.stopPropagation(); soldiers.confirmDelete('${s.id}')">
                        <i class="ph ph-trash"></i>
                        ลบ
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render single soldier row (table)
     */
    renderSoldierRow(s) {
        return `
            <tr>
                <td>${s.soldierId || '-'}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="user-avatar" style="width: 36px; height: 36px; font-size: 1rem;">
                            <i class="ph ph-user"></i>
                        </div>
                        <div>
                            <div style="font-weight: 500;">${s.rank || ''} ${s.firstName || ''} ${s.lastName || ''}</div>
                            <div style="font-size: 0.875rem; color: var(--text-muted);">${s.position || '-'}</div>
                        </div>
                    </div>
                </td>
                <td>${s.position || '-'}</td>
                <td>${s.unit || '-'}</td>
                <td>${this.renderStatusBadge(s.status)}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="icon-btn" onclick="soldiers.showDetail('${s.id}')" title="ดูรายละเอียด">
                            <i class="ph ph-eye"></i>
                        </button>
                        <button class="icon-btn" onclick="soldiers.showEditForm('${s.id}')" title="แก้ไข">
                            <i class="ph ph-pencil"></i>
                        </button>
                        <button class="icon-btn" onclick="soldiers.confirmDelete('${s.id}')" title="ลบ">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    },

    /**
     * Render status badge
     * @param {string} status - Status value
     * @returns {string} Badge HTML
     */
    renderStatusBadge(status) {
        const badges = {
            active: '<span class="badge badge-success">ประจำการ</span>',
            leave: '<span class="badge badge-warning">ลา</span>',
            training: '<span class="badge badge-info">ฝึก</span>',
            inactive: '<span class="badge badge-neutral">ไม่ประจำการ</span>'
        };
        return badges[status] || badges.active;
    },

    /**
     * Show add form modal
     */
    showAddForm() {
        const content = `
            <form id="soldier-form" onsubmit="soldiers.handleSubmit(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">ยศ</label>
                        <select class="form-select" name="rank" required>
                            <option value="">เลือกยศ</option>
                            ${this.RANKS.map(r => `<option value="${r}">${r}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">รหัสทหาร</label>
                        <input type="text" class="form-input" name="soldierId" placeholder="ระบบจะสร้างอัตโนมัติ">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">ชื่อ</label>
                        <input type="text" class="form-input" name="firstName" required placeholder="ชื่อ">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">นามสกุล</label>
                        <input type="text" class="form-input" name="lastName" required placeholder="นามสกุล">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">ตำแหน่ง</label>
                        <input type="text" class="form-input" name="position" placeholder="ตำแหน่ง">
                    </div>
                    <div class="form-group">
                        <label class="form-label">หน่วย</label>
                        <input type="text" class="form-input" name="unit" placeholder="หน่วย">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">เบอร์โทร</label>
                        <input type="tel" class="form-input" name="phone" placeholder="0xx-xxx-xxxx">
                    </div>
                    <div class="form-group">
                        <label class="form-label">กรุ๊ปเลือด</label>
                        <select class="form-select" name="bloodType">
                            <option value="">เลือกกรุ๊ปเลือด</option>
                            ${this.BLOOD_TYPES.map(b => `<option value="${b}">${b}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">วันที่เข้าประจำการ</label>
                        <input type="date" class="form-input" name="joinDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">สถานะ</label>
                        <select class="form-select" name="status">
                            <option value="active">ประจำการ</option>
                            <option value="leave">ลา</option>
                            <option value="training">ฝึก</option>
                            <option value="inactive">ไม่ประจำการ</option>
                        </select>
                    </div>
                </div>
            </form>
        `;

        app.showModal('เพิ่มกำลังพลใหม่', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'soldiers.submitForm()' }
        ]);
    },

    /**
     * Show edit form modal
     * @param {string} id - Soldier ID
     */
    showEditForm(id) {
        const soldier = this.getById(id);
        if (!soldier) {
            app.showToast('error', 'ไม่พบข้อมูล', 'ไม่พบข้อมูลกำลังพลที่ต้องการแก้ไข');
            return;
        }

        const content = `
            <form id="soldier-form" data-id="${id}" onsubmit="soldiers.handleSubmit(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">ยศ</label>
                        <select class="form-select" name="rank" required>
                            ${this.RANKS.map(r => `<option value="${r}" ${soldier.rank === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">รหัสทหาร</label>
                        <input type="text" class="form-input" name="soldierId" value="${soldier.soldierId || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">ชื่อ</label>
                        <input type="text" class="form-input" name="firstName" required value="${soldier.firstName || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">นามสกุล</label>
                        <input type="text" class="form-input" name="lastName" required value="${soldier.lastName || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">ตำแหน่ง</label>
                        <input type="text" class="form-input" name="position" value="${soldier.position || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">หน่วย</label>
                        <input type="text" class="form-input" name="unit" value="${soldier.unit || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">เบอร์โทร</label>
                        <input type="tel" class="form-input" name="phone" value="${soldier.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">กรุ๊ปเลือด</label>
                        <select class="form-select" name="bloodType">
                            <option value="">เลือกกรุ๊ปเลือด</option>
                            ${this.BLOOD_TYPES.map(b => `<option value="${b}" ${soldier.bloodType === b ? 'selected' : ''}>${b}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">วันที่เข้าประจำการ</label>
                        <input type="date" class="form-input" name="joinDate" value="${soldier.joinDate || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">สถานะ</label>
                        <select class="form-select" name="status">
                            <option value="active" ${soldier.status === 'active' ? 'selected' : ''}>ประจำการ</option>
                            <option value="leave" ${soldier.status === 'leave' ? 'selected' : ''}>ลา</option>
                            <option value="training" ${soldier.status === 'training' ? 'selected' : ''}>ฝึก</option>
                            <option value="inactive" ${soldier.status === 'inactive' ? 'selected' : ''}>ไม่ประจำการ</option>
                        </select>
                    </div>
                </div>
            </form>
        `;

        app.showModal('แก้ไขข้อมูลกำลังพล', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'soldiers.submitForm()' }
        ]);
    },

    /**
     * Show soldier detail
     * @param {string} id - Soldier ID
     */
    showDetail(id) {
        const soldier = this.getById(id);
        if (!soldier) {
            app.showToast('error', 'ไม่พบข้อมูล', 'ไม่พบข้อมูลกำลังพลที่ต้องการ');
            return;
        }

        const content = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div class="user-avatar" style="width: 80px; height: 80px; font-size: 2.5rem; margin: 0 auto;">
                    <i class="ph ph-user"></i>
                </div>
                <h3 style="margin-top: 15px;">${soldier.rank || ''} ${soldier.firstName || ''} ${soldier.lastName || ''}</h3>
                <p style="color: var(--text-secondary);">${soldier.position || '-'}</p>
                ${this.renderStatusBadge(soldier.status)}
            </div>
            
            <div class="card-body">
                <div class="card-info">
                    <i class="ph ph-identification-card"></i>
                    <span>รหัสทหาร: ${soldier.soldierId || '-'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-buildings"></i>
                    <span>หน่วย: ${soldier.unit || '-'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-phone"></i>
                    <span>เบอร์โทร: ${soldier.phone || '-'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-drop"></i>
                    <span>กรุ๊ปเลือด: ${soldier.bloodType || '-'}</span>
                </div>
                <div class="card-info">
                    <i class="ph ph-calendar"></i>
                    <span>เข้าประจำการ: ${soldier.joinDate ? new Date(soldier.joinDate).toLocaleDateString('th-TH') : '-'}</span>
                </div>
            </div>
        `;

        app.showModal('รายละเอียดกำลังพล', content, [
            { text: 'ปิด', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'แก้ไข', class: 'btn-primary', onclick: `app.closeModal(); soldiers.showEditForm('${id}')` }
        ]);
    },

    /**
     * Submit form
     */
    submitForm() {
        const form = document.getElementById('soldier-form');
        if (form && form.checkValidity()) {
            form.dispatchEvent(new Event('submit'));
        } else if (form) {
            form.reportValidity();
        }
    },

    /**
     * Handle form submission
     * @param {Event} e - Submit event
     */
    handleSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = form.dataset.id;

        try {
            if (id) {
                // Update
                this.update(id, data);
                app.showToast('success', 'บันทึกสำเร็จ', 'แก้ไขข้อมูลกำลังพลเรียบร้อยแล้ว');
            } else {
                // Add
                this.add(data);
                app.showToast('success', 'บันทึกสำเร็จ', 'เพิ่มกำลังพลใหม่เรียบร้อยแล้ว');
            }

            app.closeModal();
            this.render();
            this.populateFilters();
            dashboard.updateStats();
        } catch (error) {
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
        }
    },

    /**
     * Confirm delete
     * @param {string} id - Soldier ID
     */
    confirmDelete(id) {
        const soldier = this.getById(id);
        if (!soldier) return;

        app.showConfirm(
            'ยืนยันการลบ',
            `คุณต้องการลบข้อมูล ${soldier.rank || ''} ${soldier.firstName || ''} ${soldier.lastName || ''} หรือไม่?`,
            () => {
                this.delete(id);
                app.showToast('success', 'ลบสำเร็จ', 'ลบข้อมูลกำลังพลเรียบร้อยแล้ว');
                this.render();
                dashboard.updateStats();
            }
        );
    },

    /**
     * Get active soldiers count
     * @returns {number} Count
     */
    getActiveCount() {
        return this.getAll().filter(s => s.status === 'active').length;
    },

    /**
     * Get soldiers for dropdown
     * @returns {Array} Soldiers list with display name
     */
    getForDropdown() {
        return this.getAll()
            .filter(s => s.status === 'active')
            .map(s => ({
                id: s.id,
                soldierId: s.soldierId,
                name: `${s.rank || ''} ${s.firstName || ''} ${s.lastName || ''}`.trim()
            }));
    }
};
