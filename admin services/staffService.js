/**
 * Staff Service
 * Service for admin staff management - team members and performance tracking
 */

class StaffService {
    constructor() {
        this.staff = [];
        this.container = null;
    }

    /**
     * Initialize the staff service
     * @param {string} containerId - ID of the staff container element
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
    }

    /**
     * Load staff members into the service
     * @param {Array} staff - Array of staff member objects
     */
    loadStaff(staff) {
        this.staff = staff || [];
        this.render();
    }

    /**
     * Render staff members in the container
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        this.staff.forEach(member => {
            const staffCard = this.createStaffCard(member);
            this.container.appendChild(staffCard);
        });
    }

    /**
     * Create staff card element
     * @param {Object} member - Staff member object
     * @returns {HTMLElement} Staff card element
     */
    createStaffCard(member) {
        const card = document.createElement('div');
        card.className = 'glass-card hover:bg-white/15 transition-all duration-300';
        
        const initials = this.getInitials(member.name);
        const avatarColor = this.getAvatarColor(member.id || member.name);

        card.innerHTML = `
            <div class="p-6">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 ${avatarColor} rounded-full flex items-center justify-center">
                        <span class="text-accent-foreground font-bold text-lg">${initials}</span>
                    </div>
                    <div>
                        <h3 class="text-white font-semibold">${member.name}</h3>
                        <p class="text-white/70 text-sm">${member.role || 'Employee'}</p>
                    </div>
                </div>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-white/60">Orders Completed:</span>
                        <span class="text-white">${member.ordersCompleted || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-white/60">Avg Response Time:</span>
                        <span class="text-white">${member.avgResponseTime || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-white/60">Status:</span>
                        <span class="text-accent">${member.status || 'Active'}</span>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    /**
     * Get initials from name
     * @param {string} name - Full name
     * @returns {string} Initials (e.g., "John Doe" -> "JD")
     */
    getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Get avatar color class based on ID or name
     * @param {string|number} identifier - Staff identifier
     * @returns {string} CSS class for avatar color
     */
    getAvatarColor(identifier) {
        const colors = ['bg-accent', 'bg-primary', 'bg-secondary'];
        if (typeof identifier === 'number') {
            return colors[identifier % colors.length];
        }
        const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    /**
     * Add a new staff member
     * @param {Object} member - Staff member object
     */
    addStaffMember(member) {
        this.staff.push(member);
        this.render();
    }

    /**
     * Update staff member
     * @param {number} memberId - Staff member ID
     * @param {Object} updates - Updates to apply
     */
    updateStaffMember(memberId, updates) {
        const index = this.staff.findIndex(m => m.id === memberId);
        if (index !== -1) {
            this.staff[index] = { ...this.staff[index], ...updates };
            this.render();
        }
    }

    /**
     * Remove staff member
     * @param {number} memberId - Staff member ID
     */
    removeStaffMember(memberId) {
        this.staff = this.staff.filter(m => m.id !== memberId);
        this.render();
    }

    /**
     * Get all staff members
     * @returns {Array} Array of all staff members
     */
    getStaff() {
        return [...this.staff];
    }

    /**
     * Get staff member by ID
     * @param {number} memberId - Staff member ID
     * @returns {Object|null} Staff member object or null
     */
    getStaffMember(memberId) {
        return this.staff.find(m => m.id === memberId) || null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StaffService;
}

