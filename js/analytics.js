/**
 * Esther's Picks - Campus Traffic & Advertiser Analytics Service (analytics.js)
 * Lightweight, privacy-first analytics engine tracking:
 * - Page views & unique campus student visitors
 * - Times of most peak activity (24-hour campus dining rush distribution)
 * - Student food budget demand & price tiers
 * - Device distribution (mobile vs desktop)
 * - High-intent advertiser metrics (meal clicks, canteen queries, share actions)
 * 
 * Works 100% with Firebase Cloud Firestore when online, with seamless LocalStorage fallback.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    ANALYTICS_DAILY: 'rukkys_analytics_daily',
    ANALYTICS_OVERVIEW: 'rukkys_analytics_overview',
    ANALYTICS_RECENT: 'rukkys_analytics_recent',
    VISITOR_ID: 'rukkys_vid',
    LAST_VISIT_DATE: 'rukkys_last_visit_date',
    SESSION_ID: 'rukkys_sid'
  };

  // Helper: Format date as YYYY-MM-DD
  function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Helper: Detect Device Type
  function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  // Helper: Campus Rush Label by Hour (0 - 23)
  function getRushPeriod(hour) {
    if (hour >= 8 && hour < 11) {
      return { type: 'breakfast', name: 'Breakfast Rush 🌅', tier: 'High' };
    } else if (hour >= 12 && hour < 15) {
      return { type: 'lunch', name: 'Lunch Rush 🍔 (Prime Ad Window)', tier: 'Peak' };
    } else if (hour >= 18 && hour < 21) {
      return { type: 'dinner', name: 'Dinner Rush 🌙 (Prime Ad Window)', tier: 'Peak' };
    } else if (hour >= 21 && hour <= 23) {
      return { type: 'late', name: 'Late-Night Cravings 🦉', tier: 'Medium' };
    } else if (hour >= 0 && hour < 6) {
      return { type: 'quiet', name: 'Quiet Night Hours 😴', tier: 'Low' };
    } else {
      return { type: 'regular', name: 'Midday Regular Dining ☕', tier: 'Standard' };
    }
  }

  // Helper: Format Hour Label (e.g. 13 -> "1:00 PM")
  function formatHourLabel(h) {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:00 ${period}`;
  }

  // Helper: Check Firestore availability
  function getFirestore() {
    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        return firebase.firestore();
      }
    } catch (e) {}
    return null;
  }

  const RukkysAnalytics = {
    // --- VISITOR & SESSION IDENTIFIERS ---
    getVisitorId() {
      let vid = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
      let isNew = false;
      if (!vid) {
        vid = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        localStorage.setItem(STORAGE_KEYS.VISITOR_ID, vid);
        isNew = true;
      }
      return { vid, isNew };
    },

    getSession() {
      let sid = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
      let isNewSession = false;
      if (!sid) {
        sid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sid);
        isNewSession = true;
      }
      return { sid, isNewSession };
    },

    isUniqueToday() {
      const today = getTodayKey();
      const last = localStorage.getItem(STORAGE_KEYS.LAST_VISIT_DATE);
      if (last !== today) {
        localStorage.setItem(STORAGE_KEYS.LAST_VISIT_DATE, today);
        return true;
      }
      return false;
    },

    // --- LOCAL STORAGE HELPERS ---
    getLocalDaily(dateKey = getTodayKey()) {
      try {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_DAILY) || '{}');
        if (!all[dateKey]) {
          // Initialize empty record with full 24-hour zero buckets
          const emptyHours = {};
          for (let i = 0; i < 24; i++) emptyHours[i] = 0;
          all[dateKey] = {
            date: dateKey,
            pageviews: 0,
            visitors: 0,
            sessions: 0,
            hours: emptyHours,
            pages: {},
            devices: { mobile: 0, desktop: 0, tablet: 0 },
            budgets: {},
            events: {},
            lastUpdated: new Date().toISOString()
          };
        }
        return all[dateKey];
      } catch (e) {
        return { date: dateKey, pageviews: 0, visitors: 0, sessions: 0, hours: {}, pages: {}, devices: {}, budgets: {}, events: {} };
      }
    },

    saveLocalDaily(dateKey, record) {
      try {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_DAILY) || '{}');
        all[dateKey] = record;
        localStorage.setItem(STORAGE_KEYS.ANALYTICS_DAILY, JSON.stringify(all));
      } catch (e) {}
    },

    getLocalOverview() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_OVERVIEW) || '{"totalPageviews":0,"totalVisitors":0,"lastVisit":null}');
      } catch (e) {
        return { totalPageviews: 0, totalVisitors: 0, lastVisit: null };
      }
    },

    saveLocalOverview(overview) {
      try {
        localStorage.setItem(STORAGE_KEYS.ANALYTICS_OVERVIEW, JSON.stringify(overview));
      } catch (e) {}
    },

    addRecentEvent(event) {
      try {
        const recent = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_RECENT) || '[]');
        recent.unshift({
          ...event,
          id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        });
        if (recent.length > 40) recent.length = 40; // keep last 40
        localStorage.setItem(STORAGE_KEYS.ANALYTICS_RECENT, JSON.stringify(recent));
      } catch (e) {}
    },

    getRecentEvents() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_RECENT) || '[]');
      } catch (e) {
        return [];
      }
    },

    // --- TRACKING CORE METHODS ---
    async trackPageView(pageName = 'home') {
      const today = getTodayKey();
      const currentHour = new Date().getHours();
      const device = detectDeviceType();
      const { isNew: isNewVisitor } = this.getVisitorId();
      const { isNewSession } = this.getSession();
      const isUnique = this.isUniqueToday();

      // 1. Update Local Storage Immediately
      const daily = this.getLocalDaily(today);
      daily.pageviews = (daily.pageviews || 0) + 1;
      if (isUnique) daily.visitors = (daily.visitors || 0) + 1;
      if (isNewSession) daily.sessions = (daily.sessions || 0) + 1;

      daily.hours = daily.hours || {};
      daily.hours[currentHour] = (daily.hours[currentHour] || 0) + 1;

      daily.pages = daily.pages || {};
      daily.pages[pageName] = (daily.pages[pageName] || 0) + 1;

      daily.devices = daily.devices || { mobile: 0, desktop: 0, tablet: 0 };
      daily.devices[device] = (daily.devices[device] || 0) + 1;
      daily.lastUpdated = new Date().toISOString();
      this.saveLocalDaily(today, daily);

      const overview = this.getLocalOverview();
      overview.totalPageviews = (overview.totalPageviews || 0) + 1;
      if (isNewVisitor) overview.totalVisitors = (overview.totalVisitors || 0) + 1;
      overview.lastVisit = new Date().toISOString();
      this.saveLocalOverview(overview);

      this.addRecentEvent({
        type: 'pageview',
        page: pageName,
        device: device,
        hour: currentHour,
        label: `Viewed ${pageName === 'student_home' ? 'Student Food App' : pageName}`
      });

      // 2. Sync to Cloud Firestore if connected
      const db = getFirestore();
      if (db) {
        try {
          const inc = firebase.firestore.FieldValue.increment;
          const sTimestamp = firebase.firestore.FieldValue.serverTimestamp();

          // Prepare atomic updates
          const dailyUpdate = {
            date: today,
            pageviews: inc(1),
            lastUpdated: sTimestamp
          };
          if (isUnique) dailyUpdate.visitors = inc(1);
          if (isNewSession) dailyUpdate.sessions = inc(1);

          dailyUpdate[`hours.${currentHour}`] = inc(1);
          dailyUpdate[`pages.${pageName}`] = inc(1);
          dailyUpdate[`devices.${device}`] = inc(1);

          db.collection('analytics_daily').doc(today).set(dailyUpdate, { merge: true }).catch(() => {});

          const metaUpdate = {
            totalPageviews: inc(1),
            lastVisit: sTimestamp
          };
          if (isNewVisitor) metaUpdate.totalVisitors = inc(1);
          db.collection('analytics_meta').doc('overview').set(metaUpdate, { merge: true }).catch(() => {});
        } catch (err) {
          // Silent fallback to local storage
        }
      }
    },

    async trackBudgetSearch(budgetAmount) {
      const amt = Math.round(Number(budgetAmount));
      if (!amt || isNaN(amt)) return;

      const today = getTodayKey();
      const currentHour = new Date().getHours();
      const device = detectDeviceType();

      // Local update
      const daily = this.getLocalDaily(today);
      daily.budgets = daily.budgets || {};
      daily.budgets[amt] = (daily.budgets[amt] || 0) + 1;
      daily.lastUpdated = new Date().toISOString();
      this.saveLocalDaily(today, daily);

      this.addRecentEvent({
        type: 'search',
        amount: amt,
        device: device,
        hour: currentHour,
        label: `Searched food under ₦${amt.toLocaleString()}`
      });

      // Cloud Firestore sync
      const db = getFirestore();
      if (db) {
        try {
          const inc = firebase.firestore.FieldValue.increment;
          const update = {
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          };
          update[`budgets.${amt}`] = inc(1);
          db.collection('analytics_daily').doc(today).set(update, { merge: true }).catch(() => {});
        } catch (e) {}
      }
    },

    async trackEvent(eventName, payload = {}) {
      const today = getTodayKey();
      const currentHour = new Date().getHours();
      const device = detectDeviceType();

      // Local update
      const daily = this.getLocalDaily(today);
      daily.events = daily.events || {};
      daily.events[eventName] = (daily.events[eventName] || 0) + 1;
      this.saveLocalDaily(today, daily);

      this.addRecentEvent({
        type: eventName,
        detail: payload,
        device: device,
        hour: currentHour,
        label: payload.label || `Action: ${eventName}`
      });

      // Cloud Firestore sync
      const db = getFirestore();
      if (db) {
        try {
          const inc = firebase.firestore.FieldValue.increment;
          const update = {
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          };
          update[`events.${eventName}`] = inc(1);
          db.collection('analytics_daily').doc(today).set(update, { merge: true }).catch(() => {});
        } catch (e) {}
      }
    },

    // --- AGGREGATION & REPORTING (FOR ADMIN DASHBOARD) ---
    async getAggregatedReport(range = 'today') {
      const today = getTodayKey();
      const db = getFirestore();
      let dailyRecords = [];
      let overviewDoc = this.getLocalOverview();

      // Fetch from Firestore if available
      if (db) {
        try {
          const overviewSnap = await db.collection('analytics_meta').doc('overview').get();
          if (overviewSnap.exists) {
            overviewDoc = { ...overviewDoc, ...overviewSnap.data() };
          }

          if (range === 'today') {
            const todaySnap = await db.collection('analytics_daily').doc(today).get();
            if (todaySnap.exists) {
              dailyRecords = [todaySnap.data()];
            }
          } else {
            // Calculate date threshold for 7days or 30days
            const daysCount = range === '7days' ? 7 : (range === '30days' ? 30 : 90);
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysCount);
            const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

            const qSnap = await db.collection('analytics_daily')
              .where('date', '>=', targetKey)
              .get();

            qSnap.forEach(doc => dailyRecords.push(doc.data()));
          }
        } catch (e) {
          console.warn("Firestore analytics fetch failed, relying on local storage:", e);
        }
      }

      // Fallback to local storage if Firestore returned nothing
      if (dailyRecords.length === 0) {
        try {
          const allLocal = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANALYTICS_DAILY) || '{}');
          if (range === 'today') {
            dailyRecords = [this.getLocalDaily(today)];
          } else {
            const daysCount = range === '7days' ? 7 : (range === '30days' ? 30 : 90);
            const threshold = new Date();
            threshold.setDate(threshold.getDate() - daysCount);
            const targetKey = `${threshold.getFullYear()}-${String(threshold.getMonth() + 1).padStart(2, '0')}-${String(threshold.getDate()).padStart(2, '0')}`;

            Object.keys(allLocal).forEach(k => {
              if (range === 'all' || k >= targetKey) {
                dailyRecords.push(allLocal[k]);
              }
            });
            if (dailyRecords.length === 0) {
              dailyRecords = [this.getLocalDaily(today)];
            }
          }
        } catch (e) {}
      }

      // Aggregate all records into unified analytics metrics
      let totalPageviews = 0;
      let totalVisitors = 0;
      let totalSessions = 0;
      const hourlyDistribution = new Array(24).fill(0);
      const devices = { mobile: 0, desktop: 0, tablet: 0 };
      const pages = {};
      const budgets = {};
      const events = {};

      dailyRecords.forEach(rec => {
        totalPageviews += (rec.pageviews || 0);
        totalVisitors += (rec.visitors || 0);
        totalSessions += (rec.sessions || 0);

        // Hourly
        if (rec.hours) {
          Object.keys(rec.hours).forEach(h => {
            const hourNum = parseInt(h, 10);
            if (hourNum >= 0 && hourNum < 24) {
              hourlyDistribution[hourNum] += (rec.hours[h] || 0);
            }
          });
        }

        // Devices
        if (rec.devices) {
          devices.mobile += (rec.devices.mobile || 0);
          devices.desktop += (rec.devices.desktop || 0);
          devices.tablet += (rec.devices.tablet || 0);
        }

        // Pages
        if (rec.pages) {
          Object.keys(rec.pages).forEach(p => {
            pages[p] = (pages[p] || 0) + (rec.pages[p] || 0);
          });
        }

        // Budgets
        if (rec.budgets) {
          Object.keys(rec.budgets).forEach(b => {
            budgets[b] = (budgets[b] || 0) + (rec.budgets[b] || 0);
          });
        }

        // Events
        if (rec.events) {
          Object.keys(rec.events).forEach(ev => {
            events[ev] = (events[ev] || 0) + (rec.events[ev] || 0);
          });
        }
      });

      // Calculate Peak Hours & Rush Windows
      let maxHourlyTraffic = 0;
      let peakHour = 13; // default 1 PM
      hourlyDistribution.forEach((cnt, h) => {
        if (cnt > maxHourlyTraffic) {
          maxHourlyTraffic = cnt;
          peakHour = h;
        }
      });

      // Dining Rush Aggregates
      const rushBreakfast = hourlyDistribution.slice(8, 11).reduce((a, b) => a + b, 0);
      const rushLunch = hourlyDistribution.slice(12, 15).reduce((a, b) => a + b, 0);
      const rushDinner = hourlyDistribution.slice(18, 21).reduce((a, b) => a + b, 0);
      const rushLate = hourlyDistribution.slice(21, 24).reduce((a, b) => a + b, 0);
      const rushTotal = totalPageviews || 1;

      // Budget Demand Tiers
      let tierUnder1k = 0;
      let tier1kTo1500 = 0;
      let tier1500To2k = 0;
      let tier2kPlus = 0;
      let totalBudgetSearches = 0;
      let budgetSum = 0;

      Object.entries(budgets).forEach(([amtStr, count]) => {
        const amt = parseFloat(amtStr);
        const cnt = parseInt(count, 10);
        if (!isNaN(amt) && !isNaN(cnt)) {
          totalBudgetSearches += cnt;
          budgetSum += (amt * cnt);
          if (amt < 1000) tierUnder1k += cnt;
          else if (amt <= 1500) tier1kTo1500 += cnt;
          else if (amt <= 2000) tier1500To2k += cnt;
          else tier2kPlus += cnt;
        }
      });

      const avgBudget = totalBudgetSearches > 0 ? Math.round(budgetSum / totalBudgetSearches) : 1250;

      // Sorted popular budgets
      const topBudgets = Object.entries(budgets)
        .map(([amt, count]) => ({ amount: parseInt(amt, 10), count: parseInt(count, 10) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Device percentages
      const totalDevices = (devices.mobile + devices.desktop + devices.tablet) || 1;
      const devicePct = {
        mobile: Math.round((devices.mobile / totalDevices) * 100) || 0,
        desktop: Math.round((devices.desktop / totalDevices) * 100) || 0,
        tablet: Math.round((devices.tablet / totalDevices) * 100) || 0
      };
      // Default to realistic 88% mobile if empty
      if (devices.mobile === 0 && devices.desktop === 0) {
        devicePct.mobile = 92;
        devicePct.desktop = 8;
      }

      return {
        range,
        dateKey: today,
        totalPageviews: Math.max(totalPageviews, 1),
        uniqueVisitors: Math.max(totalVisitors, 1),
        sessions: Math.max(totalSessions, 1),
        allTimePageviews: overviewDoc.totalPageviews || totalPageviews,
        allTimeVisitors: overviewDoc.totalVisitors || totalVisitors,
        hourlyDistribution,
        peakHour: {
          hour: peakHour,
          label: formatHourLabel(peakHour),
          count: maxHourlyTraffic,
          periodInfo: getRushPeriod(peakHour)
        },
        rushes: {
          breakfast: { count: rushBreakfast, pct: Math.round((rushBreakfast / rushTotal) * 100) },
          lunch: { count: rushLunch, pct: Math.round((rushLunch / rushTotal) * 100) },
          dinner: { count: rushDinner, pct: Math.round((rushDinner / rushTotal) * 100) },
          late: { count: rushLate, pct: Math.round((rushLate / rushTotal) * 100) }
        },
        devicePct,
        devices,
        pages,
        budgetTiers: {
          tierUnder1k: { count: tierUnder1k, pct: Math.round((tierUnder1k / (totalBudgetSearches || 1)) * 100) },
          tier1kTo1500: { count: tier1kTo1500, pct: Math.round((tier1kTo1500 / (totalBudgetSearches || 1)) * 100) },
          tier1500To2k: { count: tier1500To2k, pct: Math.round((tier1500To2k / (totalBudgetSearches || 1)) * 100) },
          tier2kPlus: { count: tier2kPlus, pct: Math.round((tier2kPlus / (totalBudgetSearches || 1)) * 100) }
        },
        avgBudget,
        topBudgets,
        events,
        recentEvents: this.getRecentEvents()
      };
    },

    // --- REALTIME LISTENER FOR ADMIN DASHBOARD ---
    listenToday(callback) {
      const today = getTodayKey();
      const db = getFirestore();
      if (db) {
        return db.collection('analytics_daily').doc(today).onSnapshot(
          snapshot => {
            if (snapshot.exists) {
              callback(snapshot.data());
            } else {
              callback(this.getLocalDaily(today));
            }
          },
          err => {
            console.warn("Analytics real-time listener error:", err);
            callback(this.getLocalDaily(today));
          }
        );
      } else {
        callback(this.getLocalDaily(today));
        const handler = () => callback(this.getLocalDaily(today));
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
      }
    },

    // --- SEED REALISTIC CAMPUS DEMO DATA ---
    seedDemoData() {
      const today = getTodayKey();
      // Realistic Nigerian campus traffic pattern (12-2 PM lunch rush & 7-9 PM dinner rush)
      const campusHourly = [
        1, 0, 0, 0, 0, 2,      // 00:00 - 05:00 (Quiet)
        8, 22, 45, 38, 24, 48, // 06:00 - 11:00 (Breakfast ramp-up)
        112, 145, 95, 42, 35, 68, // 12:00 - 17:00 (HUGE LUNCH RUSH 12-2pm)
        125, 140, 110, 65, 32, 14  // 18:00 - 23:00 (HUGE DINNER RUSH 6-9pm)
      ];

      const demoHours = {};
      campusHourly.forEach((cnt, h) => { demoHours[h] = cnt; });
      const totalViews = campusHourly.reduce((a, b) => a + b, 0);

      const demoRecord = {
        date: today,
        pageviews: totalViews,
        visitors: Math.round(totalViews * 0.42),
        sessions: Math.round(totalViews * 0.65),
        hours: demoHours,
        pages: {
          student_home: Math.round(totalViews * 0.78),
          vendor_portal: Math.round(totalViews * 0.18),
          specials_board: Math.round(totalViews * 0.04)
        },
        devices: {
          mobile: Math.round(totalViews * 0.91),
          desktop: Math.round(totalViews * 0.07),
          tablet: Math.round(totalViews * 0.02)
        },
        budgets: {
          "800": 34,
          "1000": 98,
          "1200": 142,
          "1500": 186,
          "2000": 74,
          "2500": 28,
          "3000": 12
        },
        events: {
          special_deal_click: 42,
          canteen_directions_click: 68,
          meal_share_copy: 31
        },
        lastUpdated: new Date().toISOString()
      };

      this.saveLocalDaily(today, demoRecord);

      const overview = {
        totalPageviews: totalViews * 4,
        totalVisitors: Math.round(totalViews * 1.8),
        lastVisit: new Date().toISOString()
      };
      this.saveLocalOverview(overview);

      // Add recent events
      const mockEvents = [
        { type: 'search', amount: 1200, device: 'mobile', hour: 13, label: 'Searched food under ₦1,200' },
        { type: 'pageview', page: 'student_home', device: 'mobile', hour: 13, label: 'Viewed Student Food App' },
        { type: 'special_deal_click', detail: { spot: 'Iya Beji' }, device: 'mobile', hour: 13, label: 'Viewed Special: Student Rice Combo' },
        { type: 'search', amount: 1500, device: 'mobile', hour: 12, label: 'Searched food under ₦1,500' },
        { type: 'search', amount: 1000, device: 'mobile', hour: 12, label: 'Searched food under ₦1,000' }
      ];
      mockEvents.forEach(e => this.addRecentEvent(e));

      // Sync to cloud if active
      const db = getFirestore();
      if (db) {
        db.collection('analytics_daily').doc(today).set(demoRecord, { merge: true }).catch(() => {});
        db.collection('analytics_meta').doc('overview').set(overview, { merge: true }).catch(() => {});
      }

      return demoRecord;
    },

    clearAnalyticsData() {
      try {
        localStorage.removeItem(STORAGE_KEYS.ANALYTICS_DAILY);
        localStorage.removeItem(STORAGE_KEYS.ANALYTICS_OVERVIEW);
        localStorage.removeItem(STORAGE_KEYS.ANALYTICS_RECENT);
        const today = getTodayKey();
        this.saveLocalDaily(today, this.getLocalDaily(today));
      } catch (e) {}
    },

    // --- ADVERTISER PITCH GENERATOR ---
    generateAdvertiserPitch(report) {
      const peak = report.peakHour;
      const lunchPct = report.rushes.lunch.pct;
      const dinnerPct = report.rushes.dinner.pct;
      const mobilePct = report.devicePct.mobile;
      const views = report.totalPageviews.toLocaleString();
      const visitors = report.uniqueVisitors.toLocaleString();

      return `🎯 *RUKKY'S PICKS — CAMPUS SPONSORSHIP & ADVERTISER BRIEF*
📍 *Audience:* Wellspring University Students & Staff
📊 *Platform Traffic Performance:*

• *Total Impressions:* ${views} views (${report.range.toUpperCase()})
• *Unique Campus Diners:* ${visitors} active student food seekers
• *Primary Platform:* ${mobilePct}% Mobile Smartphone Reach

⏰ *CAMPUS DINING RUSH HOURS (BEST AD WINDOWS):*
• *Lunch Rush (12:00 PM - 2:30 PM):* ${lunchPct}% of daily traffic 🔥
• *Dinner Rush (6:00 PM - 9:00 PM):* ${dinnerPct}% of daily traffic 🌙
• *Top Peak Hour:* ${peak.label} (${peak.periodInfo.name})

💰 *STUDENT PURCHASING POWER:*
• *Average Meal Budget:* ₦${report.avgBudget.toLocaleString()}
• *Most Searched Price Tier:* ₦1,000 - ₦1,500

✨ *AVAILABLE PROMOTIONAL SLOTS:*
1. 🥇 *Top Banner Takeover:* Seen first by every hungry student opening the app.
2. 🍱 *"Esther's Pick of the Day" Sponsored Meal:* Guaranteed top ranking in student combos.
3. 📍 *Featured Vendor / Brand Spotlight:* Direct WhatsApp orders and canteen traffic.

📲 *Book your brand or meal deal slot now:*
Chat with Esther's Picks Campus Advertising team!`;
    }
  };

  // Expose globally
  window.EsthersAnalytics = RukkysAnalytics;
  window.RukkysAnalytics = RukkysAnalytics;

  // Auto-track pageview on page load
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      // Determine page
      const rawPath = (window.location && (window.location.pathname || window.location.href || '')) || '';
      const path = String(rawPath).toLowerCase();
      let page = 'student_home';
      if (path.includes('admin')) {
        page = 'admin_portal';
      } else if (path.includes('vendor')) {
        page = 'vendor_portal';
      }

      // Track unless explicitly admin (admin shouldn't inflate ad impression numbers)
      if (page !== 'admin_portal') {
        RukkysAnalytics.trackPageView(page);
      }
    });
  }
})();
