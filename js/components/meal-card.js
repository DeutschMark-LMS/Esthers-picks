/**
 * Esther's Picks - Component: MealCard
 * Renders individual meal combination cards with item breakdowns, pricing, and action triggers.
 * High-contrast color hierarchy for instant readability in bright campus conditions.
 */
window.MealCard = (function () {
  function formatNaira(amount) {
    return '₦' + Number(amount || 0).toLocaleString('en-NG');
  }

  function copyToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      if (typeof textarea.select === 'function') {
        textarea.select();
      }
      if (typeof document.execCommand === 'function') {
        document.execCommand('copy');
      }
      document.body.removeChild(textarea);
    } catch (err) {
      console.warn('Fallback copy failed', err);
    }
  }

  // Category Color Theming (Semantic Badges)
  const categoryStyles = {
    heavy: {
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      tagIcon: '🍛'
    },
    fast: {
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
      tagIcon: '🥪'
    },
    night: {
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      tagIcon: '🌙'
    },
    budget: {
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      tagIcon: '💸'
    }
  };

  function create(combo, currentBudget, onSpotClick, onCopySuccess) {
    const changeRemaining = currentBudget && currentBudget >= combo.price
      ? currentBudget - combo.price
      : null;

    const theme = categoryStyles[combo.category] || {
      badgeClass: 'bg-orange-50 text-orange-800 border-orange-200/80',
      tagIcon: '⭐'
    };

    const card = document.createElement('div');
    card.className = "bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group";

    const hasDetailedItems = combo.items && combo.items.length > 0 && !(combo.items.length === 1 && combo.items[0].name === combo.title);

    const itemsListHtml = hasDetailedItems ? (combo.items || []).map(it => `
      <li class="flex items-center justify-between text-xs py-1.5 border-b border-stone-100 last:border-0">
        <span class="text-stone-800 font-medium flex items-center gap-1.5 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full ${combo.isCampusHack ? 'bg-purple-600' : 'bg-brand-500'} shrink-0"></span>
          <span class="truncate">${it.name}</span>
          ${it.spotName ? `<span class="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md shrink-0">📍 ${it.spotName}</span>` : ''}
        </span>
        <span class="font-extrabold text-stone-600 text-xs shrink-0 ml-2 font-display">
          ${it.pricingType === 'from_price' ? '<span class="text-[9px] uppercase font-black text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded mr-1">from</span>' : ''}${formatNaira(it.price)}
        </span>
      </li>
    `).join('') : `
      <li class="flex items-center justify-between text-xs py-1">
        <span class="text-stone-800 font-medium flex items-center gap-2 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full ${combo.isCampusHack ? 'bg-purple-600' : 'bg-brand-500'} shrink-0"></span>
          <span class="truncate">Full portion serving prepared fresh</span>
        </span>
        <span class="font-extrabold text-stone-600 text-xs shrink-0 ml-2 font-display">${formatNaira(combo.price)}</span>
      </li>
    `;

    // Normalize vendor list
    const vendors = (combo.vendors && combo.vendors.length > 0)
      ? combo.vendors
      : [{
          spotId: combo.spotId,
          spotName: combo.spotName || 'Campus Spot',
          spotTag: combo.spotTag || 'Campus Spot',
          price: combo.price
        }];
    const isMultiVendor = vendors.length > 1;

    // Distinct route stops for Campus Hacks
    const effectiveStops = (combo.stops && combo.stops.length > 0)
      ? combo.stops
      : (function () {
          const derived = [];
          const seen = new Set();
          (combo.items || []).forEach(it => {
            if (it.spotId && !seen.has(it.spotId)) {
              seen.add(it.spotId);
              derived.push({ spotId: it.spotId, spotName: it.spotName || 'Campus Spot' });
            }
          });
          return derived.length > 0 ? derived : vendors;
        })();

    const campusHackStopsHtml = effectiveStops.map((st, idx) => `
      ${idx > 0 ? `<span class="text-stone-300 font-black text-xs select-none">➔</span>` : ''}
      <button 
        type="button" 
        class="view-spot-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs transition active:scale-95" 
        data-spot-id="${st.spotId}" 
        title="View Stop ${idx + 1}: ${st.spotName}"
      >
        <span class="text-purple-600 font-black text-[10px]">#${idx + 1}</span>
        <span class="truncate max-w-[120px] sm:max-w-[150px]">${st.spotName}</span>
      </button>
    `).join('');

    // Render individual vendor tags at the vendor corner (for standard combos)
    const vendorTagsHtml = vendors.map(v => {
      const showPricePill = combo.hasPriceVariation && v.price && v.price !== combo.price;
      return `
        <button 
          type="button" 
          class="view-spot-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-800 font-bold text-xs border border-stone-200/80 transition" 
          data-spot-id="${v.spotId}" 
          title="View ${v.spotName} location on campus"
        >
          <span class="text-brand-600 text-xs">📍</span>
          <span class="truncate max-w-[130px] sm:max-w-[180px]">${v.spotName}</span>
          ${showPricePill ? `<span class="text-[10px] text-stone-500 font-extrabold bg-white px-1.5 py-0.5 rounded-md border border-stone-200">(${formatNaira(v.price)})</span>` : ''}
        </button>
      `;
    }).join('');

    card.innerHTML = `
      <!-- Header info: Badge, Title & Main Price -->
      <div class="flex items-start justify-between gap-3 mb-2.5">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
            ${combo.isCampusHack ? `
              <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300">
                <span>🎒</span>
                <span>${combo.vibeBadge || 'Campus Hack 🎒'}</span>
              </span>
              <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-900 text-white shadow-xs">
                <span>🔀</span>
                <span>${effectiveStops.length} Spots Route</span>
              </span>
            ` : `
              <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${theme.badgeClass}">
                <span>${theme.tagIcon}</span>
                <span>${combo.vibeBadge || 'Esther Approved ⭐'}</span>
              </span>
              ${isMultiVendor ? `
                <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-900 text-white shadow-xs">
                  <span>🏪</span>
                  <span>${vendors.length} Vendors</span>
                </span>
              ` : ''}
            `}
          </div>
          <h2 class="text-base sm:text-lg font-extrabold text-stone-900 leading-snug group-hover:text-brand-600 transition-colors">
            ${combo.title}
          </h2>
        </div>
        <div class="text-right shrink-0">
          ${combo.hasFromPrice ? '<span class="text-[9px] text-amber-700 font-extrabold uppercase tracking-wider block leading-tight">starts from</span>' : ''}
          <span class="text-xl sm:text-2xl font-black font-display text-brand-600 tracking-tight block">${formatNaira(combo.price)}</span>
          <span class="text-[10px] text-stone-400 font-extrabold uppercase tracking-wider block">${combo.hasFromPrice ? 'base meal' : 'total'}</span>
        </div>
      </div>

      <!-- Items Breakdown (Clean, readable contrast) -->
      <div class="bg-stone-50 rounded-2xl p-3 my-3 border border-stone-200/70">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-black text-stone-500 uppercase tracking-wider">${combo.isCampusHack ? 'Items & Canteens:' : 'Items in this meal:'}</span>
          <span class="text-[10px] text-stone-400 font-bold">${hasDetailedItems ? (combo.items.length + ' items') : 'Full plate'}</span>
        </div>
        <ul class="space-y-0.5">
          ${itemsListHtml}
        </ul>
      </div>

      <!-- Esther's Review Note (Warm, high-contrast) -->
      <div class="flex items-start gap-2.5 text-xs ${combo.isCampusHack ? 'bg-purple-50/70 border-purple-200/80' : 'bg-amber-50/80 border-amber-200/80'} p-3 rounded-2xl border mb-3 text-stone-800">
        <span class="text-base select-none shrink-0 pt-0.5">${combo.isCampusHack ? '🎒' : '💬'}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-black ${combo.isCampusHack ? 'text-purple-900' : 'text-amber-900'} uppercase tracking-wider">Esther's Verdict</span>
            <span class="text-[11px] font-black ${combo.isCampusHack ? 'text-purple-900 bg-purple-200/80 border-purple-300/60' : 'text-amber-900 bg-amber-200/80 border-amber-300/60'} px-2 py-0.5 rounded-md border">★ ${combo.rating || '9.8'}</span>
          </div>
          <p class="text-xs text-stone-700 italic leading-relaxed">"${combo.esthersVerdict || combo.rukkysVerdict || 'A very satisfying campus meal.'}"</p>
        </div>
      </div>

      <!-- Where to get & Actions Footer -->
      <div class="pt-2.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          ${combo.isCampusHack ? `
            <span class="text-[10px] font-black text-purple-800 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <span>🎒</span>
              <span>Route:</span>
            </span>
            ${campusHackStopsHtml}
          ` : `
            <span class="text-[10px] font-black text-stone-400 uppercase tracking-wider shrink-0 mr-0.5 flex items-center gap-1">
              <span>📍</span>
              <span>${isMultiVendor ? 'Available at:' : 'Get at:'}</span>
            </span>
            ${vendorTagsHtml}
          `}
        </div>

        <div class="flex items-center gap-1.5 shrink-0 ml-auto">
          ${changeRemaining !== null ? `
            <span class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl">
              <span>💰 Left:</span>
              <span>${formatNaira(changeRemaining)}</span>
            </span>
          ` : ''}
          
          <button 
            type="button"
            class="copy-combo-btn p-2 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 transition" 
            title="Copy Meal Details to Share"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Bind Spot Click on every vendor tag / stop
    card.querySelectorAll('.view-spot-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sId = btn.getAttribute('data-spot-id') || combo.spotId;
        if (typeof onSpotClick === 'function') {
          onSpotClick(sId);
        }
      });
    });

    // Bind Copy Button
    const copyBtn = card.querySelector('.copy-combo-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pricePrefix = combo.hasFromPrice ? 'Starts from ' : '';
        let shareText = '';
        if (combo.isCampusHack) {
          const stopsText = effectiveStops.map((st, idx) => `  • Stop ${idx + 1}: ${st.spotName}`).join('\n');
          shareText = `🎒 Esther's Campus Hack at Wellspring:\n${combo.title}\nPrice: ${pricePrefix}${formatNaira(combo.price)}\nRoute:\n${stopsText}\n"${combo.esthersVerdict || combo.rukkysVerdict || ''}"`;
        } else {
          const vendorNames = vendors.map(v => v.spotName).join(', ');
          shareText = `🍽️ Esther's Pick at Wellspring:\n${combo.title}\nPrice: ${pricePrefix}${formatNaira(combo.price)}\nAvailable at: ${vendorNames}`;
        }
        copyToClipboard(shareText);
        if (typeof onCopySuccess === 'function') {
          onCopySuccess();
        }
      });
    }

    return card;
  }

  return {
    formatNaira,
    copyToClipboard,
    create
  };
})();
