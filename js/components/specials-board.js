/**
 * Rukky's Picks - Component: SpecialsBoard
 * Manages the "Today's Campus Deals" banner, calendar day filtering, carousel rotation, and quick budget locking.
 * Enforces strict campus timezone (WAT / Africa/Lagos) so that meals from other days do not leak into today's view.
 */
window.SpecialsBoard = (function () {
  let allRawSpecials = [];
  let specials = [];
  let currentIndex = 0;
  let onLockBudgetCallback = null;
  let currentDayFilter = 'today'; // 'today' | 'monday' | ... | 'all'

  const DAY_LABELS = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    everyday: 'Everyday'
  };

  const SHORT_DAY_LABELS = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun'
  };

  const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  function getTodayDayKey() {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: 'Africa/Lagos'
      });
      return formatter.format(new Date()).toLowerCase();
    } catch (e) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      return days[new Date().getDay()] || 'wednesday';
    }
  }

  function formatDayLabel(dayKey) {
    if (!dayKey) return "Today's Special";
    const key = String(dayKey).toLowerCase();
    if (key === 'everyday') return '🌟 Everyday Special';
    return `📅 ${DAY_LABELS[key] || dayKey} Special`;
  }

  function formatNaira(amount) {
    return '₦' + Number(amount || 0).toLocaleString('en-NG');
  }

  function filterSpecials() {
    const todayKey = getTodayDayKey();
    if (currentDayFilter === 'today') {
      // ONLY specials explicitly tied to today, or everyday, or untagged
      return allRawSpecials.filter(s => {
        if (!s || s.active === false) return false;
        const d = (s.dayOfWeek || '').toLowerCase();
        return d === 'everyday' || d === todayKey || d === '';
      });
    } else if (currentDayFilter === 'all') {
      return allRawSpecials.filter(s => s && s.active !== false);
    } else {
      // Specific day
      return allRawSpecials.filter(s => {
        if (!s || s.active === false) return false;
        const d = (s.dayOfWeek || '').toLowerCase();
        return d === currentDayFilter || d === 'everyday';
      });
    }
  }

  function renderDayFilterBar() {
    const bar = document.getElementById('specialsDayFilterBar');
    if (!bar) return;

    const todayKey = getTodayDayKey();
    const todayShort = SHORT_DAY_LABELS[todayKey] || 'Today';

    const chips = [
      { id: 'today', label: `🔥 Today (${todayShort})` },
      ...DAYS_ORDER.map(d => ({ id: d, label: SHORT_DAY_LABELS[d] + (d === todayKey ? ' •' : '') })),
      { id: 'all', label: 'All Week' }
    ];

    bar.innerHTML = chips.map(c => {
      const isActive = currentDayFilter === c.id;
      return `
        <button 
          type="button"
          class="specials-day-chip px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap transition active:scale-95 tap-highlight-transparent ${
            isActive 
              ? 'bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20 ring-1 ring-amber-300' 
              : 'bg-white/10 hover:bg-white/20 text-stone-300'
          }"
          data-day="${c.id}"
        >
          ${c.label}
        </button>
      `;
    }).join('');

    bar.querySelectorAll('.specials-day-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        currentDayFilter = btn.getAttribute('data-day') || 'today';
        currentIndex = 0;
        specials = filterSpecials();
        render();
        renderDayFilterBar();
      });
    });
  }

  function render() {
    const container = document.getElementById('specialCardContent');
    const dotsContainer = document.getElementById('specialsDotsContainer');
    const nextBtn = document.getElementById('nextSpecialBtn');
    const dateBadge = document.getElementById('specialsDateBadge');
    const boardHeading = document.getElementById('specialsBoardHeading');

    if (!container) return;

    const todayKey = getTodayDayKey();
    const todayLabel = DAY_LABELS[todayKey] || 'Today';

    // Update Section Badge based on filter
    if (dateBadge) {
      if (currentDayFilter === 'today') {
        dateBadge.textContent = `${todayLabel} (Today)`;
      } else if (currentDayFilter === 'all') {
        dateBadge.textContent = 'All Week Specials';
      } else {
        const selLabel = DAY_LABELS[currentDayFilter] || currentDayFilter;
        dateBadge.textContent = `${selLabel} Deals`;
      }
    }

    if (boardHeading) {
      if (currentDayFilter === 'today') {
        boardHeading.textContent = `${todayLabel}'s Special Food Deals`;
      } else if (currentDayFilter === 'all') {
        boardHeading.textContent = 'All Weekly Special Deals';
      } else {
        const selLabel = DAY_LABELS[currentDayFilter] || currentDayFilter;
        boardHeading.textContent = `${selLabel}'s Special Food Deals`;
      }
    }

    if (!specials || specials.length === 0) {
      let emptyMsg = '';
      if (currentDayFilter === 'today') {
        emptyMsg = `No special menu posted for ${todayLabel} yet. Canteens drop specials by lunch time! Tap a day above to preview upcoming deals.`;
      } else if (currentDayFilter === 'all') {
        emptyMsg = 'No daily deals currently active across campus.';
      } else {
        const dayName = DAY_LABELS[currentDayFilter] || currentDayFilter;
        emptyMsg = `No specials posted for ${dayName} yet.`;
      }

      container.innerHTML = `
        <div class="py-6 px-3 text-center">
          <div class="w-12 h-12 mx-auto mb-2 bg-amber-400/10 text-amber-300 rounded-2xl flex items-center justify-center text-2xl border border-amber-400/20">
            📅
          </div>
          <h4 class="font-bold text-white text-sm">No ${currentDayFilter === 'today' ? todayLabel : (DAY_LABELS[currentDayFilter] || '')} Special Deals Found</h4>
          <p class="text-xs text-stone-300 mt-1 max-w-xs mx-auto leading-relaxed">${emptyMsg}</p>
        </div>
      `;
      if (dotsContainer) dotsContainer.innerHTML = '';
      if (nextBtn) nextBtn.classList.add('hidden');
      return;
    }

    if (currentIndex >= specials.length) currentIndex = 0;
    const item = specials[currentIndex];

    const isForToday = !item.dayOfWeek || item.dayOfWeek === 'everyday' || item.dayOfWeek === todayKey;
    const isFrom = item.pricingType === 'from_price';

    if (dateBadge) {
      const dayText = item.dayOfWeek ? (DAY_LABELS[item.dayOfWeek] || item.dayOfWeek) : todayLabel;
      dateBadge.textContent = `${dayText} • Deal ${currentIndex + 1} of ${specials.length}`;
    }

    container.innerHTML = `
      <!-- Top Meta: Vendor Spot & Deal Badge -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/25 text-xs font-bold">
          <span>🏪</span>
          <span>${item.vendor || 'Campus Canteen'}</span>
        </span>
        <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
          <span class="text-[11px] font-extrabold text-orange-200 bg-white/10 px-2.5 py-1 rounded-xl border border-white/10">
            ${formatDayLabel(item.dayOfWeek)}
          </span>
          ${isForToday ? '<span class="text-[10px] font-black uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">TODAY 🔥</span>' : ''}
        </div>
      </div>

      <!-- Main Meal Title & Big Price -->
      <div class="space-y-1 my-2.5">
        <h4 class="text-base sm:text-lg font-extrabold text-white leading-snug tracking-tight">
          ${item.title}
        </h4>
        <div class="flex items-baseline gap-2 pt-1.5">
          ${isFrom ? '<span class="text-xs font-black uppercase tracking-wider text-amber-300">starts from</span>' : ''}
          <span class="text-2xl sm:text-3xl font-black font-display text-amber-400 tracking-tight">
            ${formatNaira(item.price)}
          </span>
          <span class="text-[11px] text-stone-400 font-medium">${isFrom ? 'base deal rate' : 'special deal rate'}</span>
        </div>
      </div>

      <!-- Pitch / Note if present -->
      ${item.rukkysPitch ? `
        <div class="mt-3 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-stone-200 italic leading-relaxed flex items-start gap-2">
          <span class="text-amber-400 text-sm select-none shrink-0">💬</span>
          <span>"${item.rukkysPitch}"</span>
        </div>
      ` : ''}

      <!-- Big Primary Action Button: Lock Budget to this deal -->
      <button 
        id="lockSpecialBudgetBtn" 
        class="w-full mt-4 py-3.5 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-98 text-stone-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2 tap-highlight-transparent cursor-pointer"
      >
        <span>Set budget to this deal (${isFrom ? 'from ' : ''}${formatNaira(item.price)})</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
      </button>
    `;

    // Render Dots if multiple specials exist in this view
    if (dotsContainer) {
      if (specials.length > 1) {
        dotsContainer.innerHTML = specials.map((_, idx) => `
          <button 
            type="button"
            class="h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-amber-400 w-6' : 'bg-white/30 hover:bg-white/50 w-2'}"
            onclick="window.SpecialsBoard.selectIndex(${idx})"
            title="View deal ${idx + 1}"
          ></button>
        `).join('');
      } else {
        dotsContainer.innerHTML = '';
      }
    }

    // Toggle Next button visibility
    if (nextBtn) {
      if (specials.length > 1) {
        nextBtn.classList.remove('hidden');
      } else {
        nextBtn.classList.add('hidden');
      }
    }

    // Bind Budget Lock Button
    const lockBtn = document.getElementById('lockSpecialBudgetBtn');
    if (lockBtn && typeof onLockBudgetCallback === 'function') {
      lockBtn.addEventListener('click', () => {
        onLockBudgetCallback(item);
      });
    }
  }

  function next() {
    if (!specials.length) return;
    currentIndex = (currentIndex + 1) % specials.length;
    render();
  }

  function selectIndex(index) {
    if (index >= 0 && index < specials.length) {
      currentIndex = index;
      render();
    }
  }

  function init(initialSpecials, onLockBudget) {
    allRawSpecials = (initialSpecials || []).filter(s => s && s.active !== false);
    onLockBudgetCallback = onLockBudget;
    currentDayFilter = 'today';
    currentIndex = 0;
    specials = filterSpecials();

    const nextBtn = document.getElementById('nextSpecialBtn');
    if (nextBtn) {
      nextBtn.onclick = () => next();
    }

    renderDayFilterBar();
    render();
  }

  function updateSpecials(newSpecials) {
    allRawSpecials = (newSpecials || []).filter(s => s && s.active !== false);
    specials = filterSpecials();
    if (currentIndex >= specials.length) currentIndex = 0;
    renderDayFilterBar();
    render();
  }

  return {
    init,
    render,
    next,
    selectIndex,
    updateSpecials,
    getTodayDayKey
  };
})();
