import { photoStorage } from '../geo/photoStorage.js';
import { t } from '../i18n/translations.js';

export class CalendarModal {
  constructor(streakService, lang = 'pl') {
    this.streakService = streakService;
    this.currentLang = lang;

    this.modal = document.getElementById('modal-calendar');
    this.btnClose = document.getElementById('modal-calendar-close');

    // Tab Buttons
    this.tabBtnCalendar = document.getElementById('tab-btn-calendar');
    this.tabBtnGallery = document.getElementById('tab-btn-gallery');
    this.tabBtnStreak = document.getElementById('tab-btn-streak');

    this.tabCalendarText = document.getElementById('tab-calendar-text');
    this.tabGalleryText = document.getElementById('tab-gallery-text');
    this.tabStreakText = document.getElementById('tab-streak-text');

    // Tab Views
    this.viewTabCalendar = document.getElementById('view-tab-calendar');
    this.viewTabGallery = document.getElementById('view-tab-gallery');
    this.viewTabStreak = document.getElementById('view-tab-streak');

    // Calendar Elements
    this.gridDays = document.getElementById('calendar-grid-days');
    this.monthTitle = document.getElementById('calendar-month-title');
    this.btnPrev = document.getElementById('btn-calendar-prev');
    this.btnNext = document.getElementById('btn-calendar-next');
    this.dayMemoriesContainer = document.getElementById('day-memories-container');
    this.dayMemoriesTitle = document.getElementById('day-memories-title');
    this.dayMemoriesList = document.getElementById('day-memories-list');

    // Gallery Elements
    this.galleryGrid = document.getElementById('gallery-photos-grid');

    // Streak Elements
    this.streakStatsContent = document.getElementById('streak-stats-content');

    // Lightbox Elements
    this.lightboxModal = document.getElementById('modal-lightbox');
    this.lightboxClose = document.getElementById('modal-lightbox-close');
    this.lightboxImg = document.getElementById('lightbox-img');
    this.lightboxTitle = document.getElementById('lightbox-title');
    this.lightboxMetaInfo = document.getElementById('lightbox-meta-info');
    this.lightboxDownload = document.getElementById('btn-lightbox-download');
    this.btnDownloadText = document.getElementById('btn-download-text');

    this.currentDate = new Date();
    this.selectedDateStr = null;
    this.activeTab = 'calendar'; // 'calendar' | 'gallery' | 'streak'

    this.bindEvents();
    this.updateLanguageStrings();
  }

  updateLanguage(lang) {
    this.currentLang = lang;
    this.updateLanguageStrings();
    if (this.modal.classList.contains('active')) {
      this.render();
    }
  }

  updateLanguageStrings() {
    const l = this.currentLang;
    if (this.tabCalendarText) this.tabCalendarText.textContent = t('tabCalendarText', l);
    if (this.tabGalleryText) this.tabGalleryText.textContent = t('tabGalleryText', l);
    if (this.tabStreakText) this.tabStreakText.textContent = t('tabStreakText', l);
    if (this.btnDownloadText) this.btnDownloadText.textContent = t('downloadPhotoBtn', l);
  }

  bindEvents() {
    this.btnClose.addEventListener('click', () => this.close());
    this.btnPrev.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendar();
    });
    this.btnNext.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendar();
    });

    // Tab Switching
    if (this.tabBtnCalendar) {
      this.tabBtnCalendar.addEventListener('click', () => this.switchTab('calendar'));
    }
    if (this.tabBtnGallery) {
      this.tabBtnGallery.addEventListener('click', () => this.switchTab('gallery'));
    }
    if (this.tabBtnStreak) {
      this.tabBtnStreak.addEventListener('click', () => this.switchTab('streak'));
    }

    // Lightbox Close
    if (this.lightboxClose) {
      this.lightboxClose.addEventListener('click', () => this.closeLightbox());
    }
    if (this.lightboxModal) {
      this.lightboxModal.addEventListener('click', (e) => {
        if (e.target === this.lightboxModal) this.closeLightbox();
      });
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update buttons
    [this.tabBtnCalendar, this.tabBtnGallery, this.tabBtnStreak].forEach(b => b?.classList.remove('active'));
    [this.viewTabCalendar, this.viewTabGallery, this.viewTabStreak].forEach(v => {
      if (v) v.style.display = 'none';
    });

    if (tabName === 'calendar') {
      this.tabBtnCalendar?.classList.add('active');
      if (this.viewTabCalendar) this.viewTabCalendar.style.display = 'block';
      this.renderCalendar();
    } else if (tabName === 'gallery') {
      this.tabBtnGallery?.classList.add('active');
      if (this.viewTabGallery) this.viewTabGallery.style.display = 'block';
      this.renderGallery();
    } else if (tabName === 'streak') {
      this.tabBtnStreak?.classList.add('active');
      if (this.viewTabStreak) this.viewTabStreak.style.display = 'block';
      this.renderStreak();
    }
  }

  async open(initialTab = 'calendar') {
    this.currentDate = new Date();
    this.modal.classList.add('active');
    this.switchTab(initialTab);
  }

  close() {
    this.modal.classList.remove('active');
  }

  render() {
    this.switchTab(this.activeTab);
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB 1: CALENDAR VIEW
  // ═══════════════════════════════════════════════════════════════
  async renderCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const localeMap = { pl: 'pl-PL', ru: 'ru-RU', be: 'be-BY', nl: 'nl-NL', en: 'en-US' };
    const locale = localeMap[this.currentLang] || 'en-US';
    const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(this.currentDate).toUpperCase();
    this.monthTitle.textContent = `${monthName} ${year}`;

    const stats = this.streakService.getStreakStats();
    const completedDates = stats.completedDates || [];
    const memoryDates = await photoStorage.getAllMemoryDates();
    const allActiveDates = new Set([...completedDates, ...memoryDates]);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.gridDays.innerHTML = '';

    const startOffset = (firstDay + 6) % 7;
    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      this.gridDays.appendChild(empty);
    }

    const todayStr = this.streakService.getTodayDateString();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isCompleted = allActiveDates.has(dateStr);

      const dayCell = document.createElement('button');
      dayCell.className = `calendar-day ${isToday ? 'today' : ''} ${isCompleted ? 'completed' : ''}`;
      dayCell.innerHTML = `
        <span class="day-num">${day}</span>
        ${isCompleted ? '<span class="day-fire">🔥</span>' : ''}
      `;

      dayCell.addEventListener('click', () => this.showDayMemories(dateStr));
      this.gridDays.appendChild(dayCell);
    }

    this.showDayMemories(this.selectedDateStr || todayStr);
  }

  async showDayMemories(dateStr) {
    this.selectedDateStr = dateStr;
    this.dayMemoriesTitle.textContent = `${t('calendarTitle', this.currentLang)}: ${dateStr}`;
    this.dayMemoriesList.innerHTML = '<div class="loading-text">...</div>';
    this.dayMemoriesContainer.style.display = 'flex';

    const photos = await photoStorage.getPhotosByDate(dateStr);

    if (!photos || photos.length === 0) {
      this.dayMemoriesList.innerHTML = `
        <div class="no-memories-msg">
          <span>📷</span>
          <p>${t('noMemoriesDay', this.currentLang)}</p>
        </div>
      `;
      return;
    }

    this.dayMemoriesList.innerHTML = '';

    photos.forEach((photo) => {
      const card = document.createElement('div');
      card.className = 'memory-photo-card';
      const timeFormatted = new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      card.innerHTML = `
        <div class="memory-photo-frame">
          <img src="${photo.image}" alt="Spot #${photo.step}" class="memory-img" />
          <div class="memory-badge-top">${t('spotLabel', this.currentLang)} #${photo.step}</div>
        </div>
        <div class="memory-caption">
          <div class="memory-meta">
            <span class="memory-time">⏰ ${timeFormatted}</span>
            <span class="memory-coords">📍 ${photo.lat ? photo.lat.toFixed(4) : ''}, ${photo.lng ? photo.lng.toFixed(4) : ''}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => this.openLightbox(photo));
      this.dayMemoriesList.appendChild(card);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB 2: PHOTO GALLERY (ALL USER PHOTOS)
  // ═══════════════════════════════════════════════════════════════
  async renderGallery() {
    if (!this.galleryGrid) return;
    this.galleryGrid.innerHTML = '<div class="loading-text">...</div>';

    const allPhotos = await photoStorage.getAllPhotos();

    if (!allPhotos || allPhotos.length === 0) {
      this.galleryGrid.innerHTML = `
        <div class="no-memories-msg" style="grid-column: 1 / -1;">
          <span style="font-size: 2.5rem;">🖼️</span>
          <p style="margin-top: 8px;">${t('galleryEmpty', this.currentLang)}</p>
        </div>
      `;
      return;
    }

    this.galleryGrid.innerHTML = '';

    allPhotos.forEach((photo) => {
      const item = document.createElement('div');
      item.className = 'gallery-photo-item';
      item.innerHTML = `
        <img src="${photo.image}" alt="Spot #${photo.step} on ${photo.date}" loading="lazy" />
        <div class="gallery-photo-badge">#${photo.step}</div>
        <div class="gallery-photo-date">${photo.date}</div>
      `;
      item.addEventListener('click', () => this.openLightbox(photo));
      this.galleryGrid.appendChild(item);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TAB 3: STREAK STATISTICS
  // ═══════════════════════════════════════════════════════════════
  renderStreak() {
    if (!this.streakStatsContent) return;

    const stats = this.streakService.getStreakStats();
    const currentStreak = stats.currentStreak || 0;
    const totalDays = stats.totalCompletedDays || (stats.completedDates ? stats.completedDates.length : 0);

    const dailyState = this.streakService.getDailyState();
    let todayStatusText = t('statusNotStarted', this.currentLang);
    let todayStatusColor = 'var(--text-muted)';

    if (dailyState && dailyState.spots) {
      const completedCount = dailyState.spots.filter(s => s.checkedIn).length;
      if (completedCount === 3) {
        todayStatusText = t('statusCompleted', this.currentLang);
        todayStatusColor = 'var(--pixel-green)';
      } else if (completedCount > 0) {
        todayStatusText = `${t('statusInProgress', this.currentLang)} (${completedCount}/3)`;
        todayStatusColor = 'var(--pixel-yellow)';
      }
    }

    this.streakStatsContent.innerHTML = `
      <div class="streak-card-hero">
        <div class="streak-hero-fire">🔥</div>
        <div class="streak-hero-count">${currentStreak} ${t('streakLabel', this.currentLang)}</div>
        <div class="streak-hero-label">${t('currentStreakLabel', this.currentLang)}</div>
      </div>

      <div class="streak-stats-grid">
        <div class="streak-stat-box">
          <div class="streak-stat-val">${totalDays}</div>
          <div class="streak-stat-desc">${t('totalCompletedWalks', this.currentLang)}</div>
        </div>
        <div class="streak-stat-box">
          <div class="streak-stat-val" style="color: ${todayStatusColor}; font-size: 0.95rem;">${todayStatusText}</div>
          <div class="streak-stat-desc">${t('todayWalkStatus', this.currentLang)}</div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIGHTBOX PHOTO VIEWER
  // ═══════════════════════════════════════════════════════════════
  openLightbox(photo) {
    if (!this.lightboxModal) return;

    this.lightboxImg.src = photo.image;
    this.lightboxTitle.textContent = `📸 ${t('spotLabel', this.currentLang)} #${photo.step} — ${photo.date}`;

    const timeFormatted = new Date(photo.timestamp || photo.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.lightboxMetaInfo.innerHTML = `
      <div>📅 <strong>${photo.date} • ${timeFormatted}</strong></div>
      <div>📍 ${photo.lat ? photo.lat.toFixed(5) : ''}, ${photo.lng ? photo.lng.toFixed(5) : ''} (${photo.cityName || '1.5 km Loop'})</div>
    `;

    this.lightboxDownload.href = photo.image;
    this.lightboxDownload.download = `dokad_${photo.date}_spot_${photo.step}.jpg`;

    this.lightboxModal.classList.add('active');
  }

  closeLightbox() {
    if (this.lightboxModal) {
      this.lightboxModal.classList.remove('active');
    }
  }
}
