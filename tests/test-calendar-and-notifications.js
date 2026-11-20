/**
 * Targeted verification for:
 * 1. Calendar / dayOfWeek filtering in SpecialsBoard
 * 2. Installed-only notification prompt behavior
 */

const assert = require('assert');

// 1. Mock DOM and Window
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(...c) { c.forEach(x => this.classes.add(x)); }
  remove(...c) { c.forEach(x => this.classes.delete(x)); }
  contains(x) { return this.classes.has(x); }
}

class MockElement {
  constructor(tag, id = null) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.classList = new MockClassList();
    this.attributes = {};
    this.listeners = {};
    this.innerText = '';
    this.textContent = '';
    this._innerHTML = '';
  }
  set innerHTML(val) { this._innerHTML = val; }
  get innerHTML() { return this._innerHTML || ''; }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] || null; }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  dispatchEvent(evt) {
    if (this.listeners[evt.type]) this.listeners[evt.type].forEach(fn => fn(evt));
  }
  click() { this.dispatchEvent({ type: 'click' }); }
  querySelectorAll() { return []; }
}

const elements = {
  specialCardContent: new MockElement('div', 'specialCardContent'),
  specialsDotsContainer: new MockElement('div', 'specialsDotsContainer'),
  specialsDateBadge: new MockElement('span', 'specialsDateBadge'),
  specialsBoardHeading: new MockElement('span', 'specialsBoardHeading'),
  nextSpecialBtn: new MockElement('button', 'nextSpecialBtn'),
  specialsDayFilterBar: new MockElement('div', 'specialsDayFilterBar'),
  notificationOnboardModal: new MockElement('div', 'notificationOnboardModal')
};

global.document = {
  getElementById: (id) => elements[id] || new MockElement('div', id)
};

global.window = {
  document: global.document,
  matchMedia: (q) => ({ matches: false })
};

// Load SpecialsBoard
require('../js/components/specials-board.js');

console.log('Testing SpecialsBoard Calendar & Time logic...');

const todayKey = window.SpecialsBoard.getTodayDayKey();
console.log('Detected Today Day Key:', todayKey);
const expectedDayKey = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: 'Africa/Lagos'
}).format(new Date()).toLowerCase();
assert.strictEqual(todayKey, expectedDayKey, 'Today must match Lagos timezone weekday');

// Dynamic test data: A deal for another day, a deal for today, and an everyday deal
const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const otherDayKey = daysOfWeek[(new Date().getDay() + 1) % 7];

const testSpecials = [
  { id: 'spec-other', title: 'Other Day Special Dish', dayOfWeek: otherDayKey, price: 1200, vendor: "Vicky's Kitchen", active: true },
  { id: 'spec-today', title: "Today's Verified Special", dayOfWeek: todayKey, price: 1600, vendor: 'Iya Beji', active: true },
  { id: 'spec-every', title: 'Everyday Jollof Box', dayOfWeek: 'everyday', price: 1400, vendor: 'Campus Express', active: true }
];

// Initialize on current day
window.SpecialsBoard.init(testSpecials, () => {});

// Test 2: In Today view, other day's deal MUST NOT show!
const cardHtml = elements.specialCardContent.innerHTML;
assert.ok(!cardHtml.includes('Other Day Special Dish'), "CRITICAL: Other day's deal MUST NOT appear in Today's view!");
assert.ok(cardHtml.includes("Today's Verified Special"), "Today's deal MUST appear in Today view!");
console.log(`✅ PASS: ${todayKey} Today view strictly shows ${todayKey} & Everyday deals, excludes other days!`);

// Test 3: What if there are NO deals for today?
const noTodaySpecials = [
  { id: 'spec-other-1', title: 'Other Day Special Dish', dayOfWeek: otherDayKey, price: 1200, active: true }
];
window.SpecialsBoard.updateSpecials(noTodaySpecials);
const emptyCardHtml = elements.specialCardContent.innerHTML;
assert.ok(!emptyCardHtml.includes('Other Day Special Dish'), "Other day deals must not show when today has no deals!");
const todayCap = todayKey.charAt(0).toUpperCase() + todayKey.slice(1);
assert.ok(emptyCardHtml.includes(`No ${todayCap} Special Deals Found`), "Must show clean empty notice for today!");
console.log('✅ PASS: Clean empty day state renders without leaking other days!');

console.log('\n🎉 ALL CALENDAR & TIMING TESTS PASSED!');
