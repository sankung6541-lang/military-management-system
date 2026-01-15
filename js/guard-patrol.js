/**
 * Guard Patrol Module - ระบบรายงานเวรตรวจจุดป้อม
 * สำหรับบันทึกการตรวจจุดป้อมยามกลางคืน วังไกลกังวล
 */

const guardPatrol = {
    // จุดตรวจ/ป้อม - พระราชวังไกลกังวล หัวหิน
    CHECKPOINTS: {
        // ประตูทางเข้า
        'CP01': { name: 'ประตูหลัก (ถ.เพชรเกษม)', zone: 'ทางเข้า', order: 1 },
        'CP02': { name: 'ประตูค่ายนเรศวร', zone: 'ทางเข้า', order: 2 },
        // พื้นที่ชายหาด
        'CP03': { name: 'หาดเหนือ', zone: 'ชายหาด', order: 3 },
        'CP04': { name: 'หาดใต้', zone: 'ชายหาด', order: 4 },
        'CP05': { name: 'แนวรั้วริมหาด', zone: 'ชายหาด', order: 5 },
        // มุมรั้วรอบพระราชวัง
        'CP06': { name: 'มุมรั้วตะวันออกเฉียงเหนือ', zone: 'รอบนอก', order: 6 },
        'CP07': { name: 'มุมรั้วตะวันออกเฉียงใต้', zone: 'รอบนอก', order: 7 },
        'CP08': { name: 'มุมรั้วตะวันตกเฉียงเหนือ', zone: 'รอบนอก', order: 8 },
        'CP09': { name: 'มุมรั้วตะวันตกเฉียงใต้', zone: 'รอบนอก', order: 9 },
        // พื้นที่ภายใน
        'CP10': { name: 'บริเวณสวนภายใน', zone: 'พื้นที่ภายใน', order: 10 },
        'CP11': { name: 'เขตพระตำหนัก', zone: 'พื้นที่ภายใน', order: 11 },
        'CP12': { name: 'จุดเฝ้าระวังทางทะเล', zone: 'ชายหาด', order: 12 }
    },

    // ผลัดเวร
    SHIFTS: {
        'shift1': { name: 'ผลัดที่ 1 (18:00-22:00)', start: '18:00', end: '22:00', roundsRequired: 2 },
        'shift2': { name: 'ผลัดที่ 2 (22:00-02:00)', start: '22:00', end: '02:00', roundsRequired: 2 },
        'shift3': { name: 'ผลัดที่ 3 (02:00-06:00)', start: '02:00', end: '06:00', roundsRequired: 2 }
    },

    // สถานะการตรวจ
    STATUS: {
        'normal': { name: 'ปกติ', icon: 'check-circle', color: 'success' },
        'issue': { name: 'พบปัญหา', icon: 'warning', color: 'warning' },
        'urgent': { name: 'เร่งด่วน', icon: 'x-circle', color: 'danger' }
    },

    currentTab: 'today',
    selectedDate: new Date().toISOString().split('T')[0],

    /**
     * Initialize module
     */
    init() {
        this.bindEvents();
        this.render();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab switching
        document.querySelectorAll('#page-patrol .tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Date change
        const dateInput = document.getElementById('patrol-date');
        if (dateInput) {
            dateInput.value = this.selectedDate;
            dateInput.addEventListener('change', (e) => {
                this.selectedDate = e.target.value;
                this.render();
            });
        }
    },

    /**
     * Switch tab
     */
    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('#page-patrol .tabs .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        this.render();
    },

    /**
     * Get all patrol records
     */
    getAll() {
        return storage.getAll(storage.KEYS.GUARD_PATROL) || [];
    },

    /**
     * Get records by date
     */
    getByDate(date) {
        return this.getAll().filter(r => r.date === date);
    },

    /**
     * Get current shift based on time
     */
    getCurrentShift() {
        const now = new Date();
        const hour = now.getHours();

        if (hour >= 18 && hour < 22) return 'shift1';
        if (hour >= 22 || hour < 2) return 'shift2';
        if (hour >= 2 && hour < 6) return 'shift3';
        return 'shift1'; // Default
    },

    /**
     * Add patrol record
     */
    add(data) {
        const now = new Date();
        const record = {
            ...data,
            id: storage.generateId(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };

        const added = storage.add(storage.KEYS.GUARD_PATROL, record);

        // Log activity
        const checkpoint = this.CHECKPOINTS[data.checkpointId];
        storage.logActivity('add', 'guard_patrol', {
            summary: `ตรวจ ${checkpoint?.name || data.checkpointId}`
        });

        // Upload to API
        api.uploadItem('guardPatrol', added);

        return added;
    },

    /**
     * Delete patrol record
     */
    delete(id) {
        const success = storage.delete(storage.KEYS.GUARD_PATROL, id);
        if (success) {
            api.deleteItem('GuardPatrol', id);
        }
        return success;
    },

    /**
     * Get statistics for date
     */
    getStats(date) {
        const records = this.getByDate(date);
        const totalCheckpoints = Object.keys(this.CHECKPOINTS).length;
        const checkedPoints = [...new Set(records.map(r => r.checkpointId))];

        return {
            total: records.length,
            checked: checkedPoints.length,
            remaining: totalCheckpoints - checkedPoints.length,
            percentComplete: Math.round((checkedPoints.length / totalCheckpoints) * 100),
            normalCount: records.filter(r => r.status === 'normal').length,
            issueCount: records.filter(r => r.status === 'issue').length,
            urgentCount: records.filter(r => r.status === 'urgent').length
        };
    },

    // Location data
    currentLocation: null,

    /**
     * Get current location with enhanced permission handling
     */
    async initLocation() {
        this.currentLocation = null;
        const statusEl = document.getElementById('gps-status');
        if (!statusEl) return;

        if (!navigator.geolocation) {
            statusEl.innerHTML = '<span class="status-badge danger"><i class="ph ph-x-circle"></i> ไม่รองรับ GPS</span>';
            return;
        }

        // Check Permissions API if available
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                if (result.state === 'denied') {
                    this.showGPSError(statusEl, { code: 1, message: 'ถูกปิดกั้นสิทธิ์' });
                    return;
                }
            } catch (e) {
                console.log('Permission API not supported');
            }
        }

        statusEl.innerHTML = `
            <span class="status-badge warning">
                <i class="ph ph-spinner ph-spin"></i> กำลังค้นหา...
            </span>
        `;

        // Use watchPosition for better accuracy over time
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                // Success
                const accuracy = position.coords.accuracy; // in meters

                this.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: accuracy
                };

                let accuracyBadge = '';
                let statusClass = 'warning';
                let statusText = 'สัญญาณอ่อน';
                let icon = 'warning';
                let canSave = false;

                // Accuracy Logic - Stricter Thresholds
                if (accuracy <= 30) {
                    statusClass = 'success';
                    statusText = 'พิกัดแม่นยำสูงสุด';
                    icon = 'crosshair-simple';
                    accuracyBadge = `<span class="text-success" style="font-weight:bold">Excellent (+/- ${Math.round(accuracy)}ม.)</span>`;
                    canSave = true;
                } else if (accuracy <= 70) {
                    statusClass = 'success';
                    statusText = 'พิกัดใช้ได้';
                    icon = 'map-pin';
                    accuracyBadge = `<span class="text-success">(+/- ${Math.round(accuracy)}ม.)</span>`;
                    canSave = true;
                } else {
                    statusClass = 'warning';
                    statusText = 'ปรับปรุงสัญญาณ...';
                    icon = 'spinner ph-spin';
                    accuracyBadge = `<span class="text-danger" style="font-weight:bold">Wait... (+/- ${Math.round(accuracy)}ม.)</span>`;
                    canSave = false;
                }

                statusEl.innerHTML = `
                    <div class="gps-success">
                        <span class="status-badge ${statusClass}" onclick="window.open('https://maps.google.com/?q=${this.currentLocation.lat},${this.currentLocation.lng}', '_blank')">
                            <i class="ph ph-${icon}"></i> ${statusText}
                        </span>
                        <div class="gps-details">
                            <span class="gps-coords">${this.currentLocation.lat.toFixed(6)}, ${this.currentLocation.lng.toFixed(6)}</span>
                            <span class="gps-accuracy">${accuracyBadge}</span>
                        </div>
                        ${!canSave ? `
                            <div style="margin-top:5px; font-size:12px;" class="text-danger">⚠️ ความคลาดเคลื่อนสูงเกินไป (${Math.round(accuracy)}ม.)</div>
                            <div style="margin-top:2px;">
                                <a href="#" onclick="guardPatrol.forceEnableSave(); return false;" class="text-muted" style="font-size:11px; text-decoration:underline;">
                                    ยืนยันบันทึก (สำหรับทดสอบ/PC)
                                </a>
                            </div>
                        ` : ''}
                    </div>
                `;

                // Control Save Button
                const saveBtn = document.getElementById('btn-save-patrol');
                if (saveBtn) {
                    if (canSave) {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = '<i class="ph ph-check"></i> บันทึก';
                        saveBtn.classList.remove('btn-disabled');
                    } else if (!saveBtn.hasAttribute('data-forced')) {
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> รอสัญญาณ GPS...';
                        saveBtn.classList.add('btn-disabled');
                    }
                }
            },
            (error) => {
                this.showGPSError(statusEl, error);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    },

    /**
     * Show GPS Error with Fix Guide
     */
    showGPSError(el, error) {
        console.error('GPS Error:', error);
        let msg = 'ไม่พบพิกัด';
        let guide = '';

        if (error.code === 1) { // PERMISSION_DENIED
            msg = 'ถูกปิดสิทธิ์ GPS';
            guide = `
                <div class="gps-guide">
                    <small class="text-danger">⚠️ กรุณาเปิดสิทธิ์:</small>
                    <button class="btn-xs btn-outline" onclick="alert('iOS: ไปที่ Settings > Privacy > Location Services > เปิดให้ Browser')">วิธีแก้ iOS</button>
                    <button class="btn-xs btn-outline" onclick="alert('Android: ไปที่ Browser Settings > Site settings > Location > Allow')">วิธีแก้ Android</button>
                </div>
            `;
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
            msg = 'สัญญาณอ่อน';
            guide = '<small class="text-muted">ลองออกไปพื้นที่โล่ง</small>';
        } else if (error.code === 3) { // TIMEOUT
            msg = 'หมดเวลาเชื่อมต่อ';
            guide = '<small class="text-muted">ลองกดค้นหาใหม่</small>';
        }

        el.innerHTML = `
            <div class="gps-error-container">
                <span class="status-badge danger" onclick="guardPatrol.initLocation()">
                    <i class="ph ph-arrow-counter-clockwise"></i> ${msg} (ลองใหม่)
                </span>
                ${guide}
            </div>
        `;
    },

    // Image data
    currentImage: null,

    /**
     * Handle image selection
     */
    handleImageSelect(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];

            // Define elements
            const btnUpload = document.getElementById('btn-upload');
            const originalText = btnUpload.innerHTML;

            // Show loading
            btnUpload.innerHTML = '<i class="ph ph-spinner ph-spin"></i> กำลังประมวลผล...';
            btnUpload.disabled = true;

            // Updated: High Quality for Drive (2048px, 0.9) - approx 500KB-1MB
            console.log('Starting image compression for file:', file.name, file.size);

            this.compressImage(file, 2048, 0.9).then(base64 => {
                console.log('Image compressed successfully. Size:', base64.length);
                this.currentImage = base64;

                // Show preview
                const previewDiv = document.getElementById('image-preview');
                const previewImg = document.getElementById('preview-img');

                previewImg.src = base64;
                previewDiv.classList.remove('hidden');
                btnUpload.classList.add('hidden');

                // Reset button state (for when it's shown again)
                btnUpload.innerHTML = originalText;
                btnUpload.disabled = false;
            }).catch(err => {
                console.error('Image compression failed', err);
                alert('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + err.message);
                btnUpload.innerHTML = originalText;
                btnUpload.disabled = false;
            });
        }
    },

    /**
     * Trigger file selection manually (Debug helper)
     */
    triggerImageSelect() {
        console.log('Triggering file input click...');
        const input = document.getElementById('patrol-image');
        if (input) {
            input.click();
        } else {
            alert('Error: File input element not found!');
            console.error('File input #patrol-image not found');
        }
    },

    /**
     * Remove selected image
     */
    removeImage() {
        this.currentImage = null;
        document.getElementById('patrol-image').value = '';
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('btn-upload').classList.remove('hidden');
    },

    /**
     * Compress image
     * @param {File} file - Image file
     * @param {number} maxWidth - Max width
     * @param {number} quality - Quality (0-1)
     * @returns {Promise<string>} Base64 string
     */
    compressImage(file, maxWidth, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    },

    /**
     * Show add form modal
     */
    showAddForm() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const currentDate = now.toISOString().split('T')[0];
        const currentShift = this.getCurrentShift();

        // Get soldiers for dropdown
        const soldiersOptions = soldiers.getForDropdown()
            .map(s => `<option value="${s.id}">${s.name}</option>`)
            .join('');

        // Get shifts for dropdown
        const shiftOptions = Object.entries(this.SHIFTS)
            .map(([id, s]) => `<option value="${id}" ${id === currentShift ? 'selected' : ''}>${s.name}</option>`)
            .join('');

        const modalBody = `
            <form id="patrol-form" class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">วันที่ <span class="required">*</span></label>
                        <input type="date" id="patrol-record-date" class="form-input" value="${currentDate}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">เวลา <span class="required">*</span></label>
                        <input type="time" id="patrol-time" class="form-input" value="${currentTime}" required>
                    </div>
                </div>
                
                <!-- GPS Location -->
                <div class="form-group">
                    <label class="form-label">พิกัด GPS <span class="required">*</span></label>
                    <div id="gps-status" class="gps-status-container">
                        <span class="status-badge pc-only">รอระบุพิกัด...</span>
                    </div>
                </div>

                <!-- Image Attachment -->
                <div class="form-group">
                    <label class="form-label">รูปภาพ (ถ้ามี)</label>
                    <div class="image-upload-container">
                        <input type="file" id="patrol-image" accept="image/*" capture="environment" hidden onchange="guardPatrol.handleImageSelect(this)">
                        
                        <div id="image-preview" class="image-preview hidden">
                            <img id="preview-img" src="" alt="Preview">
                            <button type="button" class="btn-remove-image" onclick="guardPatrol.removeImage()">
                                <i class="ph ph-x"></i>
                            </button>
                        </div>

                        <button type="button" class="btn-upload" onclick="guardPatrol.triggerImageSelect()" id="btn-upload">
                            <i class="ph ph-camera"></i>
                            <span>ถ่ายรูป / แนบรูป</span>
                        </button>
                    </div>
                    <div class="form-hint">ขนาดไม่เกิน 5MB (ระบบจะย่อให้อัตโนมัติ)</div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">ผลัด/เวร <span class="required">*</span></label>
                        <input type="text" id="patrol-shift" class="form-input" placeholder="เช่น ผลัด 1, เวรกลางคืน" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">รอบที่</label>
                        <input type="text" id="patrol-round" class="form-input" placeholder="เช่น 1, 2, 3" value="1">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">จุดตรวจ/ป้อม <span class="required">*</span></label>
                    <input type="text" id="patrol-checkpoint" class="form-input" placeholder="พิมพ์ชื่อจุดตรวจ เช่น ป้อม 1, หาดเหนือ" required>
                </div>
                <div class="form-group">
                    <label class="form-label">ผู้ตรวจ <span class="required">*</span></label>
                    <select id="patrol-guard" class="form-select" required>
                        <option value="">เลือกผู้ตรวจ</option>
                        ${soldiersOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">สถานะ <span class="required">*</span></label>
                    <div class="status-options">
                        <label class="status-option">
                            <input type="radio" name="patrol-status" value="normal" checked>
                            <span class="status-badge success">
                                <i class="ph ph-check-circle"></i> ปกติ
                            </span>
                        </label>
                        <label class="status-option">
                            <input type="radio" name="patrol-status" value="issue">
                            <span class="status-badge warning">
                                <i class="ph ph-warning"></i> พบปัญหา
                            </span>
                        </label>
                        <label class="status-option">
                            <input type="radio" name="patrol-status" value="urgent">
                            <span class="status-badge danger">
                                <i class="ph ph-x-circle"></i> เร่งด่วน
                            </span>
                        </label>
                    </div>
                </div>
                
                <!-- ส่วนรายงานหาด -->
                <div class="form-section-title">
                    <i class="ph ph-wave"></i> รายงานสถานะหาด
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">พื้นที่หาด</label>
                        <select id="patrol-beach-area" class="form-select">
                            <option value="">-- ไม่ระบุ --</option>
                            <option value="clean">สะอาด ปกติ</option>
                            <option value="dirty">มีขยะ/สิ่งปฏิกูล</option>
                            <option value="erosion">มีการกัดเซาะ</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">ระยะน้ำทะเล</label>
                        <input type="text" id="patrol-sea-distance" class="form-input" placeholder="เช่น 50 เมตร">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">นักท่องเที่ยว</label>
                        <select id="patrol-tourists" class="form-select">
                            <option value="none">ไม่มี</option>
                            <option value="few">เล็กน้อย (1-10)</option>
                            <option value="moderate">ปานกลาง (10-50)</option>
                            <option value="crowded">หนาแน่น (>50)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">กลุ่มประมง</label>
                        <select id="patrol-fishermen" class="form-select">
                            <option value="none">ไม่มี</option>
                            <option value="few">เล็กน้อย (1-5 ลำ)</option>
                            <option value="many">มาก (>5 ลำ)</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">หมายเหตุ/รายละเอียดเพิ่มเติม</label>
                    <textarea id="patrol-note" class="form-textarea" rows="3" placeholder="รายละเอียดการตรวจ สภาพอากาศ สิ่งผิดปกติ..."></textarea>
                </div>
            </form>
        `;

        app.showModal('บันทึกการตรวจจุดป้อม', modalBody, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'guardPatrol.stopLocationWatch(); app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: 'guardPatrol.handleSubmit()' }
        ]);

        // Start GPS Watch
        this.initLocation();
    },

    /**
     * Handle form submission
     */
    handleSubmit() {
        const date = document.getElementById('patrol-record-date')?.value;
        const time = document.getElementById('patrol-time')?.value;
        const shift = document.getElementById('patrol-shift')?.value;
        const round = document.getElementById('patrol-round')?.value;
        const checkpointName = document.getElementById('patrol-checkpoint')?.value?.trim();
        const guardId = document.getElementById('patrol-guard')?.value;
        const status = document.querySelector('input[name="patrol-status"]:checked')?.value;
        const note = document.getElementById('patrol-note')?.value;

        // Beach report fields
        const beachArea = document.getElementById('patrol-beach-area')?.value || '';
        const seaDistance = document.getElementById('patrol-sea-distance')?.value || '';
        const tourists = document.getElementById('patrol-tourists')?.value || 'none';
        const fishermen = document.getElementById('patrol-fishermen')?.value || 'none';

        if (!date || !time || !shift || !round || !checkpointName || !guardId || !status) {
            app.showToast('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่จำเป็น');
            return;
        }

        // Generate checkpoint ID from name
        const checkpointId = 'CP_' + checkpointName.replace(/\s+/g, '_').toUpperCase();

        this.add({
            date,
            time,
            shift,
            round: parseInt(round),
            checkpointId,
            checkpointName,
            zone: '',
            guardId,
            status,
            note,
            // GPS Data
            latitude: this.currentLocation ? this.currentLocation.lat : '',
            longitude: this.currentLocation ? this.currentLocation.lng : '',
            // Image Data
            images: this.currentImage || '',
            // Beach report data
            beachArea,
            seaDistance,
            tourists,
            fishermen
        });

        app.closeModal();
        this.stopLocationWatch(); // Stop GPS
        app.showToast('success', 'บันทึกสำเร็จ', `ตรวจ ${checkpointName} เรียบร้อย`);
        this.render();
        dashboard.refresh();
        calendar.init(); // Refresh calendar events

        // Reset image
        this.currentImage = null;
    },

    /**
     * Show quick patrol for multiple checkpoints
     */
    showQuickPatrol() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const currentDate = now.toISOString().split('T')[0];
        const currentShift = this.getCurrentShift();

        const soldiersOptions = soldiers.getForDropdown()
            .map(s => `<option value="${s.id}">${s.name}</option>`)
            .join('');

        const checkpointsList = Object.entries(this.CHECKPOINTS)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([id, cp]) => `
                <label class="checkpoint-check">
                    <input type="checkbox" name="quick-checkpoint" value="${id}">
                    <span class="checkpoint-label">
                        <i class="ph ph-map-pin"></i>
                        ${cp.name}
                    </span>
                </label>
            `).join('');

        const modalBody = `
            <form id="quick-patrol-form" class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">ผลัดเวร</label>
                        <select id="quick-shift" class="form-select">
                            ${Object.entries(this.SHIFTS).map(([id, s]) =>
            `<option value="${id}" ${id === currentShift ? 'selected' : ''}>${s.name}</option>`
        ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">รอบที่</label>
                        <select id="quick-round" class="form-select">
                            <option value="1">รอบที่ 1</option>
                            <option value="2">รอบที่ 2</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">ผู้ตรวจ</label>
                    <select id="quick-guard" class="form-select">
                        <option value="">เลือกผู้ตรวจ</option>
                        ${soldiersOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">เลือกจุดที่ตรวจแล้ว</label>
                    <div class="checkpoints-grid">
                        ${checkpointsList}
                    </div>
                </div>
            </form>
        `;

        app.showModal('บันทึกตรวจหลายจุด', modalBody, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึกทั้งหมด', class: 'btn-primary', onclick: 'guardPatrol.handleQuickSubmit()' }
        ]);
    },

    /**
     * Handle quick patrol submission
     */
    handleQuickSubmit() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);
        const shift = document.getElementById('quick-shift')?.value;
        const round = document.getElementById('quick-round')?.value;
        const guardId = document.getElementById('quick-guard')?.value;

        const checkboxes = document.querySelectorAll('input[name="quick-checkpoint"]:checked');
        const selectedCheckpoints = Array.from(checkboxes).map(cb => cb.value);

        if (!guardId || selectedCheckpoints.length === 0) {
            app.showToast('warning', 'ข้อมูลไม่ครบ', 'กรุณาเลือกผู้ตรวจและจุดตรวจ');
            return;
        }

        selectedCheckpoints.forEach(checkpointId => {
            const checkpoint = this.CHECKPOINTS[checkpointId];
            this.add({
                date,
                time,
                shift,
                round: parseInt(round),
                checkpointId,
                checkpointName: checkpoint?.name || checkpointId,
                zone: checkpoint?.zone || '',
                guardId,
                status: 'normal',
                note: ''
            });
        });

        app.closeModal();
        app.showToast('success', 'บันทึกสำเร็จ', `ตรวจ ${selectedCheckpoints.length} จุด เรียบร้อย`);
        this.render();
    },

    /**
     * Confirm delete
     */
    confirmDelete(id) {
        const record = storage.getById(storage.KEYS.GUARD_PATROL, id);
        if (!record) return;

        app.showModal('ยืนยันการลบ', `
            <div class="confirm-delete">
                <i class="ph ph-warning" style="color: var(--color-danger); font-size: 3rem;"></i>
                <p>ต้องการลบบันทึกการตรวจ ${record.checkpointName} ใช่หรือไม่?</p>
            </div>
        `, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ลบ', class: 'btn-danger', onclick: `guardPatrol.executeDelete('${id}')` }
        ]);
    },

    /**
     * Execute delete
     */
    executeDelete(id) {
        this.delete(id);
        app.closeModal();
        app.showToast('success', 'ลบสำเร็จ', 'ลบบันทึกแล้ว');
        this.render();
    },

    /**
     * Render patrol page
     */
    render() {
        const stats = this.getStats(this.selectedDate);
        this.updateStats(stats);
        this.renderCheckpointGrid();
        this.renderPatrolList();
    },

    /**
     * Update statistics display
     */
    updateStats(stats) {
        const elements = {
            'stat-patrol-checked': stats.checked,
            'stat-patrol-remaining': stats.remaining,
            'stat-patrol-issues': stats.issueCount,
            'stat-patrol-total': stats.total
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        // Update progress
        const progressEl = document.getElementById('patrol-progress');
        if (progressEl) {
            progressEl.style.width = `${stats.percentComplete}%`;
        }

        const percentEl = document.getElementById('patrol-percent');
        if (percentEl) {
            percentEl.textContent = `${stats.percentComplete}%`;
        }
    },

    /**
     * Render checkpoint grid
     */
    renderCheckpointGrid() {
        const container = document.getElementById('checkpoint-grid');
        if (!container) return;

        const records = this.getByDate(this.selectedDate);
        const checkedPoints = records.reduce((acc, r) => {
            acc[r.checkpointId] = r;
            return acc;
        }, {});

        container.innerHTML = Object.entries(this.CHECKPOINTS)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([id, cp]) => {
                const record = checkedPoints[id];
                const isChecked = !!record;
                const status = record?.status || 'unchecked';
                const statusInfo = this.STATUS[status] || { icon: 'circle', color: 'default' };

                return `
                    <div class="checkpoint-card ${isChecked ? 'checked' : ''} ${status}">
                        <div class="checkpoint-icon">
                            <i class="ph ph-${isChecked ? statusInfo.icon : 'map-pin'}"></i>
                        </div>
                        <div class="checkpoint-info">
                            <span class="checkpoint-name">${cp.name}</span>
                            <span class="checkpoint-zone">${cp.zone}</span>
                        </div>
                        ${isChecked ? `
                            <div class="checkpoint-time">
                                <i class="ph ph-clock"></i>
                                ${record.time}
                            </div>
                        ` : `
                            <button class="btn btn-sm btn-outline" onclick="guardPatrol.quickCheck('${id}')">
                                <i class="ph ph-check"></i>
                            </button>
                        `}
                    </div>
                `;
            }).join('');
    },

    /**
     * Quick check a checkpoint
     */
    quickCheck(checkpointId) {
        const now = new Date();
        const checkpoint = this.CHECKPOINTS[checkpointId];

        // Get first soldier as default
        const allSoldiers = soldiers.getForDropdown();
        const defaultGuard = allSoldiers[0]?.id || '';

        this.add({
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().slice(0, 5),
            shift: this.getCurrentShift(),
            round: 1,
            checkpointId,
            checkpointName: checkpoint?.name || checkpointId,
            zone: checkpoint?.zone || '',
            guardId: defaultGuard,
            status: 'normal',
            note: ''
        });

        app.showToast('success', 'บันทึกสำเร็จ', `ตรวจ ${checkpoint?.name} เรียบร้อย`);
        this.render();
    },

    /**
     * Render patrol list
     */
    renderPatrolList() {
        const container = document.getElementById('patrol-list');
        if (!container) return;

        const records = this.getByDate(this.selectedDate)
            .sort((a, b) => b.time.localeCompare(a.time));

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-shield-warning"></i>
                    <p>ยังไม่มีบันทึกการตรวจ</p>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(r => {
            const guard = soldiers.getById(r.guardId);
            const guardName = guard ? `${guard.rank || ''} ${guard.firstName || ''}`.trim() : 'ไม่ระบุ';
            const shiftInfo = this.SHIFTS[r.shift];
            const statusInfo = this.STATUS[r.status] || { icon: 'circle', color: 'default' };

            return `
                <div class="patrol-card status-${r.status}">
                    <div class="patrol-header">
                        <div class="patrol-checkpoint">
                            <i class="ph ph-map-pin"></i>
                            <span>${r.checkpointName}</span>
                        </div>
                        <span class="badge ${statusInfo.color}">
                            <i class="ph ph-${statusInfo.icon}"></i>
                            ${this.STATUS[r.status]?.name || r.status}
                        </span>
                    </div>
                    <div class="patrol-details">
                        <div class="patrol-detail">
                            <i class="ph ph-clock"></i>
                            <span>${r.time}</span>
                        </div>
                        <div class="patrol-detail">
                            <i class="ph ph-calendar"></i>
                            <span>${shiftInfo?.name || r.shift} รอบ ${r.round}</span>
                        </div>
                        <div class="patrol-detail">
                            <i class="ph ph-user"></i>
                            <span>${guardName}</span>
                        </div>
                    </div>
                    ${r.note ? `<div class="patrol-note">${r.note}</div>` : ''}
                    <div class="patrol-actions">
                        <button class="btn btn-sm btn-outline" onclick="guardPatrol.confirmDelete('${r.id}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Format date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: '2-digit'
        });
    }
};
