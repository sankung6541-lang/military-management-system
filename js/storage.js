/**
 * Storage Module - Local Storage Handler
 * Handles all local storage operations for offline capability
 */

const storage = {
    // Storage keys
    KEYS: {
        SOLDIERS: 'military_soldiers',
        OFFICERS: 'military_officers',        // นายทหารสัญญาบัตร
        ENLISTED: 'military_enlisted',        // นายประทวน + พลทหาร
        ATTENDANCE: 'military_attendance',
        TRAINING: 'military_training',
        LEAVE: 'military_leave',
        EQUIPMENT: 'military_equipment',
        EQUIPMENT_LOG: 'military_equipment_log',
        MOVEMENT: 'military_movement',
        GUARD_PATROL: 'military_guard_patrol',
        SETTINGS: 'military_settings',
        ACTIVITIES: 'military_activities'
    },

    /**
     * Initialize storage with default data if empty
     */
    init() {
        // Initialize each storage key if not exists
        Object.values(this.KEYS).forEach(key => {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify([]));
            }
        });

        // Initialize settings
        if (!localStorage.getItem(this.KEYS.SETTINGS)) {
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({
                apiUrl: '',
                unitName: 'หน่วยทหาร',
                workStart: '08:00',
                workEnd: '16:30',
                lastSync: null
            }));
        }

        console.log('Storage initialized');
    },

    /**
     * Get all items from a storage key
     * @param {string} key - Storage key
     * @returns {Array} Array of items
     */
    getAll(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Error getting ${key}:`, error);
            return [];
        }
    },

    /**
     * Get a single item by ID
     * @param {string} key - Storage key
     * @param {string} id - Item ID
     * @returns {Object|null} Item or null if not found
     */
    getById(key, id) {
        const items = this.getAll(key);
        return items.find(item => item.id === id) || null;
    },

    /**
     * Add a new item
     * @param {string} key - Storage key
     * @param {Object} item - Item to add
     * @returns {Object} Added item with generated ID
     */
    add(key, item) {
        const items = this.getAll(key);
        const newItem = {
            ...item,
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        items.push(newItem);
        this.save(key, items);

        // Log activity
        this.logActivity('add', key, newItem);

        return newItem;
    },

    /**
     * Update an existing item
     * @param {string} key - Storage key
     * @param {string} id - Item ID
     * @param {Object} updates - Updates to apply
     * @returns {Object|null} Updated item or null if not found
     */
    update(key, id, updates) {
        const items = this.getAll(key);
        const index = items.findIndex(item => item.id === id);

        if (index === -1) return null;

        items[index] = {
            ...items[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.save(key, items);

        // Log activity
        this.logActivity('update', key, items[index]);

        return items[index];
    },

    /**
     * Delete an item
     * @param {string} key - Storage key
     * @param {string} id - Item ID
     * @returns {boolean} Success status
     */
    delete(key, id) {
        const items = this.getAll(key);
        const item = items.find(i => i.id === id);
        const filtered = items.filter(item => item.id !== id);

        if (filtered.length === items.length) return false;

        this.save(key, filtered);

        // Log activity
        if (item) {
            this.logActivity('delete', key, item);
        }

        return true;
    },

    /**
     * Save items to storage
     * @param {string} key - Storage key
     * @param {Array} items - Items to save
     */
    save(key, items) {
        try {
            localStorage.setItem(key, JSON.stringify(items));
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
            throw new Error('ไม่สามารถบันทึกข้อมูลได้ พื้นที่เก็บข้อมูลอาจเต็ม');
        }
    },

    /**
     * Clear all items in a storage key
     * @param {string} key - Storage key
     */
    clear(key) {
        localStorage.setItem(key, JSON.stringify([]));
    },

    /**
     * Clear all data
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.init();
    },

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Search items
     * @param {string} key - Storage key
     * @param {string} query - Search query
     * @param {Array} fields - Fields to search in
     * @returns {Array} Matching items
     */
    search(key, query, fields) {
        const items = this.getAll(key);
        const lowerQuery = query.toLowerCase();

        return items.filter(item => {
            return fields.some(field => {
                const value = item[field];
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(lowerQuery);
                }
                return false;
            });
        });
    },

    /**
     * Filter items
     * @param {string} key - Storage key
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered items
     */
    filter(key, filters) {
        let items = this.getAll(key);

        Object.entries(filters).forEach(([field, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                items = items.filter(item => item[field] === value);
            }
        });

        return items;
    },

    /**
     * Get items by date range
     * @param {string} key - Storage key
     * @param {string} dateField - Field containing date
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Array} Items in date range
     */
    getByDateRange(key, dateField, startDate, endDate) {
        const items = this.getAll(key);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return items.filter(item => {
            const date = new Date(item[dateField]);
            return date >= start && date <= end;
        });
    },

    /**
     * Log activity
     * @param {string} action - Action type (add, update, delete)
     * @param {string} module - Module name
     * @param {Object} data - Related data
     */
    logActivity(action, module, data) {
        const activities = this.getAll(this.KEYS.ACTIVITIES);

        const activity = {
            id: this.generateId(),
            action,
            module,
            dataId: data.id,
            summary: this.getActivitySummary(action, module, data),
            timestamp: new Date().toISOString()
        };

        // Keep only last 100 activities
        activities.unshift(activity);
        if (activities.length > 100) {
            activities.pop();
        }

        localStorage.setItem(this.KEYS.ACTIVITIES, JSON.stringify(activities));
    },

    /**
     * Get activity summary text
     */
    getActivitySummary(action, module, data) {
        const moduleNames = {
            [this.KEYS.SOLDIERS]: 'กำลังพล',
            [this.KEYS.ATTENDANCE]: 'การลงเวลา',
            [this.KEYS.TRAINING]: 'การฝึก',
            [this.KEYS.LEAVE]: 'การลา',
            [this.KEYS.EQUIPMENT]: 'อุปกรณ์',
            [this.KEYS.EQUIPMENT_LOG]: 'การเบิก-คืน'
        };

        const actionNames = {
            add: 'เพิ่ม',
            update: 'แก้ไข',
            delete: 'ลบ'
        };

        const moduleName = moduleNames[module] || module;
        const actionName = actionNames[action] || action;

        let itemName = '';
        if (data.firstName) {
            itemName = `${data.rank || ''} ${data.firstName} ${data.lastName || ''}`.trim();
        } else if (data.name) {
            itemName = data.name;
        } else if (data.trainingName) {
            itemName = data.trainingName;
        }

        return `${actionName}${moduleName}${itemName ? ': ' + itemName : ''}`;
    },

    /**
     * Get recent activities
     * @param {number} limit - Number of activities to get
     * @returns {Array} Recent activities
     */
    getRecentActivities(limit = 10) {
        const activities = this.getAll(this.KEYS.ACTIVITIES);
        return activities.slice(0, limit);
    },

    /**
     * Get settings
     * @returns {Object} Settings object
     */
    getSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.SETTINGS);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    },

    /**
     * Save settings
     * @param {Object} settings - Settings to save
     */
    saveSettings(settings) {
        const current = this.getSettings();
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({
            ...current,
            ...settings
        }));
    },

    /**
     * Export all data as JSON
     * @returns {Object} All data
     */
    exportData() {
        const data = {};
        Object.entries(this.KEYS).forEach(([name, key]) => {
            data[name.toLowerCase()] = this.getAll(key);
        });
        data.settings = this.getSettings();
        data.exportedAt = new Date().toISOString();
        return data;
    },

    /**
     * Import data from JSON
     * @param {Object} data - Data to import
     */
    importData(data) {
        if (data.soldiers) this.save(this.KEYS.SOLDIERS, data.soldiers);
        if (data.attendance) this.save(this.KEYS.ATTENDANCE, data.attendance);
        if (data.training) this.save(this.KEYS.TRAINING, data.training);
        if (data.leave) this.save(this.KEYS.LEAVE, data.leave);
        if (data.equipment) this.save(this.KEYS.EQUIPMENT, data.equipment);
        if (data.equipment_log) this.save(this.KEYS.EQUIPMENT_LOG, data.equipment_log);
        if (data.settings) this.saveSettings(data.settings);
    },

    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const soldiers = this.getAll(this.KEYS.SOLDIERS);
        const today = new Date().toISOString().split('T')[0];
        const attendance = this.getAll(this.KEYS.ATTENDANCE).filter(a => a.date === today);
        const leaves = this.getAll(this.KEYS.LEAVE).filter(l => {
            return l.startDate <= today && l.endDate >= today && l.status === 'approved';
        });
        const trainings = this.getAll(this.KEYS.TRAINING).filter(t => {
            return t.startDate <= today && t.endDate >= today;
        });

        return {
            totalSoldiers: soldiers.filter(s => s.status === 'active').length,
            presentToday: attendance.filter(a => a.checkIn && a.status !== 'absent').length,
            onLeaveToday: leaves.length,
            inTraining: trainings.reduce((sum, t) => sum + (t.participants?.length || 0), 0)
        };
    }
};

// Initialize storage on load
storage.init();
