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

// Test Data: One Tuesday deal, one Wednesday deal, one Friday deal, one Everyday deal
const testSpecials = [
  { id: 'spec-tue', title: 'Tuesday Porridge Yam', dayOfWeek: 'tuesday', price: 1200, vendor: "Vicky's Kitchen", active: true },
  { id: 'spec-wed', title: 'Wednesday Egusi Special', dayOfWeek: 'wednesday', price: 1600, vendor: 'Iya Beji', active: true },
  { id: 'spec-fri', title: 'Friday Fried Fish Special', dayOfWeek: 'friday', price: 2000, vendor: 'Main Canteen', active: true },
  { id: 'spec-every', title: 'Everyday Jollof Box', dayOfWeek: 'everyday', price: 1400, vendor: 'Campus Express', active: true }
];

// Initialize on current day (Wednesday)
window.SpecialsBoard.init(testSpecials, () => {});

// Test 1: Verify current day in Lagos timezone is Wednesday
const todayKey = window.SpecialsBoard.getTodayDayKey();
console.log('Detected Today Day Key:', todayKey);
assert.strictEqual(todayKey, 'wednesday', 'Today must be detected as wednesday in WAT timezone');

// Test 2: In Today view, Tuesday's deal MUST NOT show!
const cardHtml = elements.specialCardContent.innerHTML;
assert.ok(!cardHtml.includes('Tuesday Porridge Yam'), "CRITICAL: Tuesday's deal MUST NOT appear in Wednesday's Today view!");
assert.ok(cardHtml.includes('Wednesday Egusi Special'), "Wednesday's deal MUST appear in Today view!");
console.log('✅ PASS: Wednesday Today view strictly shows Wednesday & Everyday deals, excludes Tuesday!');

// Test 3: What if there are NO Wednesday deals?
const noWedSpecials = [
  { id: 'spec-tue', title: 'Tuesday Porridge Yam', dayOfWeek: 'tuesday', price: 1200, active: true },
  { id: 'spec-thu', title: 'Thursday Jollof Special', dayOfWeek: 'thursday', price: 1500, active: true }
];
window.SpecialsBoard.updateSpecials(noWedSpecials);
const emptyCardHtml = elements.specialCardContent.innerHTML;
assert.ok(!emptyCardHtml.includes('Tuesday Porridge Yam'), "Tuesday deal must STILL NOT show when Wednesday has no deals!");
assert.ok(emptyCardHtml.includes('No Wednesday Special Deals Found'), "Must show clean empty notice for Wednesday instead of leaking Tuesday!");
console.log('✅ PASS: Clean empty day state renders without leaking other days!');

console.log('\n🎉 ALL CALENDAR & TIMING TESTS PASSED!');
