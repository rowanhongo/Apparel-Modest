/**
 * Kanban Service
 * Service for managing kanban board tasks and notes
 */

class KanbanService {
    constructor() {
        this.tasks = [];
        this.supabase = null;
    }

    /**
     * Initialize the kanban service
     */
    async init() {
        // Get Supabase client
        this.supabase = getSupabaseClient();
        if (!this.supabase) {
            console.error('❌ Supabase client not available for KanbanService');
            // Try again after a short delay in case Supabase is still initializing
            await new Promise(resolve => setTimeout(resolve, 500));
            this.supabase = getSupabaseClient();
            if (!this.supabase) {
                console.error('❌ Supabase client still not available after retry');
                return;
            }
        }

        console.log('✅ KanbanService initialized');
        // Load all tasks
        await this.loadTasks();
    }

    /**
     * Load all tasks from Supabase
     */
    async loadTasks() {
        try {
            if (!this.supabase) {
                console.error('Supabase client not available');
                this.tasks = [];
                this.renderTasks();
                return;
            }

            const { data: tasks, error } = await this.supabase
                .from('kanban_tasks')
                .select('id, title, description, status, priority, position, created_at, updated_at')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase query error:', error);
                throw error;
            }

            this.tasks = tasks || [];
            console.log(`✅ Loaded ${this.tasks.length} kanban tasks`);
            this.renderTasks();
        } catch (error) {
            console.error('Error loading kanban tasks:', error);
            this.tasks = [];
            this.renderTasks();
        }
    }

    /**
     * Add a new task
     * @param {Object} taskData - Task data object
     * @returns {Promise<Object>} Result object
     */
    async addTask(taskData) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { title, description, status, priority } = taskData;

            if (!title || !title.trim()) {
                throw new Error('Title is required');
            }

            // Get max position for the status
            const maxPosition = await this.getMaxPositionForStatus(status);

            const insertData = {
                title: title.trim(),
                description: description?.trim() || null,
                status: status || 'todo',
                priority: priority || 'medium',
                position: maxPosition + 1
            };

            const { data, error } = await this.supabase
                .from('kanban_tasks')
                .insert([insertData])
                .select()
                .single();

            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }

            await this.loadTasks();
            return {
                success: true,
                message: 'Card added successfully',
                data: data
            };
        } catch (error) {
            console.error('Error adding task:', error);
            return {
                success: false,
                message: error.message || 'Failed to add card'
            };
        }
    }

    /**
     * Update an existing task
     * @param {string} taskId - Task ID
     * @param {Object} taskData - Updated task data
     * @returns {Promise<Object>} Result object
     */
    async updateTask(taskId, taskData) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { title, description, status, priority } = taskData;

            if (!title || !title.trim()) {
                throw new Error('Title is required');
            }

            // If status changed, update position
            const currentTask = this.tasks.find(t => t.id === taskId);
            let position = currentTask?.position || 0;
            
            if (currentTask && currentTask.status !== status) {
                const maxPosition = await this.getMaxPositionForStatus(status);
                position = maxPosition + 1;
            }

            const updateData = {
                title: title.trim(),
                description: description?.trim() || null,
                status: status || 'todo',
                priority: priority || 'medium',
                position: position
            };

            const { data, error } = await this.supabase
                .from('kanban_tasks')
                .update(updateData)
                .eq('id', taskId)
                .select('id, title, description, status, priority, position, created_at, updated_at')
                .single();

            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }

            await this.loadTasks();
            return {
                success: true,
                message: 'Card updated successfully',
                data: data
            };
        } catch (error) {
            console.error('Error updating task:', error);
            return {
                success: false,
                message: error.message || 'Failed to update card'
            };
        }
    }

    /**
     * Delete a task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Result object
     */
    async deleteTask(taskId) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { error } = await this.supabase
                .from('kanban_tasks')
                .delete()
                .eq('id', taskId);

            if (error) {
                throw error;
            }

            await this.loadTasks();
            return {
                success: true,
                message: 'Card deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting task:', error);
            return {
                success: false,
                message: error.message || 'Failed to delete card'
            };
        }
    }

    /**
     * Get max position for a status
     * @param {string} status - Status value
     * @returns {Promise<number>} Max position
     */
    async getMaxPositionForStatus(status) {
        try {
            if (!this.supabase) {
                return 0;
            }

            const { data, error } = await this.supabase
                .from('kanban_tasks')
                .select('position')
                .eq('status', status)
                .order('position', { ascending: false })
                .limit(1);

            if (error) {
                throw error;
            }

            return data && data.length > 0 ? (data[0].position || 0) : 0;
        } catch (error) {
            console.error('Error getting max position:', error);
            return 0;
        }
    }

    /**
     * Format time ago
     * @param {Date} date - Date object
     * @returns {string} Formatted time string
     */
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    }

    /**
     * Get priority colors
     * @param {string} priority - Priority value
     * @returns {Object} Color object
     */
    getPriorityColors(priority) {
        const colors = {
            high: { bg: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' },
            medium: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6' },
            low: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10B981' }
        };
        return colors[priority] || colors.medium;
    }

    /**
     * Render all tasks to the kanban board
     */
    renderTasks() {
        // Clear all columns
        document.querySelectorAll('.kanban-cards').forEach(column => {
            const addBtn = column.querySelector('.add-kanban-card-btn');
            if (addBtn) {
                // Remove all cards except the add button
                const cards = column.querySelectorAll('.kanban-card[data-id]');
                cards.forEach(card => card.remove());
            }
        });

        // Group tasks by status
        const tasksByStatus = {
            todo: [],
            in_progress: [],
            review: [],
            completed: []
        };

        this.tasks.forEach(task => {
            if (tasksByStatus.hasOwnProperty(task.status)) {
                tasksByStatus[task.status].push(task);
            }
        });

        // Render tasks in each column
        Object.keys(tasksByStatus).forEach(status => {
            const column = document.querySelector(`[data-status="${status}"] .kanban-cards`);
            if (!column) return;

            const addBtn = column.querySelector('.add-kanban-card-btn');
            tasksByStatus[status].forEach(task => {
                const card = this.createTaskCard(task);
                if (addBtn) {
                    column.insertBefore(card, addBtn.nextSibling);
                } else {
                    column.appendChild(card);
                }
            });
        });

        // Update counts
        this.updateCounts();
    }

    /**
     * Create a task card element
     * @param {Object} task - Task object
     * @returns {HTMLElement} Card element
     */
    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.setAttribute('data-id', task.id);
        card.setAttribute('data-status', task.status);
        card.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; position: relative; width: 100%; box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word;';
        
        if (task.status === 'completed') {
            card.style.opacity = '0.8';
        }

        const priorityColors = this.getPriorityColors(task.priority);
        const timeAgo = this.formatTimeAgo(new Date(task.created_at));

        card.innerHTML = `
            <div class="flex items-start justify-between mb-2" style="gap: 8px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 0;">
                    <h4 class="text-white font-semibold text-sm mb-1" style="word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4;">${this.escapeHtml(task.title)}</h4>
                </div>
                <div class="flex items-center gap-1" style="flex-shrink: 0;">
                    <span style="background: ${priorityColors.bg}; color: ${priorityColors.color}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; white-space: nowrap;">${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
                    <button onclick="kanbanService.deleteTask('${task.id}')" style="background: rgba(16, 185, 129, 0.3); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.5); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600; opacity: 0; transition: opacity 0.2s; white-space: nowrap; flex-shrink: 0;" class="done-kanban-btn" title="Done">
                        Done
                    </button>
                </div>
            </div>
            <p class="text-white/80 text-sm mb-2" style="word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4; max-width: 100%;">${task.description ? this.escapeHtml(task.description) : '<span class="text-white/40">No description</span>'}</p>
            <div class="flex items-center justify-between" style="gap: 8px; flex-wrap: wrap;">
                <span class="text-white/60 text-xs" style="flex-shrink: 0;">${timeAgo}</span>
                <button onclick="editKanbanCard('${task.id}', '${task.status}')" style="background: rgba(59, 130, 246, 0.2); color: #3B82F6; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; opacity: 0; transition: opacity 0.2s; white-space: nowrap; flex-shrink: 0;" class="edit-kanban-btn" title="Edit">
                    Edit
                </button>
            </div>
        `;

        // Add hover effects
        card.addEventListener('mouseenter', function() {
            this.querySelectorAll('.edit-kanban-btn, .done-kanban-btn').forEach(btn => {
                btn.style.opacity = '1';
            });
        });
        card.addEventListener('mouseleave', function() {
            this.querySelectorAll('.edit-kanban-btn, .done-kanban-btn').forEach(btn => {
                btn.style.opacity = '0';
            });
        });

        return card;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update card counts
     */
    updateCounts() {
        const statuses = ['todo', 'in_progress', 'review', 'completed'];
        statuses.forEach(status => {
            const column = document.querySelector(`[data-status="${status}"]`);
            if (column) {
                const cards = column.querySelectorAll('.kanban-card[data-id]');
                const countEl = document.getElementById(`kanban-count-${status}`);
                if (countEl) {
                    countEl.textContent = cards.length;
                }
            }
        });
    }
}

// Create global instance
const kanbanService = new KanbanService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KanbanService;
}

