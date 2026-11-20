/**
 * Esther's Picks - Dedicated Button Interaction & Penetration Test Harness
 * Exercises all buttons across index.html, admin.html, and vendor.html.
 * Simulates real user interactions, rapid clicking, and edge case inputs.
 */

const fs = require('fs');
const path = require('path');

// --- MINIMAL BROWSER / DOM EMULATOR FOR NODE ---
class MockClassList {
  constructor(initial = []) {
    this.classes = new Set(initial);
  }
  add(...cls) { cls.forEach(c => this.classes.add(c)); }
  remove(...cls) { cls.forEach(c => this.classes.delete(c)); }
  contains(c) { return this.classes.has(c); }
  toggle(c) {
    if (this.classes.has(c)) { this.classes.delete(c); return false; }
    else { this.classes.add(c); return true; }
  }
  toString() { return Array.from(this.classes).join(' '); }
}

class MockElement {
  constructor(tag, id = null) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = new MockClassList();
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.parentNode = null;
    this.innerText = '';
    this._innerHTML = '';
    this.value = '';
    this.type = tag === 'button' ? 'button' : (tag === 'input' ? 'text' : '');
    this.style = {};
  }

  set innerHTML(val) {
    this._innerHTML = val;
    // Auto-parse any buttons in innerHTML so dynamic components get real interactive child buttons
    const btnMatches = [...val.matchAll(/<button([^>]*)>(.*?)<\/button>/gis)];
    this.children = [];
    btnMatches.forEach((bm) => {
      const rawAttrs = bm[1];
      const text = bm[2].replace(/<[^>]+>/g, '').trim();
      const idMatch = rawAttrs.match(/id=["\x27]([^"\x27]+)["\x27]/i);
      const classMatch = rawAttrs.match(/class=["\x27]([^"\x27]+)["\x27]/i);
      const btn = new MockElement('button', idMatch ? idMatch[1] : null);
      if (classMatch) {
        btn.className = classMatch[1];
        btn.classList = new MockClassList(classMatch[1].split(/\s+/).filter(Boolean));
      }
      btn.innerText = text;
      const dataAttrs = [...rawAttrs.matchAll(/data-([a-z0-9_-]+)=["\x27]([^"\x27]+)["\x27]/gi)];
      dataAttrs.forEach(d => btn.setAttribute(`data-${d[1]}`, d[2]));
      this.appendChild(btn);
    });
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  hasAttribute(k) { return this.attributes[k] !== undefined; }
  removeAttribute(k) { delete this.attributes[k]; }

  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }

  dispatchEvent(event) {
    const ev = event || { type: 'click', preventDefault: () => {}, stopPropagation: () => {}, target: this };
    ev.target = this;
    if (this.listeners[ev.type]) {
      this.listeners[ev.type].forEach(fn => fn.call(this, ev));
    }
  }

  click() {
    this.dispatchEvent({ type: 'click', preventDefault: () => {}, stopPropagation: () => {}, target: this });
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }

  querySelectorAll(sel) {
    const res = [];
    function search(node) {
      if (matchesSelector(node, sel)) res.push(node);
      node.children.forEach(search);
    }
    this.children.forEach(search);
    return res;
  }

  querySelector(sel) {
    const list = this.querySelectorAll(sel);
    return list.length > 0 ? list[0] : null;
  }

  scrollIntoView() {}
  focus() {}
  reset() {}
}

function matchesSelector(node, sel) {
  if (sel.startsWith('#')) return node.id === sel.slice(1);
  if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
  if (sel.startsWith('[data-')) {
    const match = sel.match(/\[data-([a-z0-9_-]+)(?:=["\x27]([^"\x27]+)["\x27])?\]/i);
    if (match) {
      const key = `data-${match[1]}`;
      if (match[2] !== undefined) return node.getAttribute(key) === match[2];
      return node.hasAttribute(key);
    }
  }
  return node.tagName.toLowerCase() === sel.toLowerCase();
}

// Simple HTML Parser to populate DOM tree with real elements and IDs
function parseHTMLtoMockDoc(htmlContent) {
  const elementsById = {};
  const allButtons = [];

  // Parse all IDs
  const idMatches = [...htmlContent.matchAll(/<([a-z0-9-]+)[^>]*id=["\x27]([^"\x27]+)["\x27][^>]*>/gi)];
  idMatches.forEach(m => {
    const tag = m[1];
    const id = m[2];
    const el = new MockElement(tag, id);
    // Parse classes
    const classMatch = m[0].match(/class=["\x27]([^"\x27]+)["\x27]/i);
    if (classMatch) {
      el.className = classMatch[1];
      el.classList = new MockClassList(classMatch[1].split(/\s+/).filter(Boolean));
    }
    // Parse data attrs
    const dataAttrs = [...m[0].matchAll(/data-([a-z0-9_-]+)=["\x27]([^"\x27]+)["\x27]/gi)];
    dataAttrs.forEach(d => el.setAttribute(`data-${d[1]}`, d[2]));

    elementsById[id] = el;
  });

  // Parse all buttons (with or without IDs)
  const buttonMatches = [...htmlContent.matchAll(/<button([^>]*)>(.*?)<\/button>/gis)];
  buttonMatches.forEach((bm, i) => {
    const rawAttrs = bm[1];
    const innerText = bm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const idMatch = rawAttrs.match(/id=["\x27]([^"\x27]+)["\x27]/i);
    const classMatch = rawAttrs.match(/class=["\x27]([^"\x27]+)["\x27]/i);
    const typeMatch = rawAttrs.match(/type=["\x27]([^"\x27]+)["\x27]/i);

    const id = idMatch ? idMatch[1] : null;
    let el = id && elementsById[id] ? elementsById[id] : new MockElement('button', id);
    if (classMatch) {
      el.className = classMatch[1];
      el.classList = new MockClassList(classMatch[1].split(/\s+/).filter(Boolean));
    }
    if (typeMatch) el.type = typeMatch[1];
    el.innerText = innerText;

    const dataAttrs = [...rawAttrs.matchAll(/data-([a-z0-9_-]+)=["\x27]([^"\x27]+)["\x27]/gi)];
    dataAttrs.forEach(d => el.setAttribute(`data-${d[1]}`, d[2]));

    if (id) elementsById[id] = el;
    allButtons.push(el);
  });

  // Parse all forms
  const formMatches = [...htmlContent.matchAll(/<form[^>]*id=["\x27]([^"\x27]+)["\x27][^>]*>/gi)];
  formMatches.forEach(fm => {
    const id = fm[1];
    if (!elementsById[id]) elementsById[id] = new MockElement('form', id);
  });

  // Parse all inputs
  const inputMatches = [...htmlContent.matchAll(/<input[^>]*id=["\x27]([^"\x27]+)["\x27][^>]*>/gi)];
  inputMatches.forEach(im => {
    const id = im[1];
    if (!elementsById[id]) elementsById[id] = new MockElement('input', id);
  });

  // Parse all selects
  const selectMatches = [...htmlContent.matchAll(/<select[^>]*id=["\x27]([^"\x27]+)["\x27][^>]*>/gi)];
  selectMatches.forEach(sm => {
    const id = sm[1];
    if (!elementsById[id]) elementsById[id] = new MockElement('select', id);
  });

  const root = new MockElement('body', 'body');
  Object.values(elementsById).forEach(el => root.appendChild(el));
  allButtons.forEach(btn => {
    if (!root.children.includes(btn)) root.appendChild(btn);
  });

  return { root, elementsById, allButtons };
}

// Global Environment Setup
function setupEnvironment(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { root, elementsById, allButtons } = parseHTMLtoMockDoc(html);

  const storage = {};
  const localStorageMock = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
  };

  const documentMock = {
    getElementById: (id) => {
      if (elementsById[id]) return elementsById[id];
      const el = new MockElement('div', id);
      elementsById[id] = el;
      root.appendChild(el);
      return el;
    },
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    querySelector: (sel) => root.querySelector(sel),
    createElement: (tag) => new MockElement(tag),
    body: root,
    addEventListener: () => {}
  };

  const windowMock = {
    document: documentMock,
    localStorage: localStorageMock,
    scrollTo: () => {},
    addEventListener: (evt, fn) => {
      if (!windowMock._listeners) windowMock._listeners = {};
      if (!windowMock._listeners[evt]) windowMock._listeners[evt] = [];
      windowMock._listeners[evt].push(fn);
    },
    dispatchEvent: (ev) => {
      if (windowMock._listeners && windowMock._listeners[ev.type]) {
        windowMock._listeners[ev.type].forEach(fn => fn(ev));
      }
    },
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      serviceWorker: { register: async () => ({ scope: '/' }) },
      clipboard: { writeText: async () => {} }
    },
    location: { reload: () => {}, search: '', hash: '' },
    alert: (msg) => console.log('  [Alert]:', msg),
    confirm: (msg) => true,
    prompt: (msg, def) => def || 'passcode',
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {}
  };

  global.window = windowMock;
  global.document = documentMock;
  global.localStorage = localStorageMock;
  global.navigator = windowMock.navigator;
  global.confirm = windowMock.confirm;
  global.alert = windowMock.alert;

  return { html, root, elementsById, allButtons, windowMock };
}

// --- RUN PEN TESTS ---
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

async function testIndexPage() {
  console.log('\n======================================================');
  console.log('PEN TEST SUITE 1: index.html (Student App Buttons)');
  console.log('======================================================');

  const { root, elementsById, allButtons, windowMock } = setupEnvironment('index.html');

  // Load components & app
  require('../js/firebase-config.js');
  require('../js/analytics.js');
  require('../js/engine.js');
  require('../js/components/specials-board.js');
  require('../js/components/meal-card.js');
  require('../js/components/modals.js');
  require('../js/app.js');

  // Trigger DOMContentLoaded
  if (windowMock._listeners && windowMock._listeners['DOMContentLoaded']) {
    windowMock._listeners['DOMContentLoaded'].forEach(fn => fn());
  }

  console.log(`Found ${allButtons.length} static buttons in index.html`);

  // Penetration test each static button
  for (let i = 0; i < allButtons.length; i++) {
    const btn = allButtons[i];
    const desc = `Button #${i+1} [id: ${btn.id || 'none'}] (${btn.innerText.slice(0, 20)})`;
    try {
      btn.click();
      totalPassed++;
      console.log(`  ✅ PASSED: ${desc}`);
    } catch (err) {
      totalFailed++;
      failures.push({ page: 'index.html', desc, error: err.message, stack: err.stack });
      console.error(`  ❌ FAILED: ${desc} ->`, err.message);
    }
  }

  // Rapid stress clicking test (10 rapid consecutive clicks on key interactive buttons)
  const rapidTargets = ['findCombosBtn', 'surpriseBtn', 'resetMinBtn', 'installAppBtn', 'navInstall', 'navLocations', 'navSuggest', 'navRukkyTip'];
  for (const tid of rapidTargets) {
    const btn = elementsById[tid];
    if (btn) {
      try {
        for (let r = 0; r < 5; r++) btn.click();
        totalPassed++;
        console.log(`  ✅ STRESS TEST PASSED: 5x Rapid clicks on #${tid}`);
      } catch (err) {
        totalFailed++;
        failures.push({ page: 'index.html', desc: `Rapid clicks on #${tid}`, error: err.message });
        console.error(`  ❌ STRESS TEST FAILED: #${tid} ->`, err.message);
      }
    }
  }

  // Dynamic Combo Card button test
  const dummyCombo = {
    id: 'test-combo-1',
    title: 'Jollof Rice + Chicken',
    category: 'heavy',
    price: 1800,
    spotId: 'spot-1',
    spotName: 'Main Cafeteria',
    items: [{ name: 'Jollof Rice', price: 1000 }, { name: 'Chicken', price: 800 }],
    rukkysVerdict: 'Great value',
    rating: '9.5',
    vibeBadge: 'Top Pick'
  };
  const card = window.MealCard.create(dummyCombo, 2000, () => {}, () => {});
  const cardBtns = card.querySelectorAll('button');
  console.log(`Testing ${cardBtns.length} dynamic buttons on generated MealCard...`);
  cardBtns.forEach((cb, ci) => {
    try {
      cb.click();
      totalPassed++;
      console.log(`  ✅ PASSED: MealCard button #${ci+1} (${cb.className})`);
    } catch (err) {
      totalFailed++;
      failures.push({ page: 'index.html', desc: `MealCard btn #${ci+1}`, error: err.message });
      console.error(`  ❌ FAILED: MealCard btn #${ci+1} ->`, err.message);
    }
  });
}

async function testAdminPage() {
  console.log('\n======================================================');
  console.log('PEN TEST SUITE 2: admin.html (Admin Portal Buttons)');
  console.log('======================================================');

  // Clear require cache so scripts evaluate in new window context
  delete require.cache[require.resolve('../js/firebase-config.js')];
  delete require.cache[require.resolve('../js/analytics.js')];
  delete require.cache[require.resolve('../js/engine.js')];
  delete require.cache[require.resolve('../js/admin.js')];
  const { root, elementsById, allButtons, windowMock } = setupEnvironment('admin.html');

  require('../js/firebase-config.js');
  require('../js/analytics.js');
  require('../js/engine.js');
  require('../js/admin.js');

  if (windowMock._listeners && windowMock._listeners['DOMContentLoaded']) {
    windowMock._listeners['DOMContentLoaded'].forEach(fn => fn());
  }

  console.log(`Found ${allButtons.length} static buttons in admin.html`);

  for (let i = 0; i < allButtons.length; i++) {
    const btn = allButtons[i];
    const desc = `Admin Button #${i+1} [id: ${btn.id || 'none'}] (${btn.innerText.slice(0, 25)})`;
    try {
      btn.click();
      totalPassed++;
      console.log(`  ✅ PASSED: ${desc}`);
    } catch (err) {
      totalFailed++;
      failures.push({ page: 'admin.html', desc, error: err.message, stack: err.stack });
      console.error(`  ❌ FAILED: ${desc} ->`, err.message);
    }
  }

  // Test dynamic buttons inside Admin (e.g. Add Campus Hack Item Row button)
  const addRowBtn = elementsById['addHackItemRowBtn'];
  if (addRowBtn) {
    try {
      addRowBtn.click();
      addRowBtn.click();
      totalPassed++;
      console.log('  ✅ PASSED: Dynamic Campus Hack row addition');
      // Test dynamic remove row buttons
      const removeBtns = root.querySelectorAll('.remove-row-btn');
      removeBtns.forEach((rb, ri) => {
        rb.click();
        totalPassed++;
        console.log(`  ✅ PASSED: Dynamic remove row button #${ri+1}`);
      });
    } catch (err) {
      totalFailed++;
      failures.push({ page: 'admin.html', desc: 'Hack row add/remove', error: err.message });
      console.error('  ❌ FAILED: Hack row add/remove ->', err.message);
    }
  }
}

async function testVendorPage() {
  console.log('\n======================================================');
  console.log('PEN TEST SUITE 3: vendor.html (Vendor Portal Buttons)');
  console.log('======================================================');

  delete require.cache[require.resolve('../js/firebase-config.js')];
  delete require.cache[require.resolve('../js/engine.js')];
  delete require.cache[require.resolve('../js/vendor.js')];
  const { root, elementsById, allButtons, windowMock } = setupEnvironment('vendor.html');

  require('../js/firebase-config.js');
  require('../js/engine.js');
  require('../js/vendor.js');

  if (windowMock._listeners && windowMock._listeners['DOMContentLoaded']) {
    windowMock._listeners['DOMContentLoaded'].forEach(fn => fn());
  }

  console.log(`Found ${allButtons.length} static buttons in vendor.html`);

  for (let i = 0; i < allButtons.length; i++) {
    const btn = allButtons[i];
    const desc = `Vendor Button #${i+1} [id: ${btn.id || 'none'}] (${btn.innerText.slice(0, 25)})`;
    try {
      btn.click();
      totalPassed++;
      console.log(`  ✅ PASSED: ${desc}`);
    } catch (err) {
      totalFailed++;
      failures.push({ page: 'vendor.html', desc, error: err.message, stack: err.stack });
      console.error(`  ❌ FAILED: ${desc} ->`, err.message);
    }
  }
}

async function runAll() {
  try {
    await testIndexPage();
    await testAdminPage();
    await testVendorPage();

    console.log('\n======================================================');
    console.log(`PEN TEST SUMMARY`);
    console.log(`Total Buttons & Interactions Tested: ${totalPassed + totalFailed}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log('======================================================');

    if (totalFailed > 0) {
      console.error('\nFAILURE DETAILS:');
      console.error(JSON.stringify(failures, null, 2));
      process.exit(1);
    } else {
      console.log('\n🎉 ALL BUTTONS PASSED THE PEN TEST WITH 0 ERRORS!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected test harness error:', err);
    process.exit(1);
  }
}

runAll();
