// ============================================
// GLOBAL UTILITIES AND HELPER FUNCTIONS
// ============================================

// Format timestamp to readable format
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show notification toast
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existing = document.querySelector('.custom-notification');
    if (existing) {
        existing.remove();
    }

    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3 custom-notification`;
    alert.style.zIndex = '9999';
    alert.style.minWidth = '300px';
    alert.innerHTML = `
        <strong>${message}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alert);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }
    }, 4000);
}

// Highlight active navigation link
document.addEventListener('DOMContentLoaded', function () {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath || (currentPath === '/' && linkPath === '/')) {
            link.classList.add('active');
            link.style.fontWeight = 'bold';
        } else {
            link.classList.remove('active');
        }
    });
});

// Smooth scroll to top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Validate form inputs
function validateQuery(query) {
    if (!query || query.trim().length < 3) {
        showNotification('Please enter at least 3 characters', 'warning');
        return false;
    }
    return true;
}

// Format score as percentage
function formatScore(score) {
    return Math.round(score * 100);
}

// Get progress bar color based on score
function getProgressColor(score) {
    const percentage = formatScore(score);
    if (percentage >= 70) return 'success';
    if (percentage >= 50) return 'warning';
    return 'info';
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Check if user is online
function checkOnlineStatus() {
    if (!navigator.onLine) {
        showNotification('You are offline. Some features may not work.', 'warning');
        return false;
    }
    return true;
}

// Add event listeners for online/offline status
window.addEventListener('online', () => {
    showNotification('Connection restored', 'success');
});

window.addEventListener('offline', () => {
    showNotification('You are offline', 'warning');
});

// Log errors to console with context
function logError(context, error) {
    console.error(`[${context}] Error:`, error);
}

// ============================================
// RECOMMENDATION PAGE FUNCTIONS
// ============================================

function getSessionId() {
    let sessionId = localStorage.getItem('smart_course_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('smart_course_session_id', sessionId);
    }
    return sessionId;
}

// Handle recommendation form submission
function initializeRecommendationPage() {
    const form = document.getElementById('recommendationForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const query = document.getElementById('queryInput').value.trim();
        const model = document.querySelector('[name="model"]:checked').value;

        // Validate inputs
        if (!validateQuery(query)) return;

        if (!model) {
            showNotification('Please select a recommendation model', 'warning');
            return;
        }

        // Check online status
        if (!checkOnlineStatus()) return;

        const generateBtn = form.querySelector('button[type="submit"]');
        if (generateBtn) generateBtn.disabled = true;

        // Show loading state
        showLoading();
        hideResults();
        hideNoResults();

        try {
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, model, session_id: getSessionId() })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Hide loading
            hideLoading();

            if (data.success && data.recommendations && data.recommendations.length > 0) {
                displayResults(data.recommendations, model);
                showNotification(`Found ${data.recommendations.length} courses!`, 'success');
            } else {
                showNoResults();
                showNotification('No courses found. Try different keywords.', 'info');
            }

        } catch (error) {
            logError('Recommendation API', error);
            hideLoading();
            showNotification('An error occurred. Please try again.', 'danger');
        } finally {
            if (generateBtn) generateBtn.disabled = false;
        }
    });
}

// Show loading spinner
function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'block';

    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');
    if (btnSpinner) btnSpinner.classList.remove('d-none');
    if (btnText) btnText.textContent = 'Generating...';
}

// Hide loading spinner
function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';

    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');
    if (btnSpinner) btnSpinner.classList.add('d-none');
    if (btnText) btnText.textContent = 'Generate Results';
}

// Show results container
function showResults() {
    const container = document.getElementById('resultsContainer');
    if (container) container.style.display = 'block';
}

// Hide results container
function hideResults() {
    const container = document.getElementById('resultsContainer');
    if (container) container.style.display = 'none';
}

// Show no results message
function showNoResults() {
    const noResults = document.getElementById('noResults');
    if (noResults) noResults.style.display = 'block';
}

// Hide no results message
function hideNoResults() {
    const noResults = document.getElementById('noResults');
    if (noResults) noResults.style.display = 'none';
}

// Display recommendation results
function displayResults(recommendations, model) {
    window.recommendations = recommendations;
    window.model = model;
    const container = document.getElementById('resultsContent');
    const headerTitle = document.getElementById('resultsCountHeader');
    const subtitle = document.getElementById('resultsModelSubtitle');
    const badge = document.getElementById('resultsCountBadge');

    if (!container) return;

    const count = recommendations.length;
    const modelName = model === 'tfidf' ? 'TF-IDF (Keyword)' : 'Semantic Neural';
    const modelBadgeClass = model === 'tfidf' ? 'bg-info' : 'bg-primary-subtle text-primary';
    const modelBadgeText = model === 'tfidf' ? 'TF-IDF Engine' : 'Neural Engine';

    if (headerTitle) headerTitle.textContent = `Top ${count} Recommendations`;
    if (subtitle) subtitle.textContent = `Showing results based on ${modelName} Model`;
    if (badge) badge.textContent = `${count} Courses Found`;

    // Build results HTML
    let html = '';
    recommendations.forEach((course, index) => {
        const score = formatScore(course.score);
        const progressColor = getProgressColor(course.score);

        // Escape HTML to prevent XSS
        const courseName = escapeHtml(course.course_name || 'Unknown Course');
        const university = escapeHtml(course.university);
        const difficulty = escapeHtml(course.difficulty_level || 'All Levels');
        const rating = course.course_rating && course.course_rating !== 'None' ? escapeHtml(course.course_rating.toString()) : 'N/A';
        const skills = escapeHtml(course.skills || '');
        let description = escapeHtml(course.description || '');
        description = description.replace(/�/g, "");
        const courseUrl = course.course_url ? escapeHtml(course.course_url) : '#';

        // Stars HTML logic
        let starsHtml = '';
        if (rating !== 'N/A') {
            const ratingNum = parseFloat(rating);
            const fullStars = Math.floor(ratingNum);
            const hasHalfStar = ratingNum % 1 >= 0.5;
            for (let i = 0; i < fullStars; i++) starsHtml += '<i class="bi bi-star-fill text-warning"></i>';
            if (hasHalfStar) starsHtml += '<i class="bi bi-star-half text-warning"></i>';
            const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
            for (let i = 0; i < emptyStars; i++) starsHtml += '<i class="bi bi-star text-warning"></i>';
            starsHtml += ` <span class="ms-1 fw-bold text-dark">${rating}</span>`;
        }

        html += `
    <div class="card course-card shadow-sm mb-4 p-3 fade-in" style="animation-delay: ${index * 0.1}s">
        <div class="row align-items-start">
            <div class="col-md-9">
                <div class="d-flex align-items-center mb-2">
                    <span class="badge ${modelBadgeClass} badge-model me-2">${modelBadgeText}</span>
                    <h5 class="card-title fw-bold mb-0">${courseName}</h5>
                </div>
                <p class="text-secondary small mb-1">
                    ${university ? `<i class="bi bi-building me-1"></i> ${university}` : ''} 
                    | 
                    <i class="bi bi-tag me-1"></i> ${difficulty}
                </p>
                <div class="mb-2">
                    ${rating !== 'N/A' ? `<span class="">${starsHtml}</span>` : ''}
                </div>
                <p class="card-text course-description-clamp">${description}</p>
            </div>
            <div class="col-md-3 border-start text-center">
                <div class="mb-3">
                    <label class="small fw-bold text-muted">Relevance Score</label>
                    <h3 class="fw-bold text-${progressColor}">${score}%</h3>
                    <div class="progress relevance-bar">
                        <div class="progress-bar bg-${progressColor}" style="width: ${score}%"></div>
                    </div>
                </div>
                <button class="btn btn-outline-success btn-sm w-100 mb-2" onclick="saveCourse(${course.course_id})">
                    <i class="bi bi-bookmark-plus me-1"></i> Save Course
                </button>
                <a href="${courseUrl}" target="_blank" class="btn btn-link btn-sm text-decoration-none">View Details</a>
            </div>
        </div>
    </div>
        `;
    });

    container.innerHTML = html;
    showResults();
    scrollToTop();
}

// Save course to database
async function saveCourse(courseId) {
    if (!checkOnlineStatus()) return;

    try {
        const course = window.recommendations.find(r => r.course_id === courseId);
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...course,
                session_id: getSessionId()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            showNotification(`"${course.course_name}" saved successfully!`, 'success');
        } else {
            throw new Error('Failed to save course');
        }

    } catch (error) {
        logError('Save Course API', error);
        showNotification('Failed to save course. Please try again.', 'danger');
    }
}

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '`': '&#x60;'
    };
    return text.replace(/[&<>"'`]/g, m => map[m]);
}

// ============================================
// DASHBOARD PAGE FUNCTIONS
// ============================================

// Initialize dashboard
function initializeDashboard() {
    if (!window.location.pathname.includes("/dashboard")) return;

    loadDashboardData();
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch(`/api/history?session_id=${getSessionId()}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Update statistics
            updateStatistics(data);

            // Display search history
            displaySearchHistory(data.search_history || []);

            // Display saved recommendations
            displaySavedCourses(data.search_history, data.saved_courses || []);

            initHistory();
        } else {
            throw new Error('Failed to load dashboard data');
        }

    } catch (error) {
        logError('Dashboard API', error);
        showError('historyContent', 'Failed to load dashboard data. Please refresh the page.');
        showError('savedContent', 'Failed to load saved courses.');
    }
}

// Update statistics cards
function updateStatistics(data) {
    const totalSearches = document.getElementById('totalSearches');
    const totalSaved = document.getElementById('totalSaved');
    const recentSearches = document.getElementById('recentSearches');

    if (totalSearches) {
        animateCounter(totalSearches, data.total_searches || 0);
    }
    if (totalSaved) {
        animateCounter(totalSaved, data.total_saved || 0);
    }
    if (recentSearches) {
        animateCounter(recentSearches, data.recent_count || 0);
    }
}

// Animate counter
function animateCounter(element, target) {
    let current = 0;
    const increment = target / 20;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 50);
}

// Format relative time (Today/Yesterday)
function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const parts = dateString.split(' ');
    if (parts.length !== 2) return dateString;

    const [year, month, day] = parts[0].split('-');
    const [hourStr, minute] = parts[1].split(':');

    const inputDate = new Date(year, month - 1, day);
    let hour = parseInt(hourStr);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // 0 becomes 12
    const formattedTime = `${hour}:${minute} ${ampm}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCompare = new Date(inputDate);
    dateToCompare.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - dateToCompare.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return `Today, ${formattedTime}`;
    } else if (diffDays === 1) {
        return `Yesterday, ${formattedTime}`;
    } else {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[inputDate.getMonth()]} ${parseInt(day)}, ${formattedTime}`;
    }
}

// Display search history
function displaySearchHistory(history) {
    const container = document.getElementById('historyContent');

    let html = '';
    if (history.length === 0) {
        html = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox" style="font-size: 4rem; opacity: 0.5;"></i>
                <h5 class="mt-3">No Search History</h5>
                <p>Start by searching for courses to see your history here!</p>
                <a href="/recommend" class="btn btn-primary mt-3">
                    <i class="bi bi-search me-2"></i>Get Recommendations
                </a>
            </div>
        `;
    }
    history.forEach((item, index) => {
        const isActive = index === 0 ? 'active' : '';
        const formattedTime = formatRelativeTime(item.timestamp);

        html += `
            <a href="javascript:void(0)" data-section="${item.query.replace(/\s/g, '')}" data-query="${escapeHtml(item.query)}" class="list-group-item list-group-item-action history-item ${isActive} border-0 rounded mb-2 p-3 fade-in" style="animation-delay: ${index * 0.05}s">
                <div class="d-flex w-100 justify-content-between">
                    <small class="fw-bold">"${escapeHtml(item.query)}"</small>
                </div>
                <small class="text-muted">${formattedTime}</small>
            </a>
        `;
    });

    container.innerHTML = html;
}

// Display saved courses grouped by session
function displaySavedCourses(searchHistory, coursesObj) {
    const container = document.getElementById('savedContent');
    if (!container) return;

    if (!searchHistory || Object.keys(searchHistory).length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-bookmark" style="font-size: 4rem; opacity: 0.5;"></i>
                <h5 class="mt-3">No Saved Courses</h5>
                <p>Save courses from your recommendations to see them here!</p>
                <a href="/recommend" class="btn btn-primary mt-3">
                    <i class="bi bi-search me-2"></i>Find Courses
                </a>
            </div>
        `;
        return;
    }

    let html = '';
    Object.values(searchHistory).forEach((item, sectionIndex) => {
        let courses = coursesObj[item.query];

        html += `
            <section id="${item.query.replace(/\s/g, '')}" class="content-section ${sectionIndex === 0 ? 'active' : ''} mb-5 fade-in" style="animation-delay: ${sectionIndex * 0.1}s">
                <div class="d-flex justify-content-between align-items-center">
                    <h2 class="fw-bold mb-3 text-secondary">
                        <i class="bi bi-journal-bookmark list-group-icon me-2"></i>Session Insight: <span class="text-primary">"${escapeHtml(item.query)}"</span>
                    </h2>
                    <span class="badge bg-light text-dark border">${item.model_type == "tfidf" ? 'TF-IDF Model' : 'Neural Model'}</span>
                </div>
                
                <div id="comparison-${item.query.replace(/\s/g, '')}"></div>

                <h5 class="fw-bold mb-0 text-secondary mt-4" style="padding-left: 12px;">
                    Saved ${courses ? courses.length : 0} courses from this Session
                </h5>
                <div class="row row-cols-1 row-cols-md-2 g-4 m-0 display-grid-auto-rows stretch-card-row">
        `;

        courses && courses.forEach((course, index) => {
            const score = formatScore(course.score);
            const progressColor = getProgressColor(course.score);

            html += `
                <div class="col" style="display: flex;">
                    <div class="card h-100 shadow-sm w-100 border-start border-${progressColor} border-4 d-flex flex-column">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div class="flex-grow-1">
                                    <h5 class="card-title fw-bold mb-1">
                                        <i class="bi bi-bookmark-fill text-${progressColor} me-1"></i>
                                        ${escapeHtml(course.course_name)}
                                    </h5>
                                </div>
                                <span class="badge score-badge bg-${progressColor} ms-2">${score}%</span>
                            </div>
                            <p class="text-muted small mb-0"><i class="bi bi-building me-1"></i> ${escapeHtml(course.university)} | <i class="bi bi-tag me-1"></i> ${escapeHtml(course.difficulty_level)}</p>
                            <hr>
                            <p class="card-text text-muted mb-3 flex-grow-1 course-description-clamp">${escapeHtml(course.description)}</p>
                            <hr class="mt-auto">
                            <small class="text-muted d-flex justify-content-between align-items-center">
                                <span><i class="bi bi-clock me-1"></i>Saved: ${course.timestamp}</span>
                            </small>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </section>
        `;
    });

    container.innerHTML = html;
}

// Show error message
function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }
}

function initHistory() {
    const historyItems = Object.values(document.getElementById('historyContent').children);
    historyItems.forEach(item => {
        item.addEventListener('click', function () {
            historyItems.forEach(item => {
                item.classList.remove('active');
            });
            item.classList.add('active');
            const sectionId = this.getAttribute('data-section');
            const query = this.getAttribute('data-query');
            const section = document.getElementById(sectionId);
            Object.values(document.getElementById('savedContent').children).forEach(item => {
                item.classList.remove('active');
            });
            if (section) section.classList.add('active');
            loadComparison(query, sectionId);
        });
    });

    if (historyItems.length > 0) {
        const firstItem = historyItems[0];
        const sectionId = firstItem.getAttribute('data-section');
        const query = firstItem.getAttribute('data-query');
        loadComparison(query, sectionId);
    }
}

async function loadComparison(query, sectionId) {
    const container = document.getElementById(`comparison-${sectionId}`);
    if (!container || container.dataset.loaded === 'true') return;

    container.innerHTML = `
        <div class="text-center p-4 my-3 text-muted">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Analyzing model comparison...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/compare?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success) {
            container.dataset.loaded = 'true';

            let tfidfRows = '';
            data.tfidf.forEach((item, index) => {
                const score = (item.score * 100).toFixed(0);
                tfidfRows += `
                    <div class="mb-3">
                        <span class="fw-bold small">${index + 1}. ${escapeHtml(item.course_name)}</span><br>
                        <small class="text-success"><i class="bi bi-check2-circle"></i> ${escapeHtml(item.explanation)}</small><br>
                        <small class="text-muted">${escapeHtml(item.matched_terms)}</small><br>
                        <span class="badge bg-primary-subtle text-primary score-badge">Score: ${score}%</span>
                    </div>
                `;
            });

            let neuralRows = '';
            data.neural.forEach((item, index) => {
                const score = (item.score * 100).toFixed(0);
                neuralRows += `
                    <div class="mb-3">
                        <span class="fw-bold small">${index + 1}. ${escapeHtml(item.course_name)}</span><br>
                        <small class="text-success"><i class="bi bi-check2-circle"></i> ${escapeHtml(item.explanation)}</small><br>
                        <small class="text-muted"><i class="bi bi-check2-circle"></i> Intent-based recommendation</small><br>
                        <span class="badge bg-success-subtle text-success score-badge">Score: ${score}% Semantic</span>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="mb-4 mt-4 fade-in">
                    <h5 class="fw-bold mb-3 text-secondary">Model Comparison Analysis</h5>
                    <div class="table-responsive shadow-sm border rounded mb-4">
                        <table class="table mb-0">
                            <thead class="comparison-header text-center">
                                <tr>
                                    <th width="50%" class="border-end text-primary"><i class="bi bi-fonts me-2"></i>TF-IDF Results</th>
                                    <th width="50%" class="text-success"><i class="bi bi-cpu me-2"></i>Neural Results</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="border-end p-3 align-top">
                                        ${tfidfRows}
                                    </td>
                                    <td class="p-3 align-top">
                                        ${neuralRows}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="alert alert-danger">Failed to load comparison.</div>`;
        }
    } catch (error) {
        logError('Comparison', error);
        container.innerHTML = `<div class="alert alert-danger">Error loading comparison.</div>`;
    }
}

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('Smart Course AI - Initializing...');

    // Initialize based on current page
    const path = window.location.pathname;

    if (path.includes('/recommend')) {
        initializeRecommendationPage();
        console.log('Recommendation page initialized');
    } else if (path.includes('/dashboard')) {
        initializeDashboard();
        console.log('Dashboard initialized');
    }
});