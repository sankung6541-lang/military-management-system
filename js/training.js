/**
 * Training Module - Training Management
 * Handles training records for soldiers
 */

const training = {
    // Training status options
    STATUS: {
        upcoming: 'กำหนดการ',
        ongoing: 'กำลังดำเนินการ',
        completed: 'เสร็จสิ้น',
        cancelled: 'ยกเลิก'
    },

    currentTab: 'ongoing',

    /**
     * Initialize training module
     */
    init() {
        this.bindEvents();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab switching
        document.querySelectorAll('#page-training .tab').forEach(tab => {
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

        // Update tab UI
        document.querySelectorAll('#page-training .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        this.render();
    },

    /**
     * Get all training records
     * @returns {Array} Training records
     */
    getAll() {
        return storage.getAll(storage.KEYS.TRAINING);
    },

    /**
     * Get training by ID
     * @param {string} id - Training ID
     * @returns {Object|null} Training record
     */
    getById(id) {
        return storage.getById(storage.KEYS.TRAINING, id);
    },

    /**
     * Get training by status
     * @param {string} status - Status filter
     * @returns {Array} Filtered training records
     */
    getByStatus(status) {
        const all = this.getAll();
        const today = new Date().toISOString().split('T')[0];

        switch (status) {
            case 'ongoing':
                return all.filter(t => t.startDate <= today && t.endDate >= today && t.status !== 'cancelled');
            case 'upcoming':
                return all.filter(t => t.startDate > today && t.status !== 'cancelled');
            case 'completed':
                return all.filter(t => t.endDate < today || t.status === 'completed');
            default:
                return all;
        }
    },

    /**
     * Add new training
     * @param {Object} data - Training data
     * @returns {Object} Added training
     */
    add(data) {
        const record = {
            trainingId: this.generateId(),
            trainingName: data.trainingName,
            description: data.description || '',
            startDate: data.startDate,
            endDate: data.endDate,
            location: data.location || '',
            instructor: data.instructor || '',
            participants: data.participants || [],
            status: data.status || 'upcoming',
            result: data.result || '',
            certificate: data.certificate || false
        };

        const added = storage.add(storage.KEYS.TRAINING, record);
        api.uploadItem('training', added);
        return added;
    },

    /**
     * Update training
     * @param {string} id - Training ID
     * @param {Object} data - Updated data
     * @returns {Object|null} Updated training
     */
    update(id, data) {
        const updated = storage.update(storage.KEYS.TRAINING, id, data);
        if (updated) {
            api.updateItem('training', updated);
        }
        return updated;
    },

    /**
     * Delete training
     * @param {string} id - Training ID
     * @returns {boolean} Success status
     */
    delete(id) {
        const success = storage.delete(storage.KEYS.TRAINING, id);
        if (success) {
            api.deleteItem('training', id);
        }
        return success;
    },

    /**
     * Generate training ID
     * @returns {string} Training ID
     */
    generateId() {
        const year = new Date().getFullYear().toString().slice(-2);
        const count = this.getAll().length + 1;
        return `T${year}${count.toString().padStart(4, '0')}`;
    },

    /**
     * Show add form modal
     */
    showAddForm() {
        const soldiersList = soldiers.getForDropdown();
        const today = new Date().toISOString().split('T')[0];

        const content = `
            <form id="training-form">
                <div class="form-group">
                    <label class="form-label required">ชื่อการฝึก</label>
                    <input type="text" class="form-input" name="trainingName" required placeholder="ระบุชื่อการฝึก">
                </div>
                <div class="form-group">
                    <label class="form-label">รายละเอียด</label>
                    <textarea class="form-textarea" name="description" rows="2" placeholder="รายละเอียดการฝึก"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">วันเริ่มต้น</label>
                        <input type="date" class="form-input" name="startDate" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">วันสิ้นสุด</label>
                        <input type="date" class="form-input" name="endDate" required value="${today}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">สถานที่</label>
                        <input type="text" class="form-input" name="location" placeholder="สถานที่ฝึก">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ผู้ฝึก/วิทยากร</label>
                        <input type="text" class="form-input" name="instructor" placeholder="ชื่อผู้ฝึก">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">ผู้เข้าร่วมฝึก</label>
                    <select class="form-select" name="participants" multiple size="5">
                        ${soldiersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                    <small style="color: var(--text-muted);">กด Ctrl + คลิก เพื่อเลือกหลายคน</small>
                </div>
            </form>
        `;

        app.showModal('เพิ่มการฝึกใหม่', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'training.handleSubmit()' }
        ]);
    },

    /**
     * Show edit form modal
     * @param {string} id - Training ID
     */
    showEditForm(id) {
        const record = this.getById(id);
        if (!record) {
            app.showToast('error', 'ไม่พบข้อมูล', '');
            return;
        }

        const soldiersList = soldiers.getForDropdown();
        const participants = record.participants || [];

        const content = `
            <form id="training-form" data-id="${id}">
                <div class="form-group">
                    <label class="form-label required">ชื่อการฝึก</label>
                    <input type="text" class="form-input" name="trainingName" required value="${record.trainingName || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">รายละเอียด</label>
                    <textarea class="form-textarea" name="description" rows="2">${record.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">วันเริ่มต้น</label>
                        <input type="date" class="form-input" name="startDate" required value="${record.startDate || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">วันสิ้นสุด</label>
                        <input type="date" class="form-input" name="endDate" required value="${record.endDate || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">สถานที่</label>
                        <input type="text" class="form-input" name="location" value="${record.location || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ผู้ฝึก/วิทยากร</label>
                        <input type="text" class="form-input" name="instructor" value="${record.instructor || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">สถานะ</label>
                        <select class="form-select" name="status">
                            <option value="upcoming" ${record.status === 'upcoming' ? 'selected' : ''}>กำหนดการ</option>
                            <option value="ongoing" ${record.status === 'ongoing' ? 'selected' : ''}>กำลังดำเนินการ</option>
                            <option value="completed" ${record.status === 'completed' ? 'selected' : ''}>เสร็จสิ้น</option>
                            <option value="cancelled" ${record.status === 'cancelled' ? 'selected' : ''}>ยกเลิก</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">ผลการฝึก</label>
                        <input type="text" class="form-input" name="result" value="${record.result || ''}" placeholder="ผล/คะแนน">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">ผู้เข้าร่วมฝึก</label>
                    <select class="form-select" name="participants" multiple size="5">
                        ${soldiersList.map(s => `<option value="${s.id}" ${participants.includes(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
            </form>
        `;

        app.showModal('แก้ไขการฝึก', content, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'training.handleSubmit()' }
        ]);
    },

    /**
     * Handle form submission
     */
    handleSubmit() {
        const form = document.getElementById('training-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const id = form.dataset.id;

        const data = {
            trainingName: formData.get('trainingName'),
            description: formData.get('description'),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            location: formData.get('location'),
            instructor: formData.get('instructor'),
            status: formData.get('status') || 'upcoming',
            result: formData.get('result'),
            participants: formData.getAll('participants')
        };

        try {
            if (id) {
                this.update(id, data);
                app.showToast('success', 'บันทึกสำเร็จ', 'แก้ไขการฝึกเรียบร้อยแล้ว');
            } else {
                this.add(data);
                app.showToast('success', 'บันทึกสำเร็จ', 'เพิ่มการฝึกใหม่เรียบร้อยแล้ว');
            }

            app.closeModal();
            this.render();
        } catch (error) {
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
        }
    },

    /**
     * Confirm delete
     * @param {string} id - Training ID
     */
    confirmDelete(id) {
        const record = this.getById(id);
        if (!record) return;

        app.showConfirm(
            'ยืนยันการลบ',
            `คุณต้องการลบการฝึก "${record.trainingName}" หรือไม่?`,
            () => {
                this.delete(id);
                app.showToast('success', 'ลบสำเร็จ', 'ลบการฝึกเรียบร้อยแล้ว');
                this.render();
            }
        );
    },

    /**
     * Render training list
     */
    render() {
        const records = this.getByStatus(this.currentTab);
        const container = document.getElementById('training-list');

        if (!container) return;

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="ph ph-target"></i>
                    <p>ไม่มีข้อมูลการฝึก</p>
                    <button class="btn btn-primary mt-2" onclick="training.showAddForm()">
                        <i class="ph ph-plus"></i>
                        เพิ่มการฝึก
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(t => `
            <div class="training-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${t.trainingName || '-'}</div>
                        <div class="card-subtitle">${t.trainingId || ''}</div>
                    </div>
                    ${this.renderStatusBadge(t)}
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <i class="ph ph-calendar"></i>
                        <span>${this.formatDateRange(t.startDate, t.endDate)}</span>
                    </div>
                    <div class="card-info">
                        <i class="ph ph-map-pin"></i>
                        <span>${t.location || '-'}</span>
                    </div>
                    <div class="card-info">
                        <i class="ph ph-user"></i>
                        <span>${t.instructor || '-'}</span>
                    </div>
                    <div class="card-info">
                        <i class="ph ph-users"></i>
                        <span>${t.participants?.length || 0} คน</span>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-outline" onclick="training.showEditForm('${t.id}')">
                        <i class="ph ph-pencil"></i>
                        แก้ไข
                    </button>
                    <button class="btn btn-danger" onclick="training.confirmDelete('${t.id}')">
                        <i class="ph ph-trash"></i>
                        ลบ
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render status badge
     * @param {Object} training - Training record
     * @returns {string} Badge HTML
     */
    renderStatusBadge(t) {
        const today = new Date().toISOString().split('T')[0];

        if (t.status === 'cancelled') {
            return '<span class="badge badge-neutral">ยกเลิก</span>';
        }
        if (t.status === 'completed' || t.endDate < today) {
            return '<span class="badge badge-success">เสร็จสิ้น</span>';
        }
        if (t.startDate <= today && t.endDate >= today) {
            return '<span class="badge badge-warning">กำลังดำเนินการ</span>';
        }
        return '<span class="badge badge-info">กำหนดการ</span>';
    },

    /**
     * Format date range
     * @param {string} start - Start date
     * @param {string} end - End date
     * @returns {string} Formatted range
     */
    formatDateRange(start, end) {
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        const startDate = new Date(start).toLocaleDateString('th-TH', options);
        const endDate = new Date(end).toLocaleDateString('th-TH', options);

        if (start === end) {
            return startDate;
        }
        return `${startDate} - ${endDate}`;
    },

    /**
     * Get ongoing training count
     * @returns {number} Count
     */
    getOngoingCount() {
        return this.getByStatus('ongoing').length;
    }
};
