// Application State
let feedData = null;
let selectedUpdate = null;
let currentFilters = {
    category: 'all',
    search: ''
};
let selectedHashtags = new Set(['#BigQuery', '#GoogleCloud']);

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterPills = document.querySelectorAll('.pill');
const feedStatus = document.getElementById('feed-status');
const updatesTimeline = document.getElementById('updates-timeline');
const toast = document.getElementById('toast');

// Composer DOM Elements
const composerEmpty = document.getElementById('composer-empty-state');
const composerActive = document.getElementById('composer-active-state');
const selectedDateEl = document.getElementById('composer-selected-date');
const selectedCatEl = document.getElementById('composer-selected-category');
const deselectBtn = document.getElementById('deselect-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const btnShortenUrl = document.getElementById('btn-shorten-url');
const charProgress = document.getElementById('char-progress');
const charCount = document.getElementById('char-count');
const hashtagPills = document.querySelectorAll('.hashtag-pill');
const tweetBtn = document.getElementById('tweet-btn');

// UX Improvements DOM Elements
const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
const composerSettingsPanel = document.getElementById('composer-settings');
const settingsDisplayName = document.getElementById('settings-display-name');
const settingsHandle = document.getElementById('settings-handle');
const previewDisplayName = document.getElementById('preview-display-name');
const previewHandle = document.getElementById('preview-handle');
const copyBtn = document.getElementById('copy-btn');

// Progress Circle Setup
const circleRadius = 11;
const circumference = circleRadius * 2 * Math.PI;
if (charProgress) {
    charProgress.style.strokeDasharray = `${circumference} ${circumference}`;
    charProgress.style.strokeDashoffset = `${circumference}`;
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    // Fetch initial feed data
    fetchFeed(false);
    
    // Add Event Listeners
    setupEventListeners();
});

// Setup All App Event Listeners
function setupEventListeners() {
    // Refresh Button
    refreshBtn.addEventListener('click', () => fetchFeed(true));
    
    // Search Box
    searchInput.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.trim().toLowerCase();
        clearSearchBtn.style.display = currentFilters.search ? 'flex' : 'none';
        renderTimeline();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentFilters.search = '';
        clearSearchBtn.style.display = 'none';
        renderTimeline();
    });
    
    // Category Pills
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilters.category = pill.dataset.category;
            renderTimeline();
        });
    });
    
    // Deselect Update
    deselectBtn.addEventListener('click', deselectActiveUpdate);
    
    // Tweet Textarea Typing
    tweetTextarea.addEventListener('input', () => {
        updateCharacterCount();
    });
    
    // Auto-shorten Draft
    btnShortenUrl.addEventListener('click', () => {
        if (!selectedUpdate) return;
        shortenTweetText();
    });
    
    // Hashtag Toggles
    hashtagPills.forEach(pill => {
        const tag = pill.dataset.tag;
        // Check initial state
        if (selectedHashtags.has(tag)) {
            pill.classList.add('active');
        }
        
        pill.addEventListener('click', () => {
            if (selectedHashtags.has(tag)) {
                selectedHashtags.delete(tag);
                pill.classList.remove('active');
            } else {
                selectedHashtags.add(tag);
                pill.classList.add('active');
            }
            regenerateTweetDraft(false);
        });
    });
    
    // Tweet Publish Button
    tweetBtn.addEventListener('click', () => {
        if (tweetBtn.disabled) return;
        const text = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        showToast('Redirected to Twitter web intent!', 'success');
    });

    // UX improvements: Profile Customization settings toggle
    toggleSettingsBtn.addEventListener('click', () => {
        const isHidden = composerSettingsPanel.style.display === 'none';
        composerSettingsPanel.style.display = isHidden ? 'block' : 'none';
    });

    // UX improvements: Profile settings input event handlers
    settingsDisplayName.addEventListener('input', (e) => {
        const val = e.target.value.trim() || 'Cloud Architect';
        previewDisplayName.innerText = val;
    });

    settingsHandle.addEventListener('input', (e) => {
        let val = e.target.value.trim() || 'cloud_advocate';
        // Ensure single @ prefix
        val = val.replace(/^@+/, '');
        previewHandle.innerText = `@${val}`;
    });

    // UX improvements: Copy to Clipboard Button
    copyBtn.addEventListener('click', async () => {
        const text = tweetTextarea.value;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Draft copied to clipboard!', 'success');
        } catch (err) {
            console.error('Clipboard copy failed:', err);
            showToast('Failed to copy to clipboard.', 'error');
        }
    });
}

// Fetch Feed API
async function fetchFeed(forceRefresh = false) {
    try {
        setLoadingState(true);
        const url = forceRefresh ? '/api/feed?refresh=true' : '/api/feed';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        feedData = data;
        
        if (data.warning) {
            showToast(data.warning, 'info');
        } else if (forceRefresh) {
            showToast('Feed refreshed successfully!', 'success');
        }
        
        renderTimeline();
        
    } catch (error) {
        console.error('Fetch error:', error);
        showToast(`Failed to retrieve feed: ${error.message}`, 'error');
        showStatusError(error.message);
    } finally {
        setLoadingState(false);
    }
}

// Update UI Loading States
function setLoadingState(isLoading) {
    if (isLoading) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
        refreshBtn.querySelector('.btn-text').innerText = 'Updating...';
        
        // Show loader if no data exists yet
        if (!feedData) {
            feedStatus.style.display = 'flex';
            feedStatus.innerHTML = `
                <i data-lucide="refresh-cw" class="spinner large-spinner"></i>
                <p>Connecting to Google Feeds...</p>
            `;
            updatesTimeline.style.display = 'none';
            lucide.createIcons();
        }
    } else {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
        refreshBtn.querySelector('.btn-text').innerText = 'Refresh Feed';
    }
}

// Show Error Message on Timeline
function showStatusError(message) {
    feedStatus.style.display = 'flex';
    feedStatus.innerHTML = `
        <div style="color: var(--color-breaking); font-size: 36px; margin-bottom: 10px;">
            <i data-lucide="alert-triangle"></i>
        </div>
        <h3>Failed to Load Feed</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 15px;">Retry Connection</button>
    `;
    updatesTimeline.style.display = 'none';
    lucide.createIcons();
}

// Render Timeline Feed
function renderTimeline() {
    if (!feedData || !feedData.entries) return;
    
    // Filter updates
    const filteredEntries = [];
    
    feedData.entries.forEach(entry => {
        const matchingUpdates = entry.updates.filter(update => {
            // Category check
            const matchesCategory = currentFilters.category === 'all' || update.category === currentFilters.category;
            
            // Search check
            const matchesSearch = !currentFilters.search || 
                update.category.toLowerCase().includes(currentFilters.search) || 
                update.raw_text.toLowerCase().includes(currentFilters.search);
                
            return matchesCategory && matchesSearch;
        });
        
        if (matchingUpdates.length > 0) {
            filteredEntries.push({
                ...entry,
                updates: matchingUpdates
            });
        }
    });
    
    // Render timeline
    if (filteredEntries.length === 0) {
        feedStatus.style.display = 'flex';
        feedStatus.innerHTML = `
            <i data-lucide="search-x" class="large-spinner" style="color: var(--text-muted)"></i>
            <h3>No Updates Match</h3>
            <p>Try refining your search text or changing your filter criteria.</p>
        `;
        updatesTimeline.style.display = 'none';
        lucide.createIcons();
        return;
    }
    
    feedStatus.style.display = 'none';
    updatesTimeline.style.display = 'block';
    
    let html = '';
    
    filteredEntries.forEach(entry => {
        html += `
            <div class="timeline-group">
                <div class="timeline-dot"></div>
                <div class="timeline-date-header">
                    <h3>${entry.date}</h3>
                    <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="timeline-date-link" title="Open original release notes">
                        <i data-lucide="external-link"></i>
                    </a>
                </div>
                
                <div class="timeline-cards">
        `;
        
        entry.updates.forEach(update => {
            const isSelected = selectedUpdate && selectedUpdate.id === update.id;
            const categoryClass = `badge-${update.category.toLowerCase()}`;
            const displayCategory = update.category;
            
            // UX improvement: Collapse card if description content exceeds 320 characters
            const isLongDescription = update.description.length > 320;
            const contentClass = isLongDescription ? 'card-content card-content-collapsed' : 'card-content';
            
            html += `
                <div class="update-card ${isSelected ? 'selected' : ''}" data-update-id="${update.id}">
                    <div class="card-header">
                        <div class="card-meta">
                            <span class="badge ${categoryClass}">${displayCategory}</span>
                        </div>
                        <div class="select-indicator">
                            <i data-lucide="check"></i>
                        </div>
                    </div>
                    <div class="${contentClass}">
                        ${update.description}
                    </div>
                    ${isLongDescription ? `
                    <button class="show-more-btn" data-expanded="false">
                        <span>Show More</span>
                        <i data-lucide="chevron-down"></i>
                    </button>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    updatesTimeline.innerHTML = html;
    lucide.createIcons();
    
    // Attach selection handlers to cards
    document.querySelectorAll('.update-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Prevent selection if clicked on an anchor link or show-more button
            if (e.target.tagName === 'A' || e.target.closest('.show-more-btn')) return;
            
            const updateId = card.dataset.updateId;
            handleCardSelection(updateId);
        });
    });

    // UX improvement: Attach toggle handlers to card expand buttons
    document.querySelectorAll('.show-more-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid triggering card selection on click
            const card = btn.closest('.update-card');
            const content = card.querySelector('.card-content');
            const isExpanded = btn.dataset.expanded === 'true';
            
            if (isExpanded) {
                content.classList.add('card-content-collapsed');
                btn.dataset.expanded = 'false';
                btn.classList.remove('expanded');
                btn.querySelector('span').innerText = 'Show More';
            } else {
                content.classList.remove('card-content-collapsed');
                btn.dataset.expanded = 'true';
                btn.classList.add('expanded');
                btn.querySelector('span').innerText = 'Show Less';
            }
            lucide.createIcons();
        });
    });
}

// Handle Card Selection
function handleCardSelection(updateId) {
    let foundUpdate = null;
    let foundEntry = null;
    
    for (const entry of feedData.entries) {
        const up = entry.updates.find(u => u.id === updateId);
        if (up) {
            foundUpdate = up;
            foundEntry = entry;
            break;
        }
    }
    
    if (!foundUpdate) return;
    
    // Toggle selection
    if (selectedUpdate && selectedUpdate.id === foundUpdate.id) {
        deselectActiveUpdate();
    } else {
        selectedUpdate = {
            ...foundUpdate,
            date: foundEntry.date,
            link: foundEntry.link
        };
        
        // Show Active composer state
        composerEmpty.style.display = 'none';
        composerActive.style.display = 'flex';
        
        // UX improvement: Show profile customization gear button
        toggleSettingsBtn.style.display = 'block';
        
        // Setup details
        selectedDateEl.innerText = selectedUpdate.date;
        selectedCatEl.innerText = selectedUpdate.category;
        selectedCatEl.className = `badge badge-${selectedUpdate.category.toLowerCase()}`;
        
        // Auto-generate tweet draft
        regenerateTweetDraft(true);
        
        // Highlight active card
        document.querySelectorAll('.update-card').forEach(card => {
            if (card.dataset.updateId === updateId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        showToast(`Selected update from ${selectedUpdate.date}`, 'info');
    }
}

// Deselect Update
function deselectActiveUpdate() {
    selectedUpdate = null;
    composerActive.style.display = 'none';
    composerEmpty.style.display = 'flex';
    
    // UX improvement: Hide configuration panels on deselect
    toggleSettingsBtn.style.display = 'none';
    composerSettingsPanel.style.display = 'none';
    
    document.querySelectorAll('.update-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    showToast('Selection cleared.', 'info');
}

// Generate Default Tweet Text
function regenerateTweetDraft(isFirstLoad = false) {
    if (!selectedUpdate) return;
    
    const category = selectedUpdate.category;
    const date = selectedUpdate.date;
    const link = selectedUpdate.link;
    const tags = Array.from(selectedHashtags);
    
    const prefix = `${category} Update (${date}): `;
    const linkSection = `\n\nRead more: ${link}`;
    const tagsSection = tags.length > 0 ? `\n\n${tags.join(' ')}` : '';
    
    const maxDescLength = 280 - (prefix.length + linkSection.length + tagsSection.length + 4);
    
    let descriptionText = selectedUpdate.raw_text;
    
    if (isFirstLoad) {
        if (descriptionText.length > maxDescLength) {
            descriptionText = descriptionText.substring(0, maxDescLength) + '...';
        }
        tweetTextarea.value = `${prefix}"${descriptionText}"${linkSection}${tagsSection}`;
    } else {
        let currentVal = tweetTextarea.value;
        const tagRegex = /(#\w+\s*)+$/;
        if (tagRegex.test(currentVal)) {
            currentVal = currentVal.replace(tagRegex, tags.join(' '));
            tweetTextarea.value = currentVal.trim();
        } else {
            tweetTextarea.value = currentVal.trim() + tagsSection;
        }
    }
    
    updateCharacterCount();
}

// AI Shorten / Smart Truncate Text
function shortenTweetText() {
    if (!selectedUpdate) return;
    
    const category = selectedUpdate.category;
    const date = selectedUpdate.date;
    const link = selectedUpdate.link;
    const tags = Array.from(selectedHashtags);
    
    const prefix = `${category} Update (${date}): `;
    const linkSection = `\n\nRead: ${link}`;
    const tagsSection = tags.length > 0 ? `\n\n${tags.join(' ')}` : '';
    
    const maxDescLength = 280 - (prefix.length + linkSection.length + tagsSection.length + 4);
    
    let text = selectedUpdate.raw_text;
    if (text.length > maxDescLength) {
        let truncated = text.substring(0, maxDescLength);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxDescLength * 0.8) {
            truncated = truncated.substring(0, lastSpace);
        }
        text = truncated + '...';
    }
    
    tweetTextarea.value = `${prefix}"${text}"${linkSection}${tagsSection}`;
    updateCharacterCount();
    showToast('Tweet draft optimized for character limit!', 'success');
}

// Live Character Counting and Circle Progress Ring Update
function updateCharacterCount() {
    const textLength = tweetTextarea.value.length;
    const limit = 280;
    const remaining = limit - textLength;
    
    charCount.innerText = remaining;
    const percent = Math.min((textLength / limit) * 100, 100);
    const offset = circumference - (percent / 100 * circumference);
    charProgress.style.strokeDashoffset = offset;
    
    if (textLength >= limit) {
        charProgress.style.stroke = '#EF4444';
        charCount.className = 'char-count-text error';
        tweetBtn.disabled = true;
    } else if (textLength >= limit - 40) {
        charProgress.style.stroke = '#F59E0B';
        charCount.className = 'char-count-text warn';
        tweetBtn.disabled = false;
    } else {
        charProgress.style.stroke = '#1DA1F2';
        charCount.className = 'char-count-text';
        tweetBtn.disabled = false;
    }
    
    if (textLength === 0) {
        tweetBtn.disabled = true;
    }
}

// Toast Notifications
let toastTimeout = null;
function showToast(message, type = 'info') {
    clearTimeout(toastTimeout);
    
    const toastIcon = document.getElementById('toast-icon');
    const toastMessage = document.getElementById('toast-message');
    
    toastMessage.innerText = message;
    toastIcon.className = `success ${type}`;
    
    if (type === 'success') {
        toastIcon.setAttribute('data-lucide', 'check-circle');
    } else if (type === 'error') {
        toastIcon.setAttribute('data-lucide', 'alert-circle');
    } else {
        toastIcon.setAttribute('data-lucide', 'info');
    }
    
    lucide.createIcons();
    toast.className = 'toast show';
    
    toastTimeout = setTimeout(() => {
        toast.className = 'toast';
    }, 4000);
}
