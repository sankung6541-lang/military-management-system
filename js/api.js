/**
 * API Module - Google Sheets Integration
 * Uses form submission approach to avoid CORS issues
 * Supports syncing by category: Soldiers, Attendance, Training, Leave, Equipment, Movement
 */

const api = {
    baseUrl: '',
    isConnected: false,
    isSyncing: false,

    // Sheet names mapping - แยกหมวดหมู่ชัดเจน
    SHEETS: {
        SOLDIERS: 'Soldiers',           // กำลังพล (รวม)
        OFFICERS: 'Officers',           // นายทหารสัญญาบัตร
        ENLISTED: 'Enlisted',           // นายประทวน + พลทหาร
        ATTENDANCE: 'Attendance',       // ลงเวลา
        TRAINING: 'Training',           // ฝึกอบรม
        LEAVE: 'Leave',                 // การลา
        EQUIPMENT: 'Equipment',         // อุปกรณ์
        EQUIPMENT_LOG: 'EquipmentLog',  // ประวัติเบิก-คืน
        MOVEMENT: 'Movement',           // เข้าออกหน่วย
        GUARD_PATROL: 'GuardPatrol'     // ตรวจป้อม
    },

    // Thai names for display
    SHEET_NAMES_TH: {
        SOLDIERS: 'กำลังพล (รวม)',
        OFFICERS: 'นายทหารสัญญาบัตร',
        ENLISTED: 'นายประทวน/พลทหาร',
        ATTENDANCE: 'ลงเวลา',
        TRAINING: 'ฝึกอบรม',
        LEAVE: 'การลา',
        EQUIPMENT: 'อุปกรณ์',
        EQUIPMENT_LOG: 'ประวัติเบิก-คืน',
        MOVEMENT: 'เข้าออกหน่วย',
        GUARD_PATROL: 'ตรวจป้อม'
    },

    /**
     * Initialize API with settings
     */
    init() {
        const settings = storage.getSettings();
        this.baseUrl = settings.apiUrl || '';

        if (this.baseUrl) {
            this.testConnection();
        }
    },

    /**
     * Set API URL
     */
    setUrl(url) {
        this.baseUrl = url;
        storage.saveSettings({ apiUrl: url });
    },

    /**
     * Test connection to Google Sheets
     */
    async testConnection() {
        if (!this.baseUrl) {
            this.updateConnectionStatus(false);
            return false;
        }

        try {
            // Simple GET test with callback
            const response = await fetch(`${this.baseUrl}?action=ping`, {
                method: 'GET',
                mode: 'cors'
            });

            if (response.ok) {
                const data = await response.json();
                this.isConnected = data.success === true;
                this.updateConnectionStatus(this.isConnected);
                return this.isConnected;
            }
        } catch (error) {
            console.error('Connection test failed:', error);
        }

        this.isConnected = false;
        this.updateConnectionStatus(false);
        return false;
    },

    /**
     * Update connection status UI
     */
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            if (connected) {
                statusEl.className = 'connection-status connected';
                statusEl.innerHTML = '<i class="ph ph-cloud-check"></i><span>เชื่อมต่อแล้ว</span>';
            } else {
                statusEl.className = 'connection-status disconnected';
                statusEl.innerHTML = '<i class="ph ph-cloud-slash"></i><span>ยังไม่เชื่อมต่อ</span>';
            }
        }
    },

    /**
     * Submit data using hidden form (bypasses CORS)
     */
    submitViaForm(action, data) {
        return new Promise((resolve, reject) => {
            // Create hidden iframe
            const iframeName = 'submit_frame_' + Date.now();
            const iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            // Create form
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = this.baseUrl;
            form.target = iframeName;

            // Add action field
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'action';
            actionInput.value = action;
            form.appendChild(actionInput);

            // Add data field with LINE Auth included
            const dataInput = document.createElement('input');
            dataInput.type = 'hidden';
            dataInput.name = 'data';

            // Add token to payload if not already present
            // Fix: Retrieve latest settings from storage
            const savedSettings = storage.getSettings();
            const payload = {
                ...data,
                lineChannelToken: data.channelToken || savedSettings.lineChannelToken || '',
                lineDestId: data.destId || savedSettings.lineDestId || ''
            };

            dataInput.value = JSON.stringify(payload);
            form.appendChild(dataInput);

            document.body.appendChild(form);

            // Handle response
            iframe.onload = () => {
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    document.body.removeChild(form);
                    resolve(true);
                }, 500);
            };

            iframe.onerror = () => {
                document.body.removeChild(iframe);
                document.body.removeChild(form);
                reject(new Error('Form submission failed'));
            };

            // Submit form
            form.submit();
        });
    },

    /**
     * Sync all data to Google Sheets - แยกหมวดหมู่ชัดเจน
     */
    async syncAll() {
        if (this.isSyncing || !this.baseUrl) {
            if (!this.baseUrl) {
                app.showToast('warning', 'ไม่ได้ตั้งค่า', 'กรุณาใส่ URL ของ Google Apps Script ในหน้าตั้งค่าก่อน');
            }
            return;
        }

        this.isSyncing = true;
        const syncResults = [];

        try {
            // 1. Sync กำลังพล (Soldiers)
            app.showLoading('กำลังซิงค์ข้อมูลกำลังพล...');
            const soldiers = storage.getAll(storage.KEYS.SOLDIERS);
            if (soldiers.length > 0) {
                await this.submitViaForm('syncSoldiers', { soldiers });
                syncResults.push(`กำลังพล: ${soldiers.length} รายการ`);
                console.log('✓ Soldiers synced:', soldiers.length);
            }

            // 1b. แยก sync นายทหารสัญญาบัตร (Officers)
            app.showLoading('กำลังซิงค์นายทหารสัญญาบัตร...');
            const officerRanks = ['พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.',
                'พลเอก', 'พลโท', 'พลตรี', 'พันเอก', 'พันโท', 'พันตรี', 'ร้อยเอก', 'ร้อยโท', 'ร้อยตรี'];
            const officers = soldiers.filter(s => officerRanks.includes(s.rank));
            if (officers.length > 0) {
                await this.submitViaForm('syncOfficers', { officers });
                syncResults.push(`นายสัญญาบัตร: ${officers.length} นาย`);
                console.log('✓ Officers synced:', officers.length);
            }

            // 1c. แยก sync นายประทวน/พลทหาร (Enlisted)
            app.showLoading('กำลังซิงค์นายประทวน/พลทหาร...');
            const enlisted = soldiers.filter(s => !officerRanks.includes(s.rank));
            if (enlisted.length > 0) {
                await this.submitViaForm('syncEnlisted', { enlisted });
                syncResults.push(`นายประทวน/พลทหาร: ${enlisted.length} นาย`);
                console.log('✓ Enlisted synced:', enlisted.length);
            }

            // 2. Sync ลงเวลา (Attendance)
            app.showLoading('กำลังซิงค์ข้อมูลลงเวลา...');
            const attendance = storage.getAll(storage.KEYS.ATTENDANCE);
            if (attendance.length > 0) {
                await this.submitViaForm('syncAttendance', { records: attendance });
                syncResults.push(`ลงเวลา: ${attendance.length} รายการ`);
                console.log('✓ Attendance synced:', attendance.length);
            }

            // 3. Sync ฝึกอบรม (Training)
            app.showLoading('กำลังซิงค์ข้อมูลฝึกอบรม...');
            const training = storage.getAll(storage.KEYS.TRAINING);
            if (training.length > 0) {
                await this.submitViaForm('syncTraining', { training });
                syncResults.push(`ฝึกอบรม: ${training.length} รายการ`);
                console.log('✓ Training synced:', training.length);
            }

            // 4. Sync การลา (Leave)
            app.showLoading('กำลังซิงค์ข้อมูลการลา...');
            const leave = storage.getAll(storage.KEYS.LEAVE);
            if (leave.length > 0) {
                await this.submitViaForm('syncLeave', { leave });
                syncResults.push(`การลา: ${leave.length} รายการ`);
                console.log('✓ Leave synced:', leave.length);
            }

            // 5. Sync อุปกรณ์ (Equipment)
            app.showLoading('กำลังซิงค์ข้อมูลอุปกรณ์...');
            const equipment = storage.getAll(storage.KEYS.EQUIPMENT);
            if (equipment.length > 0) {
                await this.submitViaForm('syncEquipment', { equipment });
                syncResults.push(`อุปกรณ์: ${equipment.length} รายการ`);
                console.log('✓ Equipment synced:', equipment.length);
            }

            // 6. Sync ประวัติเบิก-คืนอุปกรณ์ (Equipment Log)
            app.showLoading('กำลังซิงค์ประวัติเบิก-คืน...');
            const equipmentLog = storage.getAll(storage.KEYS.EQUIPMENT_LOG);
            if (equipmentLog.length > 0) {
                await this.submitViaForm('syncEquipmentLog', { equipmentLog });
                syncResults.push(`ประวัติเบิก-คืน: ${equipmentLog.length} รายการ`);
                console.log('✓ Equipment Log synced:', equipmentLog.length);
            }

            // 7. Sync เข้าออกหน่วย (Movement)
            app.showLoading('กำลังซิงค์ข้อมูลเข้าออกหน่วย...');
            const movement = storage.getAll(storage.KEYS.MOVEMENT);
            if (movement.length > 0) {
                await this.submitViaForm('syncMovement', { movement });
                syncResults.push(`เข้าออกหน่วย: ${movement.length} รายการ`);
                console.log('✓ Movement synced:', movement.length);
            }

            // 8. Sync ตรวจป้อม (Guard Patrol)
            app.showLoading('กำลังซิงค์ข้อมูลตรวจป้อม...');
            const guardPatrolData = storage.getAll(storage.KEYS.GUARD_PATROL);

            // Enrich with Guard Names for LINE Notification
            const soldiersList = storage.getAll(storage.KEYS.SOLDIERS);
            const enrichedPatrolData = guardPatrolData.map(item => {
                const guard = soldiersList.find(s => s.id === item.guardId);
                return {
                    ...item,
                    guardName: guard ? (guard.rank + guard.firstName + ' ' + guard.lastName) : item.guardId
                };
            });

            if (enrichedPatrolData.length > 0) {
                await this.submitViaForm('syncGuardPatrol', { guardPatrol: enrichedPatrolData });
                syncResults.push(`ตรวจป้อม: ${enrichedPatrolData.length} รายการ`);
                console.log('✓ Guard Patrol synced:', enrichedPatrolData.length);
            }

            // Update last sync time
            storage.saveSettings({ lastSync: new Date().toISOString() });

            // Show summary
            if (syncResults.length > 0) {
                app.showToast('success', 'ซิงค์สำเร็จ', `บันทึกข้อมูล ${syncResults.length} หมวดหมู่แล้ว`);
                console.log('Sync Summary:', syncResults.join(', '));
            } else {
                app.showToast('info', 'ไม่มีข้อมูล', 'ไม่มีข้อมูลที่ต้องซิงค์');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            app.showToast('error', 'ซิงค์ล้มเหลว', error.message);
        } finally {
            this.isSyncing = false;
            app.hideLoading();
        }
    },

    /**
     * Sync single category - ซิงค์เฉพาะหมวดหมู่
     * @param {string} category - Category key (SOLDIERS, ATTENDANCE, etc.)
     */
    async syncCategory(category) {
        if (this.isSyncing || !this.baseUrl) {
            if (!this.baseUrl) {
                app.showToast('warning', 'ไม่ได้ตั้งค่า', 'กรุณาใส่ URL ของ Google Apps Script ในหน้าตั้งค่าก่อน');
            }
            return false;
        }

        const categoryName = this.SHEET_NAMES_TH[category] || category;
        this.isSyncing = true;
        app.showLoading(`กำลังซิงค์${categoryName}...`);

        try {
            let data = [];
            let action = '';

            switch (category) {
                case 'SOLDIERS':
                    data = storage.getAll(storage.KEYS.SOLDIERS);
                    action = 'syncSoldiers';
                    break;
                case 'OFFICERS':
                    // Get officers from soldiers based on rank
                    const officerRanks = ['พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.',
                        'พลเอก', 'พลโท', 'พลตรี', 'พันเอก', 'พันโท', 'พันตรี', 'ร้อยเอก', 'ร้อยโท', 'ร้อยตรี'];
                    data = storage.getAll(storage.KEYS.SOLDIERS).filter(s => officerRanks.includes(s.rank));
                    action = 'syncOfficers';
                    break;
                case 'ENLISTED':
                    // Get enlisted from soldiers based on rank
                    const officerRanks2 = ['พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.',
                        'พลเอก', 'พลโท', 'พลตรี', 'พันเอก', 'พันโท', 'พันตรี', 'ร้อยเอก', 'ร้อยโท', 'ร้อยตรี'];
                    data = storage.getAll(storage.KEYS.SOLDIERS).filter(s => !officerRanks2.includes(s.rank));
                    action = 'syncEnlisted';
                    break;
                case 'ATTENDANCE':
                    data = storage.getAll(storage.KEYS.ATTENDANCE);
                    action = 'syncAttendance';
                    break;
                case 'TRAINING':
                    data = storage.getAll(storage.KEYS.TRAINING);
                    action = 'syncTraining';
                    break;
                case 'LEAVE':
                    data = storage.getAll(storage.KEYS.LEAVE);
                    action = 'syncLeave';
                    break;
                case 'EQUIPMENT':
                    data = storage.getAll(storage.KEYS.EQUIPMENT);
                    action = 'syncEquipment';
                    break;
                case 'EQUIPMENT_LOG':
                    data = storage.getAll(storage.KEYS.EQUIPMENT_LOG);
                    action = 'syncEquipmentLog';
                    break;
                case 'MOVEMENT':
                    data = storage.getAll(storage.KEYS.MOVEMENT);
                    action = 'syncMovement';
                    break;
                default:
                    throw new Error(`Unknown category: ${category}`);
            }

            if (data.length > 0) {
                const payload = category === 'ATTENDANCE' ? { records: data } :
                    category === 'SOLDIERS' ? { soldiers: data } :
                        category === 'TRAINING' ? { training: data } :
                            category === 'LEAVE' ? { leave: data } :
                                category === 'EQUIPMENT' ? { equipment: data } :
                                    category === 'EQUIPMENT_LOG' ? { equipmentLog: data } :
                                        category === 'MOVEMENT' ? { movement: data } : { data };

                await this.submitViaForm(action, payload);
                app.showToast('success', 'ซิงค์สำเร็จ', `บันทึก${categoryName} ${data.length} รายการแล้ว`);
                console.log(`✓ ${category} synced:`, data.length);
                return true;
            } else {
                app.showToast('info', 'ไม่มีข้อมูล', `ไม่มีข้อมูล${categoryName}ที่จะซิงค์`);
                return false;
            }
        } catch (error) {
            console.error(`Sync ${category} failed:`, error);
            app.showToast('error', 'ซิงค์ล้มเหลว', error.message);
            return false;
        } finally {
            this.isSyncing = false;
            app.hideLoading();
        }
    },

    /**
     * Upload single item - เพิ่มรายการเดียว
     */
    async uploadItem(sheet, item) {
        if (!this.baseUrl) return;

        try {
            const sheetName = sheet.charAt(0).toUpperCase() + sheet.slice(1);
            await this.submitViaForm('add' + sheetName, { [sheet]: item });
            console.log(`${sheet} uploaded:`, item.id);
        } catch (error) {
            console.error(`Failed to upload ${sheet}:`, error);
        }
    },

    /**
     * Update item - อัปเดตรายการ
     */
    async updateItem(sheet, item) {
        if (!this.baseUrl) return;

        try {
            const sheetName = sheet.charAt(0).toUpperCase() + sheet.slice(1);
            await this.submitViaForm('update' + sheetName, { item });
            console.log(`${sheet} updated:`, item.id);
        } catch (error) {
            console.error(`Failed to update ${sheet}:`, error);
        }
    },

    /**
     * Delete item - ลบรายการ
     */
    async deleteItem(sheet, id) {
        if (!this.baseUrl) return;

        try {
            const sheetName = sheet.charAt(0).toUpperCase() + sheet.slice(1);
            await this.submitViaForm('delete' + sheetName, { id });
            console.log(`${sheet} deleted:`, id);
        } catch (error) {
            console.error(`Failed to delete ${sheet}:`, error);
        }
    },

    /**
     * Get sync status summary - สรุปสถานะการซิงค์
     */
    getSyncSummary() {
        const summary = {};
        const categories = ['SOLDIERS', 'ATTENDANCE', 'TRAINING', 'LEAVE', 'EQUIPMENT', 'EQUIPMENT_LOG', 'MOVEMENT'];

        categories.forEach(cat => {
            const key = storage.KEYS[cat];
            const data = storage.getAll(key);
            summary[cat] = {
                name: this.SHEET_NAMES_TH[cat],
                count: data.length,
                sheetName: this.SHEETS[cat]
            };
        });

        const settings = storage.getSettings();
        summary.lastSync = settings.lastSync;
        summary.isConnected = this.isConnected;

        return summary;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    api.init();
});
