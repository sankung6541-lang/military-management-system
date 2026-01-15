/**
 * Settings Module - Application Settings
 */

const settings = {
    // ==========================================
    // 🔧 CONFIGURATION (ตั้งค่าถาวร)
    // ใส่ค่าตรงนี้เพื่อไม่ต้องกรอกใหม่ทุกครั้ง
    // ==========================================
    CONFIG: {
        // 👇 ใส่ URL ของ Google Apps Script ที่ deploy แล้วตรงนี้
        GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxZQ_jdcPhU2QQGgDuiJUGGmXQbx7GM8cOVF-3prPlWJYT5bdxmmFKl4s7lnb2_gPV9/exec',

        LINE_TOKEN: 'GGgx9LygGLg2HBNeJa2p4TYolvy/tSL+ZHRPjcPTKuvFdqmHpk48XERWpI+MgSD6wb+QTXrBdw73Lz2/g6lzBgLmufyQPeRPb9lS8fyKikkSmWGtI/UgisE2T1Vka9JPGgiGzKM6L+PTFTxYYUJSuQdB04t89/1O/w1cDnyilFU=',
        LINE_DEST_ID: 'U9ef110d26032b7de7e7248254995c31f'
    },

    init() {
        this.loadSettings();
        this.updateSyncCounts();
    },

    loadSettings() {
        const saved = storage.getSettings();

        const apiUrlInput = document.getElementById('setting-api-url');
        const unitNameInput = document.getElementById('setting-unit-name');
        const workStartInput = document.getElementById('setting-work-start');
        const workEndInput = document.getElementById('setting-work-end');

        // LINE Messaging API Inputs
        const channelTokenInput = document.getElementById('setting-line-channel-token');
        const destIdInput = document.getElementById('setting-line-dest-id');

        // Use CONFIG URL if available, otherwise use saved
        const apiUrl = this.CONFIG.GOOGLE_APPS_SCRIPT_URL || saved.apiUrl || '';

        if (apiUrlInput) apiUrlInput.value = apiUrl;
        if (unitNameInput) unitNameInput.value = saved.unitName || '';
        if (workStartInput) workStartInput.value = saved.workStart || '08:00';
        if (workEndInput) workEndInput.value = saved.workEnd || '16:30';

        // Auto-set API URL in the api module
        if (apiUrl) {
            api.setUrl(apiUrl);
            storage.saveSettings({ apiUrl: apiUrl });
        }

        // Use Hardcoded Config if available, otherwise use Saved, otherwise Empty
        // Use Hardcoded Config if available, otherwise use Saved, otherwise Empty
        const token = this.CONFIG.LINE_TOKEN || saved.lineChannelToken || '';
        const destId = this.CONFIG.LINE_DEST_ID || saved.lineDestId || '';

        if (channelTokenInput) channelTokenInput.value = token;
        if (destIdInput) destIdInput.value = destId;

        // Auto-save Config to Storage to ensure API can access it
        if (this.CONFIG.LINE_TOKEN || this.CONFIG.LINE_DEST_ID) {
            storage.saveSettings({
                lineChannelToken: token,
                lineDestId: destId
            });
        }

        // Update last sync time
        this.updateLastSyncTime(saved.lastSync);
    },

    saveAll() {
        const apiUrl = document.getElementById('setting-api-url')?.value || '';
        const unitName = document.getElementById('setting-unit-name')?.value || '';
        const workStart = document.getElementById('setting-work-start')?.value || '08:00';
        const workEnd = document.getElementById('setting-work-end')?.value || '16:30';

        const lineChannelToken = document.getElementById('setting-line-channel-token')?.value || '';
        const lineDestId = document.getElementById('setting-line-dest-id')?.value || '';

        storage.saveSettings({ apiUrl, unitName, workStart, workEnd, lineChannelToken, lineDestId });
        api.setUrl(apiUrl);

        app.showToast('success', 'บันทึกสำเร็จ', 'บันทึกการตั้งค่าเรียบร้อยแล้ว');
    },

    /**
     * Test LINE Messaging API
     */
    async testLineMessage() {
        const token = document.getElementById('setting-line-channel-token')?.value;
        const destId = document.getElementById('setting-line-dest-id')?.value;

        if (!token || !destId) {
            app.showToast('warning', 'ข้อมูลไม่ครบ', 'กรุณาระบุ Channel Token และ ID ผู้รับให้ครบถ้วน');
            return;
        }

        // Auto-save settings immediately before testing
        // This ensures they are saved even if the test fails or page is refreshed
        const apiUrl = document.getElementById('setting-api-url')?.value || '';
        const unitName = document.getElementById('setting-unit-name')?.value || '';
        const workStart = document.getElementById('setting-work-start')?.value || '08:00';
        const workEnd = document.getElementById('setting-work-end')?.value || '16:30';
        storage.saveSettings({
            apiUrl,
            unitName,
            workStart,
            workEnd,
            lineChannelToken: token,
            lineDestId: destId
        });

        app.showLoading('กำลังทดสอบการส่งข้อความ...');
        try {
            await api.submitViaForm('testLineMessage', {
                channelToken: token,
                destId: destId
            });
            app.showToast('success', 'ส่งสำเร็จ', 'ส่งข้อความทดสอบไปที่ LINE แล้ว');
        } catch (error) {
            console.error('LINE Message test failed:', error);
            app.showToast('error', 'ส่งไม่สำเร็จ', 'เกิดข้อผิดพลาดในการส่งข้อความ');
        } finally {
            app.hideLoading();
        }
    },

    async testConnection() {
        const apiUrl = document.getElementById('setting-api-url')?.value;

        if (!apiUrl) {
            app.showToast('warning', 'กรุณาใส่ URL', 'กรุณาใส่ URL ของ Google Apps Script');
            return;
        }

        api.setUrl(apiUrl);
        app.showToast('info', 'กำลังทดสอบ...', 'กำลังทดสอบการเชื่อมต่อ');

        const connected = await api.testConnection();

        if (connected) {
            app.showToast('success', 'เชื่อมต่อสำเร็จ', 'เชื่อมต่อกับ Google Sheets สำเร็จ');
        } else {
            app.showToast('error', 'เชื่อมต่อไม่สำเร็จ', 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบ URL');
        }
    },

    exportData() {
        const data = storage.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `military-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        app.showToast('success', 'ส่งออกสำเร็จ', 'ดาวน์โหลดไฟล์ข้อมูลเรียบร้อยแล้ว');
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    storage.importData(data);
                    app.showToast('success', 'นำเข้าสำเร็จ', 'นำเข้าข้อมูลเรียบร้อยแล้ว');

                    // Refresh current page
                    app.navigateTo(app.currentPage);
                    this.updateSyncCounts();
                } catch (error) {
                    app.showToast('error', 'นำเข้าล้มเหลว', 'ไฟล์ไม่ถูกต้อง');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    },

    clearData() {
        app.showConfirm(
            'ยืนยันการล้างข้อมูล',
            'คุณต้องการล้างข้อมูลทั้งหมดหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้',
            () => {
                storage.clearAll();
                app.showToast('success', 'ล้างข้อมูลสำเร็จ', 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
                app.navigateTo('dashboard');
                this.updateSyncCounts();
            }
        );
    },

    /**
     * Update sync counts for each category - อัปเดตจำนวนข้อมูลแต่ละหมวด
     */
    updateSyncCounts() {
        const counts = {
            soldiers: storage.getAll(storage.KEYS.SOLDIERS).length,
            attendance: storage.getAll(storage.KEYS.ATTENDANCE).length,
            training: storage.getAll(storage.KEYS.TRAINING).length,
            leave: storage.getAll(storage.KEYS.LEAVE).length,
            equipment: storage.getAll(storage.KEYS.EQUIPMENT).length,
            movement: storage.getAll(storage.KEYS.MOVEMENT).length
        };

        // Update UI elements
        Object.entries(counts).forEach(([key, count]) => {
            const el = document.getElementById(`sync-count-${key}`);
            if (el) {
                el.textContent = `${count} รายการ`;
            }
        });
    },

    /**
     * Update last sync time display - แสดงเวลาซิงค์ล่าสุด
     */
    updateLastSyncTime(lastSync) {
        const el = document.getElementById('last-sync-time');
        if (!el) return;

        if (lastSync) {
            const date = new Date(lastSync);
            const options = {
                day: 'numeric',
                month: 'short',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
            el.textContent = date.toLocaleDateString('th-TH', options);
        } else {
            el.textContent = 'ยังไม่เคยซิงค์';
        }
    }
};
