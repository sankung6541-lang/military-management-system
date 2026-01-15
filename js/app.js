/**
 * Main Application Module
 * Core application logic and navigation
 */

const app = {
    currentPage: 'dashboard',

    /**
     * Initialize the application
     */
    init() {
        console.log('Initializing Military Management System...');

        // Check if user is logged in
        auth.init();

        if (!auth.isLoggedIn()) {
            // Show login screen
            document.getElementById('loading-screen').classList.add('hidden');
            auth.showLoginScreen();
            return;
        }

        // Update header with user info
        auth.updateHeader();

        // Initialize modules
        soldiers.init();
        attendance.init();
        training.init();
        leave.init();
        equipment.init();
        personnelMovement.init();
        guardPatrol.init();
        dashboard.init();
        reports.init();
        settings.init();

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        }

        // Setup navigation
        this.setupNavigation();

        // Setup modal
        this.setupModal();

        // Setup PWA features (offline detection, install prompt)
        this.setupPWA();

        // Hide loading screen and show app
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        // Render initial page
        this.navigateTo('dashboard');

        console.log('Application initialized successfully');
    },

    // PWA Install Prompt reference
    deferredPrompt: null,

    /**
     * Setup PWA features - offline detection and install prompt
     */
    setupPWA() {
        // Offline/Online detection
        const updateOnlineStatus = () => {
            const indicator = document.getElementById('offline-indicator');
            if (indicator) {
                indicator.classList.toggle('hidden', navigator.onLine);
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Check initial status

        // PWA Install Prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            document.getElementById('install-btn')?.classList.remove('hidden');
        });

        // Detect if already installed
        window.addEventListener('appinstalled', () => {
            document.getElementById('install-btn')?.classList.add('hidden');
            this.deferredPrompt = null;
            this.showToast('success', 'ติดตั้งสำเร็จ', 'แอปถูกติดตั้งบนอุปกรณ์แล้ว');
        });
    },

    /**
     * Trigger PWA Installation
     */
    async installPWA() {
        if (!this.deferredPrompt) {
            this.showToast('info', 'ติดตั้งจากเบราว์เซอร์', 'ใช้เมนู "Add to Home Screen" ของเบราว์เซอร์');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }
        this.deferredPrompt = null;
        document.getElementById('install-btn')?.classList.add('hidden');
    },

    /**
     * Setup navigation event listeners
     */
    setupNavigation() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                this.navigateTo(item.dataset.page);
                this.closeSidebar();
            });
        });

        // Bottom navigation
        document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                this.navigateTo(item.dataset.page);
            });
        });

        // Menu toggle
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Sidebar close
        document.getElementById('sidebar-close')?.addEventListener('click', () => {
            this.closeSidebar();
        });

        // Sidebar overlay
        document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
            this.closeSidebar();
        });

        // Sync button
        document.getElementById('sync-btn')?.addEventListener('click', () => {
            api.syncAll();
        });
    },

    /**
     * Navigate to a page
     * @param {string} pageName - Page name to navigate to
     */
    navigateTo(pageName) {
        this.currentPage = pageName;

        // Update page visibility
        document.querySelectorAll('.page').forEach(page => {
            page.classList.toggle('active', page.id === `page-${pageName}`);
        });

        // Update navigation active states
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        // Render page content
        this.renderPage(pageName);

        // Scroll to top
        document.querySelector('.main-content')?.scrollTo(0, 0);
    },

    /**
     * Render page content
     * @param {string} pageName - Page to render
     */
    renderPage(pageName) {
        switch (pageName) {
            case 'dashboard':
                dashboard.refresh();
                break;
            case 'soldiers':
                soldiers.render();
                break;
            case 'attendance':
                attendance.render();
                break;
            case 'training':
                training.render();
                break;
            case 'leave':
                leave.render();
                break;
            case 'equipment':
                equipment.render();
                break;
            case 'movement':
                personnelMovement.init();
                personnelMovement.render();
                break;
            case 'patrol':
                guardPatrol.render();
                break;
            case 'calendar':
                calendar.init();
                break;
            case 'reports':
                // Reports are generated on demand
                break;
            case 'users':
                auth.renderUserManagement();
                break;
            case 'settings':
                settings.loadSettings();
                settings.updateSyncCounts();
                break;
        }
    },

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        document.getElementById('sidebar')?.classList.toggle('open');
    },

    /**
     * Close sidebar
     */
    closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('open');
    },

    /**
     * Setup modal functionality
     */
    setupModal() {
        // Close on overlay click
        document.querySelector('.modal-overlay')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },

    /**
     * Show modal
     * @param {string} title - Modal title
     * @param {string} content - Modal body content HTML
     * @param {Array} buttons - Array of button objects {text, class, onclick}
     */
    showModal(title, content, buttons = []) {
        const container = document.getElementById('modal-container');
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');
        const footerEl = document.getElementById('modal-footer');

        if (!container || !titleEl || !bodyEl || !footerEl) return;

        titleEl.textContent = title;
        bodyEl.innerHTML = content;

        footerEl.innerHTML = buttons.map(btn =>
            `<button class="btn ${btn.class}" onclick="${btn.onclick}">${btn.text}</button>`
        ).join('');

        container.classList.remove('hidden');
    },

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('modal-container')?.classList.add('hidden');
    },

    /**
     * Show confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {Function} onConfirm - Callback on confirm
     */
    showConfirm(title, message, onConfirm) {
        const confirmId = 'confirm_' + Date.now();
        window[confirmId] = () => {
            this.closeModal();
            onConfirm();
            delete window[confirmId];
        };

        this.showModal(title, `<p>${message}</p>`, [
            { text: 'ยกเลิก', class: 'btn-outline', onclick: 'app.closeModal()' },
            { text: 'ยืนยัน', class: 'btn-danger', onclick: `window['${confirmId}']()` }
        ]);
    },

    /**
     * Show toast notification
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     */
    showToast(type, title, message = '') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'warning-circle',
            info: 'info'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="ph ph-${icons[type] || 'info'}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close icon-btn" onclick="this.parentElement.remove()">
                <i class="ph ph-x"></i>
            </button>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message = 'กำลังโหลด...') {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = loadingScreen?.querySelector('p');

        if (loadingScreen) {
            if (loadingText) loadingText.textContent = message;
            loadingScreen.classList.remove('hidden');
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loading-screen')?.classList.add('hidden');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
