/**
 * Rukky's Picks - Student Client App Controller (app.js)
 * High performance, zero framework overhead, reactive client for Wellspring University students.
 * Powered by Rukky's Engine: dynamically mixes individual canteen food items into balanced meals.
 */
(function () {
  'use strict';

  // State
  let allItems = (window.dbService && window.dbService.getItemsSync) ? window.dbService.getItemsSync() : (window.DEFAULT_ITEMS || []);
  let allSpots = (window.dbService && window.dbService.getSpotsSync) ? window.dbService.getSpotsSync() : (window.DEFAULT_SPOTS || []);
  let allSpecials = (window.dbService && window.dbService.getSpecialsSync) ? window.dbService.getSpecialsSync() : (window.DEFAULT_SPECIALS || []);
  let curatedCombos = (window.dbService && window.dbService.getCombosSync) ? window.dbService.getCombosSync() : (window.DEFAULT_COMBOS || []);
  let allCombos = [];

  let currentBudget = null;
  let currentFilter = 'all';
  let currentSort = 'best';
  let deferredInstallPrompt = null;

  // DOM Elements
  const budgetInput = document.getElementById('budgetInput');
  const findCombosBtn = document.getElementById('findCombosBtn');
  const combosList = document.getElementById('combosList');
  const noResultsState = document.getElementById('noResultsState');
  const resultsCount = document.getElementById('resultsCount');
  const sortSelect = document.getElementById('sortSelect');
  const surpriseBtn = document.getElementById('surpriseBtn');
  const resetMinBtn = document.getElementById('resetMinBtn');

  // --- REFRESH COMBOS VIA RUKKY'S ENGINE & CURATED CAMPUS HACKS ---
  function refreshEngineCombos() {
    const generated = window.RukkysEngine
      ? window.RukkysEngine.generateCombos(allItems, allSpots)
      : (window.DEFAULT_COMBOS || []);

    // Merge manual curated Campus Hacks with generated combos
    allCombos = [...curatedCombos, ...generated];
    renderCombos();
  }

  // --- RENDER COMBOS ---
  function renderCombos() {
    if (!combosList) return;

    let filtered = [...allCombos];

    // 1. Budget Filter
    if (currentBudget !== null && !isNaN(currentBudget) && currentBudget > 0) {
      filtered = filtered.filter(item => item.price <= currentBudget);
    }

    // 2. Category Filter
    if (currentFilter !== 'all') {
      filtered = filtered.filter(item => item.category === currentFilter);
    }

    // 3. Sorting
    if (currentSort === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      // Top recommended (rating)
      filtered.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    }

    combosList.innerHTML = '';

    if (filtered.length === 0) {
      combosList.classList.add('hidden');
      if (noResultsState) {
        noResultsState.classList.remove('hidden');
        const emptyIcon = document.getElementById('emptyStateIcon');
        const emptyTitle = document.getElementById('emptyStateTitle');
        const emptyDesc = document.getElementById('emptyStateDesc');
        const resetBtn = document.getElementById('resetMinBtn');

        if (allCombos.length === 0) {
          if (emptyIcon) emptyIcon.innerText = '🍲';
          if (emptyTitle) emptyTitle.innerText = 'Campus Canteens Are Updating Menus';
          if (emptyDesc) emptyDesc.innerText = 'No meals listed right now. Canteen managers are loading authentic dishes into the portal. Check back shortly!';
          if (resetBtn) resetBtn.classList.add('hidden');
        } else {
          if (emptyIcon) emptyIcon.innerText = '🥺';
          if (emptyTitle) emptyTitle.innerText = 'No food combination found for this budget';
          if (emptyDesc) emptyDesc.innerText = 'Try increasing your budget a little, or tap below to explore our popular affordable meals.';
          if (resetBtn) resetBtn.classList.remove('hidden');
        }
      }
      if (resultsCount) resultsCount.innerText = allCombos.length === 0 ? 'No active menus' : 'No matches found';
      return;
    }

    combosList.classList.remove('hidden');
    if (noResultsState) noResultsState.classList.add('hidden');
    if (resultsCount) {
      resultsCount.innerText = `Showing ${filtered.length} food combination${filtered.length > 1 ? 's' : ''}`;
    }

    filtered.forEach(combo => {
      const card = window.MealCard.create(
        combo,
        currentBudget,
        (spotId) => window.AppModals.openSpots(spotId),
        () => window.AppModals.showToast('Copied meal details to clipboard! Share with your friends', '📋')
      );
      combosList.appendChild(card);
    });
  }

  // --- BUDGET SEARCH ---
  function triggerBudgetSearch() {
    const val = parseFloat(budgetInput.value);
    if (!isNaN(val) && val > 0) {
      currentBudget = val;
      if (window.RukkysAnalytics) {
        window.RukkysAnalytics.trackBudgetSearch(val);
      }
      window.AppModals.showToast(`Showing meals under ${window.MealCard.formatNaira(val)}`, '🎯');
    } else {
      currentBudget = null;
    }
    renderCombos();
  }

  // --- HANDLE SUGGESTION SUBMISSION ---
  async function handleSubmitSuggestion(data) {
    // 1. Persist to DB for Admin / Vendor Queue
    if (window.dbService) {
      try {
        await window.dbService.addSuggestion(data);
      } catch (err) {
        console.warn("Could not save to remote suggestion queue:", err);
      }
    }

    // 2. Add temporarily into student's local list as review pick
    const tempCombo = {
      id: "user-" + Date.now(),
      title: data.suggestedItems,
      category: "budget",
      price: data.suggestedPrice,
      spotId: "user-spot",
      spotName: data.suggestedSpot,
      items: [{ name: data.suggestedItems, price: data.suggestedPrice }],
      rukkysVerdict: `Suggested by ${data.suggesterName} from campus! Under review by Rukky.`,
      rating: "New",
      vibeBadge: "Student Suggestion ⭐"
    };

    allCombos.unshift(tempCombo);
    renderCombos();
    window.AppModals.showToast(`Thank you ${data.suggesterName}! Your food suggestion has been sent for review!`, '🙌');
  }

  // --- PWA INSTALLATION CONTROLLER ---
  function updateInstallUI(status) {
    const installSection = document.getElementById('installAppSection');
    const navInstall = document.getElementById('navInstall');

    if (status === 'installed') {
      // Once installed (or running as standalone app), completely hide both the feed banner and nav button
      if (installSection) installSection.classList.add('hidden');
      if (navInstall) navInstall.classList.add('hidden');
      try {
        localStorage.setItem('rukkys_pwa_installed', 'true');
      } catch (e) {}
    } else if (status === 'ready') {
      if (installSection) installSection.classList.remove('hidden');
      if (navInstall) navInstall.classList.remove('hidden');
    }
  }

  async function triggerPWAInstall() {
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) 
      || window.navigator.standalone === true 
      || (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://'));

    if (isStandalone) {
      updateInstallUI('installed');
      if (window.AppModals) {
        window.AppModals.showToast("You're already using the installed app! 🎉", '✅');
      }
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          updateInstallUI('installed');
          if (window.RukkysAnalytics) {
            window.RukkysAnalytics.trackEvent('pwa_install_accepted', { label: 'User installed PWA' });
          }
          if (window.AppModals) {
            window.AppModals.showToast("Rukky's Picks installed! Check your home screen 🎉", '📲');
          }
          // Only prompt for device notifications when the person installs the app
          checkAndPromptInstalledNotifications();
        }
      } catch (err) {
        console.warn('Error during install prompt:', err);
      }
      deferredInstallPrompt = null;
    } else {
      // iOS Safari or browser where prompt is not programmatically triggerable
      if (window.AppModals && window.AppModals.openInstallGuide) {
        window.AppModals.openInstallGuide();
      } else {
        alert("To install Rukky's Picks, tap your browser's share or menu icon and select 'Add to Home Screen' 📲");
      }
    }
  }

  // --- NOTIFICATION CONTROLLER (Strictly for Installed App Users) ---
  function checkAndPromptInstalledNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
    try {
      if (localStorage.getItem('rukkys_push_prompted') === 'dismissed') return;
    } catch (e) {}

    setTimeout(() => {
      if (window.AppModals && window.AppModals.openNotificationPrompt) {
        window.AppModals.openNotificationPrompt();
      }
    }, 1800);
  }

  async function handleEnableNotifications() {
    if (!('Notification' in window)) {
      if (window.AppModals) window.AppModals.showToast("Notifications not supported on this device", "⚠️");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        try {
          localStorage.setItem('rukkys_push_prompted', 'granted');
          localStorage.setItem('rukkys_notifications_enabled', 'true');
        } catch (e) {}

        if (window.AppModals) {
          window.AppModals.closeAll();
          window.AppModals.showToast("Lunch alerts active! You'll be alerted at 12:15 PM 🍲", "🔔");
        }

        // Trigger welcome test notification through service worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification("Rukky's Picks 🍲", {
              body: "Campus lunch alerts are active! We will notify you at 12:15 PM with today's hot meal deals.",
              icon: "icons/icon-192.png",
              badge: "icons/icon-192.png",
              tag: "welcome-alert",
              vibrate: [100, 50, 100],
              data: { url: "./index.html" }
            });
          }).catch(err => console.warn('Could not show welcome notification:', err));
        }

        // Save subscriber record to Firestore
        if (window.dbService && window.dbService.savePushSubscriber) {
          try {
            await window.dbService.savePushSubscriber({
              id: 'sub-' + Date.now(),
              grantedAt: new Date().toISOString(),
              userAgent: navigator.userAgent
            });
          } catch (e) {}
        }
      } else {
        if (window.AppModals) {
          window.AppModals.closeAll();
          window.AppModals.showToast("Alerts disabled. You can re-enable them in browser settings.", "ℹ️");
        }
      }
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      if (window.AppModals) window.AppModals.closeAll();
    }
  }

  function handleDismissNotifications() {
    try {
      localStorage.setItem('rukkys_push_prompted', 'dismissed');
    } catch (e) {}
    if (window.AppModals) {
      window.AppModals.closeAll();
    }
  }

  function initPWA() {
    // Detect if app is running in installed Standalone mode (from home screen)
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) 
      || window.navigator.standalone === true 
      || (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://'));

    // Register Service Worker for offline capability & push
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('[PWA] Service Worker registered:', reg.scope);
          })
          .catch(err => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // Wire Notification Onboarding buttons
    const enableNotifBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotifBtn) enableNotifBtn.addEventListener('click', handleEnableNotifications);

    const dismissNotifBtn = document.getElementById('dismissNotificationsBtn');
    if (dismissNotifBtn) dismissNotifBtn.addEventListener('click', handleDismissNotifications);

    if (isStandalone) {
      updateInstallUI('installed');
      // Person has installed and launched the app! Prompt them for daily lunch alerts
      checkAndPromptInstalledNotifications();
      return;
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      updateInstallUI('ready');
      console.log('[PWA] Captured beforeinstallprompt');
    });

    // App installed event: Only prompt for notifications once the app is installed
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      updateInstallUI('installed');
      if (window.AppModals) {
        window.AppModals.showToast("Rukky's Picks added to your home screen! 🎉", '📲');
      }
      checkAndPromptInstalledNotifications();
    });

    // Wire Install App Buttons
    const installAppBtn = document.getElementById('installAppBtn');
    if (installAppBtn) installAppBtn.addEventListener('click', triggerPWAInstall);

    const navInstall = document.getElementById('navInstall');
    if (navInstall) navInstall.addEventListener('click', triggerPWAInstall);
  }

  // --- INITIALIZATION ---
  function init() {
    // 1. Initialize Modals Component
    window.AppModals.init(handleSubmitSuggestion);
    window.AppModals.setSpotsData(allSpots);

    // 2. Initialize Specials Carousel Component
    window.SpecialsBoard.init(allSpecials, (specialDeal) => {
      budgetInput.value = specialDeal.price;
      currentBudget = specialDeal.price;
      if (window.RukkysAnalytics) {
        window.RukkysAnalytics.trackEvent('special_deal_click', {
          title: specialDeal.title,
          price: specialDeal.price,
          spotName: specialDeal.vendor,
          label: `Viewed deal: ${specialDeal.title}`
        });
        window.RukkysAnalytics.trackBudgetSearch(specialDeal.price);
      }
      renderCombos();
      window.AppModals.showToast(`Budget set to ${window.MealCard.formatNaira(specialDeal.price)} for ${specialDeal.vendor}!`, '🎯');
      budgetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // 3. Bind Budget Input & Search
    if (findCombosBtn) findCombosBtn.addEventListener('click', triggerBudgetSearch);
    if (budgetInput) {
      budgetInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') triggerBudgetSearch();
      });
    }

    // 4. Bind Preset Budget Buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = btn.getAttribute('data-amt');
        budgetInput.value = amt;
        currentBudget = parseFloat(amt);
        if (window.RukkysAnalytics) {
          window.RukkysAnalytics.trackBudgetSearch(parseFloat(amt));
        }

        // Highlight active preset button
        document.querySelectorAll('.preset-btn').forEach(b => {
          b.classList.remove('bg-brand-600', 'text-white', 'border-brand-700');
          b.classList.add('bg-stone-100', 'text-stone-700', 'border-stone-200/80');
        });
        btn.classList.remove('bg-stone-100', 'text-stone-700', 'border-stone-200/80');
        btn.classList.add('bg-brand-600', 'text-white', 'border-brand-700');

        renderCombos();
        window.AppModals.showToast(`Budget set to ${window.MealCard.formatNaira(amt)}`, '💰');
      });
    });

    // Clear preset button highlights if user types a custom budget
    if (budgetInput) {
      budgetInput.addEventListener('input', () => {
        document.querySelectorAll('.preset-btn').forEach(b => {
          b.classList.remove('bg-brand-600', 'text-white', 'border-brand-700');
          b.classList.add('bg-stone-100', 'text-stone-700', 'border-stone-200/80');
        });
      });
    }

    // 5. Category Filter Pills
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(b => {
          b.classList.remove('active', 'bg-stone-900', 'text-white', 'border-stone-900', 'shadow-sm');
          b.classList.add('bg-stone-100', 'text-stone-700', 'border-stone-200/80');
        });
        btn.classList.add('active', 'bg-stone-900', 'text-white', 'border-stone-900', 'shadow-sm');
        btn.classList.remove('bg-stone-100', 'text-stone-700', 'border-stone-200/80');
        currentFilter = btn.getAttribute('data-category');
        renderCombos();
      });
    });

    // 6. Sort Dropdown
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderCombos();
      });
    }

    // 7. Surprise Food Picker
    if (surpriseBtn) {
      surpriseBtn.addEventListener('click', () => {
        let pool = allCombos;
        if (currentBudget) {
          pool = pool.filter(c => c.price <= currentBudget);
        }
        if (pool.length === 0) pool = allCombos;

        if (pool.length === 0) {
          if (window.AppModals) window.AppModals.showToast("No meals available to pick right now!", "🍲");
          return;
        }

        const randomPick = pool[Math.floor(Math.random() * pool.length)];
        if (!randomPick) return;

        budgetInput.value = randomPick.price;
        currentBudget = randomPick.price;
        currentFilter = 'all';

        if (window.RukkysAnalytics && randomPick) {
          window.RukkysAnalytics.trackEvent('surprise_pick', {
            title: randomPick.title,
            price: randomPick.price,
            label: `Surprise pick: ${randomPick.title}`
          });
          window.RukkysAnalytics.trackBudgetSearch(randomPick.price);
        }

        // Reset filter pills UI
        document.querySelectorAll('.filter-pill').forEach(b => {
          b.className = "filter-pill px-3.5 py-1.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/80 transition tap-highlight-transparent";
        });
        const allPill = document.querySelector('[data-category="all"]');
        if (allPill) allPill.className = "filter-pill active px-3.5 py-1.5 rounded-full text-xs font-black bg-stone-900 text-white border border-stone-900 shadow-sm transition tap-highlight-transparent";

        renderCombos();
        window.AppModals.showToast(`Rukky picked: ${randomPick.title.split('+')[0]}!`, '🎲');
      });
    }

    // 8. Reset Min Button
    if (resetMinBtn) {
      resetMinBtn.addEventListener('click', () => {
        budgetInput.value = 1200;
        currentBudget = 1200;
        currentFilter = 'all';
        renderCombos();
      });
    }

    // 9. Bottom Navigation Bar Buttons
    const navExplore = document.getElementById('navExplore');
    if (navExplore) navExplore.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const navLocations = document.getElementById('navLocations');
    if (navLocations) navLocations.addEventListener('click', () => window.AppModals.openSpots());

    const navSuggest = document.getElementById('navSuggest');
    if (navSuggest) navSuggest.addEventListener('click', () => window.AppModals.openSuggest());

    const navRukkyTip = document.getElementById('navRukkyTip');
    if (navRukkyTip) navRukkyTip.addEventListener('click', () => window.AppModals.openTips());

    const infoBtn = document.getElementById('infoBtn');
    if (infoBtn) infoBtn.addEventListener('click', () => window.AppModals.openTips());

    // 10. PWA Installation Controller
    initPWA();

    // 11. Initial Engine Computation & Render
    refreshEngineCombos();

    // 12. Live Sync with Firestore / Local Storage
    if (window.dbService) {
      // Primary: Listen to individual food items & let Rukky's Engine mix dynamically
      window.dbService.listenItems(items => {
        if (Array.isArray(items)) {
          allItems = items;
          refreshEngineCombos();
        }
      });

      window.dbService.listenSpots(spots => {
        if (Array.isArray(spots) && spots.length) {
          allSpots = spots;
          window.AppModals.setSpotsData(spots);
          refreshEngineCombos();
        }
      });

      window.dbService.listenSpecials(specials => {
        if (Array.isArray(specials)) {
          allSpecials = specials.filter(s => s.active !== false);
          window.SpecialsBoard.updateSpecials(allSpecials);
        }
      });

      // Listen to curated combos & Campus Hacks
      if (window.dbService.listenCombos) {
        window.dbService.listenCombos(combos => {
          if (Array.isArray(combos)) {
            curatedCombos = combos.filter(c => c.active !== false);
            refreshEngineCombos();
          }
        });
      }

      if (window.dbService.listenEngineRules) {
        window.dbService.listenEngineRules(rules => {
          if (rules) {
            window.currentEngineRules = rules;
            refreshEngineCombos();
          }
        });
      }
    }
  }

  // Run on DOM load
  window.addEventListener('DOMContentLoaded', init);
})();

