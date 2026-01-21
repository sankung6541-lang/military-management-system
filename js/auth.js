/**
 * Authentication Module - ระบบยืนยันตัวตน
 * Login/Register with Username/Password stored in Google Sheets
 */

const auth = {
    // Current user session
    currentUser: null,
    SESSION_KEY: 'military_user_session',

    // User roles
    ROLES: {
        ADMIN: 'admin',
        USER: 'user'
    },

    /**
     * Initialize auth module
     */
    init() {
        this.loadSession();
    },

    /**
     * Load session from localStorage
     */
    loadSession() {
        try {
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            if (sessionData) {
                this.currentUser = JSON.parse(sessionData);
                return true;
            }
        } catch (e) {
            console.error('Failed to load session:', e);
        }
        return false;
    },

    /**
     * Save session to localStorage
     */
    saveSession(user) {
        try {
            this.currentUser = user;
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    },

    /**
     * Clear session
     */
    clearSession() {
        this.currentUser = null;
        localStorage.removeItem(this.SESSION_KEY);
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.currentUser !== null;
    },

    /**
     * Check if current user is admin
     */
    isAdmin() {
        return this.currentUser?.role === this.ROLES.ADMIN;
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Get current user ID
     */
    getCurrentUserId() {
        return this.currentUser?.id || null;
    },

    /**
     * Simple hash function for password
     */
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'h' + Math.abs(hash).toString(16);
    },

    /**
     * Login with username and password
     */
    async login(username, password) {
        if (!username || !password) {
            throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        }

        const hashedPassword = this.hashPassword(password);
        const usernameClean = username.trim().toLowerCase();

        // Try online first, fallback to local
        const settings = storage.getSettings();
        if (settings.apiUrl) {
            try {
                const result = await api.submitViaForm('login', {
                    username: usernameClean,
                    password: hashedPassword
                });

                if (result.success && result.user) {
                    this.saveSession(result.user);
                    return result.user;
                } else if (result.error) {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.log('Online login failed, trying local:', error);
            }
        }

        // Fallback to local storage
        const users = this.getLocalUsers();
        const user = users.find(u => u.username === usernameClean && u.password === hashedPassword);

        if (user) {
            const sessionUser = {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                role: user.role
            };
            this.saveSession(sessionUser);
            return sessionUser;
        }

        throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    },

    /**
     * Register new user
     */
    async register(username, password, displayName) {
        if (!username || !password || !displayName) {
            throw new Error('กรุณากรอกข้อมูลให้ครบ');
        }

        if (password.length < 4) {
            throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
        }

        const hashedPassword = this.hashPassword(password);
        const usernameClean = username.trim().toLowerCase();
        const userId = 'U' + Date.now().toString(36).toUpperCase();

        // Check if username exists locally
        const users = this.getLocalUsers();
        if (users.find(u => u.username === usernameClean)) {
            throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
        }

        const newUser = {
            id: userId,
            username: usernameClean,
            password: hashedPassword,
            displayName: displayName.trim(),
            role: users.length === 0 ? this.ROLES.ADMIN : this.ROLES.USER, // First user is admin
            createdAt: new Date().toISOString()
        };

        // Save to local storage
        users.push(newUser);
        this.saveLocalUsers(users);

        // Try to sync to Google Sheets
        const settings = storage.getSettings();
        if (settings.apiUrl) {
            try {
                await api.submitViaForm('register', newUser);
            } catch (error) {
                console.log('Could not sync user to sheets:', error);
            }
        }

        // Auto login after register
        const sessionUser = {
            id: userId,
            username: usernameClean,
            displayName: displayName.trim(),
            role: newUser.role
        };
        this.saveSession(sessionUser);
        return sessionUser;
    },

    /**
     * Get users from local storage
     */
    getLocalUsers() {
        try {
            const data = localStorage.getItem('military_users');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Save users to local storage
     */
    saveLocalUsers(users) {
        localStorage.setItem('military_users', JSON.stringify(users));
    },

    /**
     * Logout
     */
    logout() {
        this.clearSession();
        window.location.reload();
    },

    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app');

        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
    },

    /**
     * Hide login screen
     */
    hideLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app');

        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
    },

    /**
     * Handle login form submit
     */
    async handleLogin() {
        const username = document.getElementById('login-username')?.value;
        const password = document.getElementById('login-password')?.value;
        const errorEl = document.getElementById('login-error');
        const btnEl = document.getElementById('login-btn');

        if (errorEl) errorEl.textContent = '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="ph ph-spinner ph-spin"></i> กำลังเข้าสู่ระบบ...';
        }

        try {
            await this.login(username, password);
            this.hideLoginScreen();
            app.init();
        } catch (error) {
            if (errorEl) errorEl.textContent = error.message;
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="ph ph-sign-in"></i> เข้าสู่ระบบ';
            }
        }
    },

    /**
     * Handle register form submit
     */
    async handleRegister() {
        const rank = document.getElementById('register-rank')?.value;
        const firstName = document.getElementById('register-firstname')?.value;
        const lastName = document.getElementById('register-lastname')?.value;
        const position = document.getElementById('register-position')?.value || '';
        const username = document.getElementById('register-username')?.value;
        const password = document.getElementById('register-password')?.value;
        const errorEl = document.getElementById('register-error');
        const btnEl = document.getElementById('register-btn');

        if (errorEl) errorEl.textContent = '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="ph ph-spinner ph-spin"></i> กำลังสมัคร...';
        }

        try {
            // Validate
            if (!rank || !firstName || !lastName || !username || !password) {
                throw new Error('กรุณากรอกข้อมูลให้ครบ');
            }

            const displayName = `${rank}${firstName} ${lastName}`;
            const result = await this.register(username, password, displayName);

            // Create soldier record
            const soldierData = {
                id: result.id,
                rank,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                position: position.trim(),
                userId: result.id,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Determine if officer or enlisted
            const rankType = this.getRankType(rank);
            const storageKey = rankType === 'officer' ? storage.KEYS.OFFICERS : storage.KEYS.ENLISTED;

            // Save to appropriate storage
            storage.add(storageKey, soldierData);

            // Also save to combined Soldiers for backward compatibility
            storage.add(storage.KEYS.SOLDIERS, soldierData);

            this.hideLoginScreen();
            app.init();
        } catch (error) {
            if (errorEl) errorEl.textContent = error.message;
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="ph ph-user-plus"></i> สมัครสมาชิก';
            }
        }
    },

    /**
     * Get rank type (officer or enlisted)
     */
    getRankType(rank) {
        const officerRanks = ['พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.'];
        return officerRanks.includes(rank) ? 'officer' : 'enlisted';
    },

    /**
     * Toggle between login and register forms
     */
    showRegisterForm() {
        document.getElementById('login-form-container')?.classList.add('hidden');
        document.getElementById('register-form-container')?.classList.remove('hidden');
    },

    showLoginForm() {
        document.getElementById('login-form-container')?.classList.remove('hidden');
        document.getElementById('register-form-container')?.classList.add('hidden');
    },

    /**
     * Update header with user info
     */
    updateHeader() {
        const userNameEl = document.getElementById('header-username');
        const userRoleEl = document.getElementById('header-user-role');

        if (this.currentUser) {
            if (userNameEl) userNameEl.textContent = this.currentUser.displayName;
            if (userRoleEl) userRoleEl.textContent = this.isAdmin() ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
        }

        // Show/hide admin menu
        const adminMenu = document.querySelector('[data-page="users"]');
        if (adminMenu) {
            adminMenu.style.display = this.isAdmin() ? '' : 'none';
        }
    },

    // ==========================================
    // 👑 ADMIN FUNCTIONS - จัดการผู้ใช้
    // ==========================================

    /**
     * Sync users from Google Sheets to Local Storage
     * ดึงข้อมูลผู้ใช้จาก Sheets มาอัพเดท Local
     */
    async syncUsersFromSheets() {
        if (!this.isAdmin()) {
            app.showToast('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบเท่านั้น');
            return false;
        }

        const settings = storage.getSettings();
        if (!settings.apiUrl) {
            app.showToast('warning', 'ไม่ได้เชื่อมต่อ', 'กรุณาตั้งค่า Google Sheets API URL ก่อน');
            return false;
        }

        try {
            app.showToast('info', 'กำลังดึงข้อมูล...', 'โปรดรอสักครู่');

            // Fetch users from Sheets via GET
            const response = await fetch(`${settings.apiUrl}?action=getUsers`);
            const result = await response.json();

            if (result.success && result.data) {
                // Merge with local users (keep passwords from local)
                const localUsers = this.getLocalUsers();
                const mergedUsers = result.data.map(sheetUser => {
                    const localUser = localUsers.find(u => u.id === sheetUser.id || u.username === sheetUser.username);
                    return {
                        id: sheetUser.id,
                        username: sheetUser.username,
                        password: localUser?.password || '', // Keep local password
                        displayName: sheetUser.displayName,
                        role: sheetUser.role || 'user',
                        createdAt: sheetUser.createdAt || localUser?.createdAt || new Date().toISOString()
                    };
                });

                // Save merged users to local
                this.saveLocalUsers(mergedUsers);

                app.showToast('success', 'ดึงข้อมูลสำเร็จ', `พบผู้ใช้ ${mergedUsers.length} คน`);
                this.renderUserManagement();
                return true;
            } else {
                app.showToast('error', 'ไม่สามารถดึงข้อมูล', result.error || 'เกิดข้อผิดพลาด');
                return false;
            }
        } catch (error) {
            console.error('Sync users from sheets error:', error);
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
            return false;
        }
    },

    /**
     * Sync users from Local Storage to Google Sheets
     * อัพโหลดข้อมูลผู้ใช้ไป Sheets
     */
    async syncUsersToSheets() {
        if (!this.isAdmin()) {
            app.showToast('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบเท่านั้น');
            return false;
        }

        const settings = storage.getSettings();
        if (!settings.apiUrl) {
            app.showToast('warning', 'ไม่ได้เชื่อมต่อ', 'กรุณาตั้งค่า Google Sheets API URL ก่อน');
            return false;
        }

        try {
            app.showToast('info', 'กำลังซิงค์...', 'โปรดรอสักครู่');

            const users = this.getLocalUsers();
            const result = await api.submitViaForm('syncUsers', { users });

            if (result.success) {
                app.showToast('success', 'ซิงค์สำเร็จ', `อัพโหลดผู้ใช้ ${users.length} คน`);
                return true;
            } else {
                app.showToast('error', 'ซิงค์ไม่สำเร็จ', result.error || 'เกิดข้อผิดพลาด');
                return false;
            }
        } catch (error) {
            console.error('Sync users to sheets error:', error);
            app.showToast('error', 'เกิดข้อผิดพลาด', error.message);
            return false;
        }
    },

    /**
     * Get all users (admin only)
     */
    getAllUsers() {
        return this.getLocalUsers();
    },

    /**
     * Delete user (admin only)
     * @param {string} userId - User ID
     */
    deleteUser(userId) {
        if (!this.isAdmin()) {
            app.showToast('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบเท่านั้น');
            return false;
        }

        // Don't allow deleting own account
        if (userId === this.getCurrentUserId()) {
            app.showToast('error', 'ไม่สามารถดำเนินการ', 'ไม่สามารถลบบัญชีของตัวเองได้');
            return false;
        }

        const users = this.getLocalUsers();
        const filtered = users.filter(u => u.id !== userId);
        this.saveLocalUsers(filtered);
        return true;
    },

    /**
     * Toggle user role (admin only)
     * @param {string} userId - User ID
     */
    toggleUserRole(userId) {
        if (!this.isAdmin()) {
            app.showToast('error', 'ไม่มีสิทธิ์', 'เฉพาะผู้ดูแลระบบเท่านั้น');
            return;
        }

        // Don't allow changing own role
        if (userId === this.getCurrentUserId()) {
            app.showToast('warning', 'ไม่สามารถดำเนินการ', 'ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้');
            return;
        }

        const users = this.getLocalUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;

        user.role = user.role === this.ROLES.ADMIN ? this.ROLES.USER : this.ROLES.ADMIN;
        this.saveLocalUsers(users);

        app.showToast('success', 'เปลี่ยนสิทธิ์สำเร็จ', `${user.displayName} เป็น ${user.role === this.ROLES.ADMIN ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'} แล้ว`);
        this.renderUserManagement();
    },

    /**
     * Change user password (admin only)
     * @param {string} userId - User ID
     * @param {string} newPassword - New password
     */
    changeUserPassword(userId, newPassword) {
        if (!this.isAdmin()) return false;

        if (!newPassword || newPassword.length < 4) {
            app.showToast('error', 'รหัสผ่านไม่ถูกต้อง', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
            return false;
        }

        const users = this.getLocalUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return false;

        user.password = this.hashPassword(newPassword);
        this.saveLocalUsers(users);
        return true;
    },

    /**
     * Show change password modal
     * @param {string} userId - User ID
     */
    showChangePasswordModal(userId) {
        const users = this.getLocalUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;

        app.showModal('เปลี่ยนรหัสผ่าน', `
            <div class="form">
                <p>เปลี่ยนรหัสผ่านของ: <strong>${user.displayName}</strong></p>
                <div class="form-group">
                    <label class="form-label">รหัสผ่านใหม่</label>
                    <input type="password" id="new-password-input" class="form-input" placeholder="อย่างน้อย 4 ตัวอักษร">
                </div>
            </div>
        `, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'บันทึก', class: 'btn-primary', onclick: `auth.executeChangePassword('${userId}')` }
        ]);
    },

    /**
     * Execute password change
     * @param {string} userId - User ID
     */
    executeChangePassword(userId) {
        const newPassword = document.getElementById('new-password-input')?.value;
        if (this.changeUserPassword(userId, newPassword)) {
            app.closeModal();
            app.showToast('success', 'สำเร็จ', 'เปลี่ยนรหัสผ่านแล้ว');
        }
    },

    /**
     * Confirm delete user
     * @param {string} userId - User ID
     */
    confirmDeleteUser(userId) {
        const users = this.getLocalUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;

        app.showModal('ยืนยันการลบ', `
            <div class="confirm-delete" style="text-align: center; padding: 1rem;">
                <i class="ph ph-warning" style="font-size: 3rem; color: var(--color-danger);"></i>
                <p>ต้องการลบผู้ใช้ <strong>${user.displayName}</strong>?</p>
                <p style="color: var(--text-secondary);">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
            </div>
        `, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ลบ', class: 'btn-danger', onclick: `auth.executeDeleteUser('${userId}')` }
        ]);
    },

    /**
     * Execute user deletion
     * @param {string} userId - User ID
     */
    executeDeleteUser(userId) {
        if (this.deleteUser(userId)) {
            app.closeModal();
            app.showToast('success', 'สำเร็จ', 'ลบผู้ใช้แล้ว');
            this.renderUserManagement();
        }
    },

    /**
     * Render user management page (admin only)
     */
    renderUserManagement() {
        const container = document.getElementById('users-list');
        if (!container) return;

        if (!this.isAdmin()) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-lock"></i>
                    <p>ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
                </div>
            `;
            return;
        }

        const users = this.getAllUsers();
        const currentUserId = this.getCurrentUserId();

        // Update users count badge
        const countEl = document.getElementById('users-count');
        if (countEl) countEl.textContent = `${users.length} คน`;

        if (users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-users"></i>
                    <p>ยังไม่มีผู้ใช้ในระบบ</p>
                    <p style="font-size: 0.875rem; color: var(--text-muted);">ลองกด "ดึงจาก Sheets" เพื่อโหลดผู้ใช้จาก Google Sheets</p>
                </div>
            `;
            return;
        }

        container.innerHTML = users.map(user => `
            <div class="user-card ${user.id === currentUserId ? 'current' : ''}">
                <div class="user-avatar ${user.role === 'admin' ? 'admin' : ''}">
                    <i class="ph ph-${user.role === 'admin' ? 'crown' : 'user'}"></i>
                </div>
                <div class="user-info">
                    <span class="user-name">${user.displayName || user.username}</span>
                    <span class="user-meta">
                        <span class="badge ${user.role === 'admin' ? 'admin' : 'user'}">${user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</span>
                        @${user.username}
                    </span>
                </div>
                ${user.id !== currentUserId ? `
                    <div class="user-actions">
                        <button class="btn btn-sm btn-outline" onclick="auth.toggleUserRole('${user.id}')" title="เปลี่ยนสิทธิ์">
                            <i class="ph ph-arrows-clockwise"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="auth.showChangePasswordModal('${user.id}')" title="เปลี่ยนรหัสผ่าน">
                            <i class="ph ph-key"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="auth.confirmDeleteUser('${user.id}')" title="ลบ">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                ` : '<span class="badge current">คุณ</span>'}
            </div>
        `).join('');
    }
};
