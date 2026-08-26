import { photoStorage } from '../geo/photoStorage.js';

export class CalendarModal {
  constructor(streakService) {
    this.streakService = streakService;

    this.modal = document.getElementById('modal-calendar');
    this.btnClose = document.getElementById('modal-calendar-close');
    this.gridDays = document.getElementById('calendar-grid-days');
    this.monthTitle = document.getElementById('calendar-month-title');
    this.btnPrev = document.getElementById('btn-calendar-prev');
    this.btnNext = document.getElementById('btn-calendar-next');
    this.dayMemoriesContainer = document.getElementById('day-memories-container');
    this.dayMemoriesTitle = document.getElementById('day-memories-title');
    this.dayMemoriesList = document.getElementById('day-memories-list');

    this.currentDate = new Date();
    this.selectedDateStr = null;

    this.bindEvents();
  }

  bindEvents() {
    this.btnClose.addEventListener('click', () => this.close());
    this.btnPrev.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });
    this.btnNext.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });
  }

  async open() {
    this.currentDate = new Date();
    this.modal.classList.add('active');
    await this.render();
  }

  close() {
    this.modal.classList.remove('active');
  }

  async render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthNames = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    this.monthTitle.textContent = `${monthNames[month]} ${year}`;

    const stats = this.streakService.getStreakStats();
    const completedDates = stats.completedDates || [];
    const memoryDates = await photoStorage.getAllMemoryDates();
    const allActiveDates = new Set([...completedDates, ...memoryDates]);

    // Calendar matrix
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.gridDays.innerHTML = '';

    // Day of week offset (starting Monday)
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

    // Default select today
    this.showDayMemories(todayStr);
  }

  async showDayMemories(dateStr) {
    this.selectedDateStr = dateStr;
    this.dayMemoriesTitle.textContent = `📅 MEMORIES: ${dateStr}`;
    this.dayMemoriesList.innerHTML = '<div class="loading-text">LOADING PHOTOS...</div>';
    this.dayMemoriesContainer.style.display = 'flex';

    const photos = await photoStorage.getPhotosByDate(dateStr);

    if (!photos || photos.length === 0) {
      this.dayMemoriesList.innerHTML = `
        <div class="no-memories-msg">
          <span>📷</span>
          <p>No verified photos taken on this date.</p>
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
          <div class="memory-badge-top">SPOT #${photo.step}</div>
        </div>
        <div class="memory-caption">
          <div class="memory-meta">
            <span class="memory-time">⏰ ${timeFormatted}</span>
            <span class="memory-coords">📍 ${photo.lat ? photo.lat.toFixed(4) : ''}, ${photo.lng ? photo.lng.toFixed(4) : ''}</span>
          </div>
        </div>
      `;
      this.dayMemoriesList.appendChild(card);
    });
  }
}
