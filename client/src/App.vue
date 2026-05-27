<template>
  <div class="app">
    <header class="top-nav">
      <div class="nav-container">
        <!-- Terminal window controls -->
        <div class="window-controls" aria-hidden="true">
          <span class="window-dot close"></span>
          <span class="window-dot min"></span>
          <span class="window-dot max"></span>
        </div>
        <div class="logo">
          <h1>{{ t('nav.companyName') }}</h1>
          <span class="subtitle">{{ t('nav.subtitle') }}</span>
          <span class="caret" aria-hidden="true">▮</span>
        </div>
        <nav class="nav-tabs">
          <router-link to="/" :class="{ active: $route.path === '/' }">
            {{ t('nav.overview') }}
          </router-link>
          <router-link to="/inventory" :class="{ active: $route.path === '/inventory' }">
            {{ t('nav.inventory') }}
          </router-link>
          <router-link to="/orders" :class="{ active: $route.path === '/orders' }">
            {{ t('nav.orders') }}
          </router-link>
          <router-link to="/spending" :class="{ active: $route.path === '/spending' }">
            {{ t('nav.finance') }}
          </router-link>
          <router-link to="/demand" :class="{ active: $route.path === '/demand' }">
            {{ t('nav.demandForecast') }}
          </router-link>
          <router-link to="/restocking" :class="{ active: $route.path === '/restocking' }">
            {{ t('nav.restocking') }}
          </router-link>
          <router-link to="/reports" :class="{ active: $route.path === '/reports' }">
            {{ t('nav.reports') }}
          </router-link>
        </nav>
        <LanguageSwitcher />
        <ProfileMenu
          @show-profile-details="showProfileDetails = true"
          @show-tasks="showTasks = true"
        />
      </div>
    </header>
    <FilterBar />
    <main class="main-content">
      <router-view />
    </main>

    <ProfileDetailsModal
      :is-open="showProfileDetails"
      @close="showProfileDetails = false"
    />

    <TasksModal
      :is-open="showTasks"
      :tasks="tasks"
      @close="showTasks = false"
      @add-task="addTask"
      @delete-task="deleteTask"
      @toggle-task="toggleTask"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { api } from './api'
import { useAuth } from './composables/useAuth'
import { useI18n } from './composables/useI18n'
import FilterBar from './components/FilterBar.vue'
import ProfileMenu from './components/ProfileMenu.vue'
import ProfileDetailsModal from './components/ProfileDetailsModal.vue'
import TasksModal from './components/TasksModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'

export default {
  name: 'App',
  components: {
    FilterBar,
    ProfileMenu,
    ProfileDetailsModal,
    TasksModal,
    LanguageSwitcher
  },
  setup() {
    const { currentUser } = useAuth()
    const { t } = useI18n()
    const showProfileDetails = ref(false)
    const showTasks = ref(false)
    const apiTasks = ref([])

    // Merge mock tasks from currentUser with API tasks
    const tasks = computed(() => {
      return [...currentUser.value.tasks, ...apiTasks.value]
    })

    const loadTasks = async () => {
      try {
        apiTasks.value = await api.getTasks()
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }

    const addTask = async (taskData) => {
      try {
        const newTask = await api.createTask(taskData)
        // Add new task to the beginning of the array
        apiTasks.value.unshift(newTask)
      } catch (err) {
        console.error('Failed to add task:', err)
      }
    }

    const deleteTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const isMockTask = currentUser.value.tasks.some(t => t.id === taskId)

        if (isMockTask) {
          // Remove from mock tasks
          const index = currentUser.value.tasks.findIndex(t => t.id === taskId)
          if (index !== -1) {
            currentUser.value.tasks.splice(index, 1)
          }
        } else {
          // Remove from API tasks
          await api.deleteTask(taskId)
          apiTasks.value = apiTasks.value.filter(t => t.id !== taskId)
        }
      } catch (err) {
        console.error('Failed to delete task:', err)
      }
    }

    const toggleTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const mockTask = currentUser.value.tasks.find(t => t.id === taskId)

        if (mockTask) {
          // Toggle mock task status
          mockTask.status = mockTask.status === 'pending' ? 'completed' : 'pending'
        } else {
          // Toggle API task
          const updatedTask = await api.toggleTask(taskId)
          const index = apiTasks.value.findIndex(t => t.id === taskId)
          if (index !== -1) {
            apiTasks.value[index] = updatedTask
          }
        }
      } catch (err) {
        console.error('Failed to toggle task:', err)
      }
    }

    onMounted(loadTasks)

    return {
      t,
      showProfileDetails,
      showTasks,
      tasks,
      addTask,
      deleteTask,
      toggleTask
    }
  }
}
</script>

<style>
/* ============================================================
   Dracula "Modern Terminal" Theme — CSS Variables
   Single source of truth for all components
   ============================================================ */
:root {
  /* Dracula base palette */
  --drac-bg:        #282a36;
  --drac-bg-deep:   #21222c;
  --drac-surface:   #2d2f3d;
  --drac-surface-2: #343746;
  --drac-line:      #44475a;
  --drac-fg:        #f8f8f2;
  --drac-muted:     #6272a4;
  --drac-cyan:      #8be9fd;
  --drac-green:     #50fa7b;
  --drac-orange:    #ffb86c;
  --drac-pink:      #ff79c6;
  --drac-purple:    #bd93f9;
  --drac-red:       #ff5555;
  --drac-yellow:    #f1fa8c;

  /* Semantic roles — prefer these in components */
  --bg:          var(--drac-bg);
  --bg-deep:     var(--drac-bg-deep);
  --surface:     var(--drac-surface);
  --surface-2:   var(--drac-surface-2);
  --border:      var(--drac-line);
  --text:        var(--drac-fg);
  --text-muted:  var(--drac-muted);
  --accent:      var(--drac-purple);
  --link:        var(--drac-cyan);
  --success:     var(--drac-green);
  --warning:     var(--drac-orange);
  --danger:      var(--drac-red);
  --info:        var(--drac-cyan);
  --highlight:   var(--drac-pink);

  /* Fonts — mono for data/UI, sans for prose */
  --font-mono: 'JetBrains Mono','Fira Code','SF Mono','Cascadia Code',ui-monospace,Menlo,Consolas,monospace;
  --font-sans: 'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;

  /* Effects */
  --radius: 8px;
  --shadow: 0 2px 10px rgba(0,0,0,0.45);
  --glow-accent: 0 0 0 1px rgba(189,147,249,0.35), 0 0 14px rgba(189,147,249,0.22);
  --glow-cyan:   0 0 0 1px rgba(139,233,253,0.35), 0 0 14px rgba(139,233,253,0.22);
}

/* ============================================================
   Reset
   ============================================================ */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* ============================================================
   Body — mono base for terminal feel; prose opts into sans
   ============================================================ */
body {
  font-family: var(--font-mono);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ============================================================
   Selection
   ============================================================ */
::selection {
  background: rgba(189,147,249,0.35);
  color: var(--text);
}

/* ============================================================
   Custom scrollbars
   ============================================================ */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg-deep); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ============================================================
   App shell
   ============================================================ */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ============================================================
   Top nav — dark terminal chrome
   ============================================================ */
.top-nav {
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 0 2rem;
  height: 70px;
}

.nav-container > .nav-tabs {
  margin-left: auto;
  margin-right: 1rem;
}

.nav-container > .language-switcher {
  margin-right: 1rem;
}

/* ============================================================
   Terminal window-control dots
   ============================================================ */
.window-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 1rem;
  flex-shrink: 0;
}

.window-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
}

.window-dot.close { background: #ff5555; }
.window-dot.min   { background: #f1fa8c; }
.window-dot.max   { background: #50fa7b; }

/* ============================================================
   Logo / brand
   ============================================================ */
.logo {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.logo h1 {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.025em;
  font-family: var(--font-mono);
}

/* Shell-path styled subtitle */
.subtitle {
  font-size: 0.813rem;
  color: var(--text-muted);
  font-weight: 400;
  padding-left: 0.75rem;
  border-left: 1px solid var(--border);
  font-family: var(--font-mono);
}

/* Blinking caret after the brand */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.caret {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 1rem;
  animation: blink 1s step-end infinite;
  margin-left: 0.125rem;
  line-height: 1;
}

/* ============================================================
   Nav tabs
   ============================================================ */
.nav-tabs {
  display: flex;
  gap: 0.25rem;
}

.nav-tabs a {
  padding: 0.625rem 1.25rem;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
  font-family: var(--font-mono);
}

.nav-tabs a:hover {
  color: var(--text);
  background: var(--surface-2);
}

.nav-tabs a.active {
  color: var(--accent);
  background: rgba(189,147,249,0.10);
}

/* ">" prompt prefix on active tab via CSS — no template changes needed */
.nav-tabs a.active::before {
  content: '> ';
  color: var(--accent);
}

/* Glowing underline on active tab */
.nav-tabs a.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  box-shadow: var(--glow-accent);
  border-radius: 2px;
}

/* ============================================================
   Main content
   ============================================================ */
.main-content {
  flex: 1;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}

/* ============================================================
   Page header
   ============================================================ */
.page-header {
  margin-bottom: 1.5rem;
}

.page-header h2 {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.375rem;
  letter-spacing: -0.025em;
  font-family: var(--font-mono);
}

/* Prose description — uses sans for readability */
.page-header p {
  color: var(--text-muted);
  font-size: 0.938rem;
  font-family: var(--font-sans);
}

/* ============================================================
   Stats grid & cards
   ============================================================ */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--surface);
  padding: 1.25rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.stat-card:hover {
  border-color: var(--accent);
  box-shadow: var(--glow-accent);
}

.stat-label {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.625rem;
  font-family: var(--font-mono);
}

.stat-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.025em;
  font-family: var(--font-mono);
}

.stat-card.warning .stat-value { color: var(--warning); }
.stat-card.success .stat-value { color: var(--success); }
.stat-card.danger  .stat-value { color: var(--danger);  }
.stat-card.info    .stat-value { color: var(--info);    }

/* ============================================================
   Generic card
   ============================================================ */
.card {
  background: var(--surface);
  border-radius: 10px;
  padding: 1.25rem;
  border: 1px solid var(--border);
  margin-bottom: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--border);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.025em;
  font-family: var(--font-mono);
}

/* ============================================================
   Tables
   ============================================================ */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--bg-deep);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: var(--font-mono);
}

td {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border);
  color: var(--text);
  font-size: 0.875rem;
  font-family: var(--font-mono);
}

tbody tr {
  transition: background-color 0.15s ease;
}

tbody tr:hover {
  background: var(--surface-2);
}

/* ============================================================
   Badges — dark translucent tint style
   ============================================================ */
.badge {
  display: inline-block;
  padding: 0.313rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  font-family: var(--font-mono);
  border: 1px solid transparent;
}

.badge.success {
  background: rgba(80,250,123,0.14);
  color: var(--success);
  border-color: rgba(80,250,123,0.32);
}

.badge.warning {
  background: rgba(255,184,108,0.14);
  color: var(--warning);
  border-color: rgba(255,184,108,0.32);
}

.badge.danger {
  background: rgba(255,85,85,0.14);
  color: var(--danger);
  border-color: rgba(255,85,85,0.32);
}

/* shipped maps to info/cyan */
.badge.info,
.badge.shipped {
  background: rgba(139,233,253,0.14);
  color: var(--info);
  border-color: rgba(139,233,253,0.32);
}

/* Trend badges */
.badge.increasing {
  background: rgba(80,250,123,0.14);
  color: var(--success);
  border-color: rgba(80,250,123,0.32);
}

.badge.decreasing {
  background: rgba(255,85,85,0.14);
  color: var(--danger);
  border-color: rgba(255,85,85,0.32);
}

.badge.stable {
  background: rgba(139,233,253,0.14);
  color: var(--info);
  border-color: rgba(139,233,253,0.32);
}

/* Priority badges */
.badge.high {
  background: rgba(255,85,85,0.14);
  color: var(--danger);
  border-color: rgba(255,85,85,0.32);
}

.badge.medium {
  background: rgba(255,184,108,0.14);
  color: var(--warning);
  border-color: rgba(255,184,108,0.32);
}

.badge.low {
  background: rgba(80,250,123,0.14);
  color: var(--success);
  border-color: rgba(80,250,123,0.32);
}

/* ============================================================
   Loading / error states
   ============================================================ */
.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
  font-size: 0.938rem;
  font-family: var(--font-mono);
}

.error {
  background: rgba(255,85,85,0.10);
  border: 1px solid rgba(255,85,85,0.35);
  color: var(--danger);
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 0.938rem;
  font-family: var(--font-mono);
}
</style>
