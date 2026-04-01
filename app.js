const DEFAULT_CONFIG = {
  transactionsCsv: './data_2024.csv',
  rfmCsv: './RFM_moi.csv',
  imagesJson: './images.json',
  ruleFiles: {
    'About to Sleep': './fixed_file_About_to_Sleep.xlsx',
    'Champion': './fixed_file_Champion_Rules.xlsx',
    'Hibernating': './fixed_file_Hibernating_Rules.xlsx',
    'Loyal': './fixed_file_Loyal_Rules.xlsx'
  },
  bannerSlides: []
};

const CATEGORY_ORDER = [
  'all',
  'Thực phẩm',
  'Đồ uống',
  'Chăm sóc cá nhân',
  'Mẹ & bé',
  'Gia dụng',
  'Vệ sinh nhà cửa',
  'Giấy & tiện ích',
  'Sân vườn'
];

const state = {
  config: mergeConfig(DEFAULT_CONFIG, window.STORE_FILE_CONFIG || {}),
  customers: {},
  products: [],
  productMap: {},
  rulesBySegment: {},
  images: {},
  samples: [],
  currentCustomer: null,
  selectedCategory: 'all',
  searchTerm: '',
  activeSpotlight: 'for-you',
  selectedProduct: null,
  cart: {},
  activeSlide: 0,
  slideTimer: null
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  bindStaticEvents();
  fillConfigInputs();

  const sessionConfig = loadSavedConfig();
  if (sessionConfig) {
    state.config = mergeConfig(DEFAULT_CONFIG, sessionConfig);
    fillConfigInputs();
  }

  await loadAllData();
}

function cacheDom() {
  [
    'loadingView','loadingText','loginView','storeView','customerNameInput','loginBtn','loginMessage','sampleNames',
    'cfgTransactionsCsv','cfgRfmCsv','cfgImagesJson','cfgRuleAbout','cfgRuleChampion','cfgRuleHibernating','cfgRuleLoyal',
    'applyConfigBtn','loginScene','utilityRight',
    'productSearchInput','clearSearchBtn','logoutBtn','cartButton','cartCount',
    'headerCustomerName','headerCustomerSegment','welcomeCustomerName','heroTitle','heroRecommendationText',
    'heroSegmentTag','heroProductCount','sidebarFilters','sidebarProductList','productGrid','productCounter','productSectionTitle',
    'productDetailSection','profileCustomerName','profileSegment','profileSegmentText','profileCategoryText','avatarCircle',
    'purchasedProducts','cartItems','cartSummary','promoTrack','promoDots','prevSlideBtn','nextSlideBtn',
    'recommendationModal','closeRecommendationModal','modalTitle','modalSubtitle','recommendationList','toast'
  ].forEach(id => dom[id] = document.getElementById(id));
  dom.spotlightButtons = Array.from(document.querySelectorAll('.spotlight'));
}

function bindStaticEvents() {
  dom.loginBtn.addEventListener('click', () => loginByName(dom.customerNameInput.value));
  dom.customerNameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') loginByName(dom.customerNameInput.value);
  });
  dom.sampleNames.addEventListener('click', event => {
    const button = event.target.closest('[data-sample-name]');
    if (!button) return;
    dom.customerNameInput.value = button.dataset.sampleName;
    loginByName(button.dataset.sampleName);
  });
  dom.applyConfigBtn.addEventListener('click', async () => {
    state.config = readConfigInputs();
    saveConfig(state.config);
    await loadAllData(true);
  });
  dom.productSearchInput.addEventListener('input', event => {
    state.searchTerm = normalizeText(event.target.value);
    renderSidebarProducts();
    renderProductGrid();
  });
  dom.clearSearchBtn.addEventListener('click', () => {
    state.searchTerm = '';
    dom.productSearchInput.value = '';
    renderSidebarProducts();
    renderProductGrid();
  });
  dom.logoutBtn.addEventListener('click', logout);
  dom.sidebarFilters.addEventListener('click', event => {
    const button = event.target.closest('.sidebar-filter');
    if (!button) return;
    state.selectedCategory = button.dataset.category;
    renderSidebarFilters();
    renderSidebarProducts();
    renderProductGrid();
  });
  dom.sidebarProductList.addEventListener('click', event => {
    const button = event.target.closest('[data-product-name]');
    if (!button) return;
    const product = state.productMap[button.dataset.productName];
    if (product) showProductDetail(product);
  });
  dom.productGrid.addEventListener('click', handleProductAction);
  dom.productDetailSection.addEventListener('click', handleDetailAction);
  dom.recommendationList.addEventListener('click', handleRecommendationAction);
  dom.cartButton.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
  dom.spotlightButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.activeSpotlight = button.dataset.spotlight;
      dom.spotlightButtons.forEach(btn => btn.classList.toggle('active', btn === button));
      state.activeSlide = dom.spotlightButtons.findIndex(btn => btn.dataset.spotlight === state.activeSpotlight);
      updateCarouselPosition();
      renderHeroText();
      renderProductGrid();
    });
  });
  dom.prevSlideBtn.addEventListener('click', () => changeSlide(-1));
  dom.nextSlideBtn.addEventListener('click', () => changeSlide(1));
  dom.promoDots.addEventListener('click', event => {
    const button = event.target.closest('[data-slide-index]');
    if (!button) return;
    setActiveSlide(Number(button.dataset.slideIndex), true);
  });
  dom.closeRecommendationModal.addEventListener('click', closeModal);
  document.querySelector('#recommendationModal .modal-backdrop').addEventListener('click', closeModal);
}

function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    ruleFiles: { ...base.ruleFiles, ...(override.ruleFiles || {}) },
    bannerSlides: override.bannerSlides || base.bannerSlides
  };
}

function saveConfig(config) {
  localStorage.setItem('retail-demo-config', JSON.stringify(config));
}

function loadSavedConfig() {
  try {
    const raw = localStorage.getItem('retail-demo-config');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function fillConfigInputs() {
  dom.cfgTransactionsCsv.value = state.config.transactionsCsv || '';
  dom.cfgRfmCsv.value = state.config.rfmCsv || '';
  dom.cfgImagesJson.value = state.config.imagesJson || '';
  dom.cfgRuleAbout.value = state.config.ruleFiles['About to Sleep'] || '';
  dom.cfgRuleChampion.value = state.config.ruleFiles['Champion'] || '';
  dom.cfgRuleHibernating.value = state.config.ruleFiles['Hibernating'] || '';
  dom.cfgRuleLoyal.value = state.config.ruleFiles['Loyal'] || '';
}

function readConfigInputs() {
  return mergeConfig(DEFAULT_CONFIG, {
    transactionsCsv: dom.cfgTransactionsCsv.value.trim(),
    rfmCsv: dom.cfgRfmCsv.value.trim(),
    imagesJson: dom.cfgImagesJson.value.trim(),
    ruleFiles: {
      'About to Sleep': dom.cfgRuleAbout.value.trim(),
      'Champion': dom.cfgRuleChampion.value.trim(),
      'Hibernating': dom.cfgRuleHibernating.value.trim(),
      'Loyal': dom.cfgRuleLoyal.value.trim()
    }
  });
}

async function loadAllData(showToast = false) {
  try {
    showLoading('Đang đọc data_2024.csv, RFM_moi.csv, images.json và 4 file luật kết hợp...');
    dom.loadingView.classList.remove('hidden');
    dom.loginView.classList.add('hidden');
    dom.storeView.classList.add('hidden');

    const [transactions, rfm, images, rulesBySegment] = await Promise.all([
      parseCsv(state.config.transactionsCsv),
      parseCsv(state.config.rfmCsv),
      loadImages(state.config.imagesJson),
      loadRules()
    ]);

    buildStoreData(transactions, rfm, images, rulesBySegment);
    renderSampleNames();
    renderSidebarFilters();
    renderSidebarProducts();
    renderUtilityPills();
    applyLoginSceneBackground();
    dom.loadingView.classList.add('hidden');
    dom.loginView.classList.remove('hidden');

    restoreSession();
    if (showToast) showToastMessage('Đã nạp lại dữ liệu theo đường dẫn mới.');
  } catch (error) {
    console.error(error);
    showLoading('Không nạp được dữ liệu. Kiểm tra lại đường dẫn file trong phần “Đổi đường dẫn file dữ liệu”.');
    dom.loginView.classList.add('hidden');
    dom.storeView.classList.add('hidden');
    dom.loadingView.classList.remove('hidden');
  }
}

function showLoading(message) {
  dom.loadingText.textContent = message;
}

async function parseCsv(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: result => {
        if (result.errors && result.errors.length) {
          console.warn('CSV parse warnings:', path, result.errors.slice(0, 3));
        }
        resolve(result.data || []);
      },
      error: reject
    });
  });
}

async function loadImages(path) {
  if (!path) return {};
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return {};
    const data = await response.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

async function loadRules() {
  const entries = await Promise.all(
    Object.entries(state.config.ruleFiles).map(async ([segment, path]) => {
      const rows = path ? await parseExcel(path) : [];
      return [segment, rows.map(normalizeRule).filter(Boolean)];
    })
  );
  return Object.fromEntries(entries);
}

async function parseExcel(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Không đọc được file Excel: ${path}`);
  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  return rows;
}

function normalizeRule(row) {
  const antecedent = cleanText(row.antecedent || row.Antecedent || row.antecedents || row.ANTECEDENT);
  const consequent = cleanText(row.consequent || row.Consequent || row.consequents || row.CONSEQUENT);
  if (!antecedent || !consequent) return null;
  return {
    antecedent,
    consequent,
    support: Number(row.support || row.Support || 0) || 0,
    confidence: Number(row.confidence || row.Confidence || 0) || 0,
    lift: Number(row.lift || row.Lift || 0) || 0,
    segment: segmentKey(row.Segment || row.segment || '')
  };
}

function buildStoreData(transactions, rfmRows, images, rulesBySegment) {
  state.images = images;
  state.rulesBySegment = rulesBySegment;
  state.currentCustomer = null;
  state.cart = {};
  state.selectedProduct = null;
  state.searchTerm = '';
  state.selectedCategory = 'all';
  state.activeSpotlight = 'for-you';

  const rfmMap = new Map();
  rfmRows.forEach(row => {
    const key = normalizeText(row.Customer_Name);
    if (!key || rfmMap.has(key)) return;
    rfmMap.set(key, {
      segment: segmentKey(row.RFM_Segment_Name || row.Segment || ''),
      category: cleanText(row.Customer_Category),
      recency: Number(row.Recency || 0) || 0,
      frequency: Number(row.Frequency || 0) || 0,
      monetary: Number(row.MonetaryValue || row.Total_Cost || 0) || 0
    });
  });

  const customerMap = new Map();
  const productCount = new Map();
  transactions.forEach(row => {
    const key = normalizeText(row.Customer_Name);
    if (!key) return;
    const products = parseProductList(row.Product);
    if (!products.length) return;

    let customer = customerMap.get(key);
    if (!customer) {
      const rfm = rfmMap.get(key) || {};
      customer = {
        key,
        name: cleanText(row.Customer_Name),
        segment: rfm.segment || 'About to Sleep',
        category: cleanText(row.Customer_Category) || rfm.category || 'Unknown',
        city: cleanText(row.City),
        storeType: cleanText(row.Store_Type),
        purchases: {},
        transactions: [],
        totals: { spend: 0, orders: 0 }
      };
      customerMap.set(key, customer);
    }

    customer.totals.spend += Number(row.Total_Cost || 0) || 0;
    customer.totals.orders += 1;
    customer.transactions.push({
      transactionId: row.Transaction_ID,
      date: row.Date,
      totalCost: Number(row.Total_Cost || 0) || 0,
      items: products
    });

    products.forEach(productName => {
      customer.purchases[productName] = (customer.purchases[productName] || 0) + 1;
      productCount.set(productName, (productCount.get(productName) || 0) + 1);
    });
  });

  state.customers = Object.fromEntries(Array.from(customerMap.entries()).map(([key, customer]) => [key, customer]));
  state.samples = Array.from(customerMap.values()).slice(0, 16).map(customer => customer.name);

  state.products = Array.from(productCount.entries()).map(([name, pop]) => ({
    name,
    popularity: pop,
    category: classifyProductCategory(name),
    description: ''
  })).sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name, 'vi'));

  state.products = state.products.map(product => ({
    ...product,
    description: getProductDescription(product)
  }));

  state.productMap = Object.fromEntries(state.products.map(product => [product.name, product]));
}

function parseProductList(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  const matches = [...text.matchAll(/'([^']+)'/g)].map(match => cleanText(match[1]));
  if (matches.length) return matches;
  return text.split(',').map(cleanText).filter(Boolean);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function segmentKey(segment) {
  const normalized = normalizeText(segment);
  if (normalized === 'about to sleep') return 'About to Sleep';
  if (normalized === 'hibernating') return 'Hibernating';
  if (normalized === 'loyal') return 'Loyal';
  if (normalized === 'champion') return 'Champion';
  if (!normalized) return 'About to Sleep';
  return cleanText(segment);
}

function buildSet(values) {
  return new Set(values.map(normalizeText));
}

const BABY_PRODUCTS = buildSet(['Baby Wipes', 'Diapers']);
const PERSONAL_PRODUCTS = buildSet(['Toothpaste', 'Deodorant', 'Feminine Hygiene Products', 'Soap', 'Insect Repellent', 'Shaving Cream', 'Hand Sanitizer', 'Razors', 'Shower Gel', 'Hair Gel', 'Shampoo', 'Toothbrush']);
const DRINK_PRODUCTS = buildSet(['Water', 'Coffee', 'Tea', 'Soda', 'Milk']);
const PAPER_PRODUCTS = buildSet(['Toilet Paper', 'Paper Towels', 'Tissues', 'Trash Bags', 'Bath Towels']);
const CLEANING_PRODUCTS = buildSet(['Sponges', 'Laundry Detergent', 'Cleaning Spray', 'Mop', 'Vacuum Cleaner', 'Dish Soap', 'Cleaning Rags', 'Air Freshener', 'Broom', 'Dustpan']);
const GARDEN_PRODUCTS = buildSet(['Garden Hose', 'Plant Fertilizer', 'Lawn Mower']);
const HOME_PRODUCTS = buildSet(['Iron', 'Ironing Board', 'Extension Cords', 'Light Bulbs', 'Power Strips', 'Dishware', 'Trash Cans']);

function classifyProductCategory(productName) {
  const normalized = normalizeText(productName);
  if (BABY_PRODUCTS.has(normalized)) return 'Mẹ & bé';
  if (PERSONAL_PRODUCTS.has(normalized)) return 'Chăm sóc cá nhân';
  if (DRINK_PRODUCTS.has(normalized)) return 'Đồ uống';
  if (PAPER_PRODUCTS.has(normalized)) return 'Giấy & tiện ích';
  if (CLEANING_PRODUCTS.has(normalized)) return 'Vệ sinh nhà cửa';
  if (GARDEN_PRODUCTS.has(normalized)) return 'Sân vườn';
  if (HOME_PRODUCTS.has(normalized)) return 'Gia dụng';
  return 'Thực phẩm';
}

function getProductDescription(product) {
  const templates = {
    'Thực phẩm': `Sản phẩm ${product.name} thuộc nhóm thực phẩm, xuất hiện ${product.popularity.toLocaleString('vi-VN')} lần trong dữ liệu giao dịch 2024.`,
    'Đồ uống': `${product.name} thuộc nhóm đồ uống, phù hợp để minh hoạ trải nghiệm tìm kiếm nhanh và gợi ý theo phân khúc.`,
    'Chăm sóc cá nhân': `${product.name} là sản phẩm chăm sóc cá nhân xuất hiện ${product.popularity.toLocaleString('vi-VN')} lượt trong bộ dữ liệu.`,
    'Mẹ & bé': `${product.name} thuộc nhóm mẹ & bé, có thể gắn ảnh thật qua file images.json.`,
    'Vệ sinh nhà cửa': `${product.name} là sản phẩm vệ sinh nhà cửa, phù hợp để mô phỏng hành vi mua kèm.`,
    'Giấy & tiện ích': `${product.name} thuộc nhóm giấy và tiện ích gia đình, thường phù hợp với đề xuất mua thêm.`,
    'Sân vườn': `${product.name} thuộc nhóm sân vườn và được gán nhãn riêng để lọc nhanh trong sidebar.`,
    'Gia dụng': `${product.name} nằm trong nhóm gia dụng, dùng để minh hoạ phần xem chi tiết, thêm vào giỏ hàng và mua ngay.`
  };
  return templates[product.category] || `${product.name} là một sản phẩm trong bộ dữ liệu demo.`;
}

function renderSampleNames() {
  dom.sampleNames.innerHTML = state.samples.map(name => `
    <button type="button" class="sample-chip" data-sample-name="${escapeHtml(name)}">${escapeHtml(name)}</button>
  `).join('');
}

function renderUtilityPills() {
  const pills = [
    state.config.transactionsCsv,
    state.config.rfmCsv,
    state.config.imagesJson,
    ...Object.values(state.config.ruleFiles)
  ].filter(Boolean);
  dom.utilityRight.innerHTML = pills.map(path => `<span class="utility-pill">${escapeHtml(path.split('/').pop() || path)}</span>`).join('');
}

function applyLoginSceneBackground() {
  const firstBg = (state.config.bannerSlides || []).find(slide => slide.background)?.background || '';
  dom.loginScene.style.setProperty('--scene-bg', firstBg ? `url("${firstBg}")` : 'none');
}

function loginByName(rawName) {
  const normalized = normalizeText(rawName);
  if (!normalized) {
    showLoginMessage('Vui lòng nhập tên khách hàng.', 'error');
    return;
  }
  const customer = state.customers[normalized];
  if (!customer) {
    const suggestions = Object.values(state.customers)
      .filter(item => normalizeText(item.name).includes(normalized))
      .slice(0, 5)
      .map(item => item.name);
    const msg = suggestions.length
      ? `Không tìm thấy đúng tên. Gợi ý gần đúng: ${suggestions.join(', ')}`
      : 'Không tìm thấy khách hàng trong data_2024.csv';
    showLoginMessage(msg, 'error');
    return;
  }

  state.currentCustomer = customer;
  state.cart = {};
  state.selectedCategory = 'all';
  state.searchTerm = '';
  state.selectedProduct = null;
  state.activeSpotlight = 'for-you';
  localStorage.setItem('retail-demo-session', JSON.stringify({ customerKey: normalized }));
  openStore();
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem('retail-demo-session') || 'null');
    if (session?.customerKey && state.customers[session.customerKey]) {
      state.currentCustomer = state.customers[session.customerKey];
      openStore();
      return;
    }
  } catch {}
  dom.customerNameInput.value = '';
  showLoginMessage('Dữ liệu đã sẵn sàng. Hãy nhập tên khách hàng để bắt đầu.', 'normal');
}

function openStore() {
  dom.loginView.classList.add('hidden');
  dom.storeView.classList.remove('hidden');
  dom.productSearchInput.value = '';
  renderSidebarFilters();
  bindProfile();
  renderSidebarProducts();
  renderHeroText();
  renderPromoCarousel();
  renderProductGrid();
  renderPurchasedProducts();
  renderCart();
  dom.productDetailSection.classList.add('hidden');
  dom.productDetailSection.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function logout() {
  state.currentCustomer = null;
  state.cart = {};
  state.selectedProduct = null;
  localStorage.removeItem('retail-demo-session');
  stopCarouselTimer();
  dom.storeView.classList.add('hidden');
  dom.loginView.classList.remove('hidden');
  dom.customerNameInput.focus();
}

function bindProfile() {
  const customer = state.currentCustomer;
  if (!customer) return;
  const initials = customer.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  dom.headerCustomerName.textContent = customer.name;
  dom.headerCustomerSegment.textContent = customer.segment;
  dom.welcomeCustomerName.textContent = customer.name.toUpperCase();
  dom.profileCustomerName.textContent = customer.name;
  dom.profileSegment.textContent = customer.segment;
  dom.profileSegmentText.textContent = customer.segment;
  dom.profileCategoryText.textContent = customer.category || '-';
  dom.avatarCircle.textContent = initials || 'KH';
}

function showLoginMessage(message, tone = 'normal') {
  dom.loginMessage.textContent = message;
  dom.loginMessage.className = `login-message ${tone}`;
}

function renderSidebarFilters() {
  const labels = {
    all: 'Tất cả',
    'Thực phẩm': 'Thực phẩm',
    'Đồ uống': 'Đồ uống',
    'Chăm sóc cá nhân': 'Chăm sóc cá nhân',
    'Mẹ & bé': 'Mẹ & bé',
    'Gia dụng': 'Gia dụng',
    'Vệ sinh nhà cửa': 'Vệ sinh nhà cửa',
    'Giấy & tiện ích': 'Giấy & tiện ích',
    'Sân vườn': 'Sân vườn'
  };
  dom.sidebarFilters.innerHTML = CATEGORY_ORDER.map(category => `
    <button class="sidebar-filter ${state.selectedCategory === category ? 'active' : ''}" data-category="${escapeHtml(category)}">
      ${escapeHtml(labels[category] || category)}
    </button>
  `).join('');
}

function renderSidebarProducts() {
  const filtered = getFilteredProducts();
  const grouped = groupBy(filtered.slice(0, 120), product => product.category);

  dom.sidebarProductList.innerHTML = Object.keys(grouped).map(category => `
    <div class="sidebar-group">
      <div class="sidebar-group-title">${escapeHtml(category)}</div>
      ${grouped[category].map(product => `
        <button class="sidebar-product-item" data-product-name="${escapeHtml(product.name)}" type="button">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${product.popularity.toLocaleString('vi-VN')} lượt xuất hiện</span>
          </div>
          <span>›</span>
        </button>
      `).join('')}
    </div>
  `).join('') || `<div class="empty-state">Không có sản phẩm phù hợp với bộ lọc hiện tại.</div>`;
}

function renderHeroText() {
  const customer = state.currentCustomer;
  if (!customer) return;

  const purchased = getPurchasedProducts(customer);
  const topPurchased = purchased.slice(0, 3).map(item => item.name).join(', ') || 'chưa có dữ liệu';
  const titles = {
    'for-you': 'Gợi ý sản phẩm theo lịch sử mua và luật kết hợp',
    'top': 'Top sản phẩm bán chạy từ dữ liệu 2024',
    'segment': `Gợi ý theo phân khúc ${customer.segment}`,
    'rules': `Những luật kết hợp mạnh cho phân khúc ${customer.segment}`
  };
  const descriptions = {
    'for-you': `Khách hàng hiện thuộc phân khúc ${customer.segment}. Những sản phẩm mua nhiều gồm ${topPurchased}. Hãy bấm “Mua ngay” trên một sản phẩm để xem gợi ý phù hợp với luật kết hợp của phân khúc này.`,
    'top': 'Danh sách này ưu tiên những sản phẩm có tần suất xuất hiện cao nhất.',
    'segment': `Trang này ưu tiên các sản phẩm liên quan tới luật kết hợp của nhóm ${customer.segment}, giúp demo đề xuất bám sát RFM segment.`,
    'rules': `Trang này chọn các sản phẩm xuất hiện trong những luật có confidence và lift cao trong file luật của phân khúc ${customer.segment}.`
  };
  dom.heroTitle.textContent = titles[state.activeSpotlight];
  dom.heroRecommendationText.textContent = descriptions[state.activeSpotlight];
  dom.heroSegmentTag.textContent = customer.segment;
  dom.heroProductCount.textContent = `${purchased.length} sản phẩm đã mua`;
}

function getPurchasedProducts(customer) {
  return Object.entries(customer.purchases)
    .map(([name, qty]) => ({ name, qty, product: state.productMap[name] || fallbackProduct(name) }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'vi'));
}

function fallbackProduct(name) {
  return {
    name,
    popularity: 0,
    category: classifyProductCategory(name),
    description: `${name} là sản phẩm trong lịch sử mua của khách hàng.`
  };
}

function getFilteredProducts() {
  let products = getProductsForActiveSpotlight();
  if (state.selectedCategory !== 'all') {
    products = products.filter(product => product.category === state.selectedCategory);
  }
  if (state.searchTerm) {
    products = products.filter(product =>
      normalizeText(product.name).includes(state.searchTerm) ||
      normalizeText(product.category).includes(state.searchTerm)
    );
  }
  return products;
}

function getProductsForActiveSpotlight() {
  const customer = state.currentCustomer;
  if (!customer) return state.products;
  const purchasedNames = new Set(Object.keys(customer.purchases));
  const segmentRules = state.rulesBySegment[customer.segment] || [];
  const topRuleConsequents = unique(segmentRules
    .slice()
    .sort((a, b) => b.confidence - a.confidence || b.lift - a.lift)
    .map(rule => rule.consequent)
  );

  switch (state.activeSpotlight) {
    case 'top':
      return state.products.slice().sort((a, b) => b.popularity - a.popularity);
    case 'segment':
      return topRuleConsequents
        .map(name => state.productMap[name] || fallbackProduct(name))
        .filter(Boolean)
        .concat(state.products.filter(product => product.category === dominantCategory(customer)))
        .filter((product, index, arr) => arr.findIndex(item => item.name === product.name) === index);
    case 'rules':
      return unique(segmentRules
        .slice()
        .sort((a, b) => b.lift - a.lift || b.confidence - a.confidence)
        .flatMap(rule => [rule.antecedent, rule.consequent]))
        .map(name => state.productMap[name] || fallbackProduct(name));
    default: {
      const personalized = state.products
        .filter(product => purchasedNames.has(product.name))
        .concat(
          segmentRules
            .filter(rule => purchasedNames.has(rule.antecedent))
            .map(rule => state.productMap[rule.consequent] || fallbackProduct(rule.consequent))
        )
        .concat(state.products.filter(product => product.category === dominantCategory(customer)))
        .filter((product, index, arr) => arr.findIndex(item => item.name === product.name) === index);

      return personalized.concat(state.products).filter((product, index, arr) =>
        arr.findIndex(item => item.name === product.name) === index
      );
    }
  }
}

function dominantCategory(customer) {
  const counts = {};
  getPurchasedProducts(customer).forEach(item => {
    const category = (state.productMap[item.name] || fallbackProduct(item.name)).category;
    counts[category] = (counts[category] || 0) + item.qty;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Thực phẩm';
}

function renderProductGrid() {
  const products = getFilteredProducts();
  dom.productCounter.textContent = `${products.length.toLocaleString('vi-VN')} sản phẩm hiển thị`;
  dom.productGrid.innerHTML = products.slice(0, 80).map(product => renderProductCard(product)).join('') ||
    `<div class="empty-state">Không tìm thấy sản phẩm phù hợp.</div>`;
}

function renderProductCard(product) {
  const image = resolveProductImage(product.name, product.category, 'small');
  return `
    <article class="product-card">
      <button class="product-thumb" type="button" data-action="view" data-product-name="${escapeHtml(product.name)}">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />
      </button>
      <div class="product-meta">
        <span class="product-category-pill">${escapeHtml(product.category)}</span>
        <span class="product-popularity">${product.popularity.toLocaleString('vi-VN')} lượt</span>
      </div>
      <h4 class="product-name">${escapeHtml(product.name)}</h4>
      <p class="product-desc">${escapeHtml(product.description)}</p>
      <div class="product-actions">
        <button class="add-btn" type="button" data-action="add" data-product-name="${escapeHtml(product.name)}">Thêm vào giỏ hàng</button>
        <button class="buy-btn" type="button" data-action="buy" data-product-name="${escapeHtml(product.name)}">Mua ngay</button>
      </div>
    </article>
  `;
}

function showProductDetail(product) {
  state.selectedProduct = product.name;
  const image = resolveProductImage(product.name, product.category, 'large');
  dom.productDetailSection.innerHTML = `
    <div class="detail-layout">
      <div class="detail-media"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" /></div>
      <div>
        <div class="detail-top">
          <h3 class="detail-title">${escapeHtml(product.name)}</h3>
          <span class="product-category-pill">${escapeHtml(product.category)}</span>
        </div>
        <p class="detail-copy">${escapeHtml(product.description)}</p>
        <p class="detail-copy">Sản phẩm này xuất hiện ${product.popularity.toLocaleString('vi-VN')} lần trong data_2024.csv. Bạn có thể thêm vào giỏ hàng hoặc bấm “Mua ngay” để xem đề xuất theo luật kết hợp đúng với phân khúc hiện tại.</p>
        <div class="detail-actions">
          <button class="add-btn" type="button" data-action="add" data-product-name="${escapeHtml(product.name)}">Thêm vào giỏ hàng</button>
          <button class="buy-btn" type="button" data-action="buy" data-product-name="${escapeHtml(product.name)}">Mua ngay</button>
        </div>
        <button class="back-link" type="button" data-action="back">← Quay lại danh sách sản phẩm</button>
      </div>
    </div>
  `;
  dom.productDetailSection.classList.remove('hidden');
  dom.productDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleProductAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const productName = button.dataset.productName;
  if (!productName) return;
  const product = state.productMap[productName] || fallbackProduct(productName);
  if (action === 'view') showProductDetail(product);
  if (action === 'add') addToCart(productName);
  if (action === 'buy') showRecommendations(productName);
}

function handleDetailAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const productName = button.dataset.productName;
  if (action === 'back') {
    dom.productDetailSection.classList.add('hidden');
    return;
  }
  if (action === 'add') addToCart(productName);
  if (action === 'buy') showRecommendations(productName);
}

function addToCart(productName) {
  state.cart[productName] = (state.cart[productName] || 0) + 1;
  renderCart();
  showToastMessage(`Đã thêm ${productName} vào giỏ hàng.`);
}

function renderCart() {
  const entries = Object.entries(state.cart);
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);
  dom.cartCount.textContent = totalCount;
  dom.cartSummary.textContent = `${totalCount} sản phẩm`;
  dom.cartItems.innerHTML = entries.length ? entries.map(([name, qty]) => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${escapeHtml(name)}</div>
        <div class="cart-item-qty">Số lượng: ${qty}</div>
      </div>
      <strong>${qty}</strong>
    </div>
  `).join('') : `<div class="empty-state">Chưa có sản phẩm nào trong giỏ hàng.</div>`;
}

function renderPurchasedProducts() {
  const customer = state.currentCustomer;
  const purchased = getPurchasedProducts(customer);
  dom.purchasedProducts.innerHTML = purchased.length ? purchased.map(item => `
    <span class="purchase-chip">${escapeHtml(item.name)} <span class="qty">${item.qty}</span></span>
  `).join('') : `<div class="empty-state">Chưa có lịch sử mua.</div>`;
}

function showRecommendations(productName) {
  const customer = state.currentCustomer;
  const segment = customer.segment;
  const rules = (state.rulesBySegment[segment] || []).filter(rule => normalizeText(rule.antecedent) === normalizeText(productName));
  const fallback = (state.rulesBySegment[segment] || [])
    .filter(rule => normalizeText(rule.consequent) === normalizeText(productName));

  const matches = (rules.length ? rules : fallback)
    .slice()
    .sort((a, b) => b.confidence - a.confidence || b.lift - a.lift || b.support - a.support)
    .slice(0, 8);

  dom.modalTitle.textContent = `Gợi ý mua tiếp cho "${productName}"`;
  dom.modalSubtitle.textContent = `Áp dụng luật kết hợp của phân khúc ${segment}. Dưới đây là các sản phẩm nên mua tiếp khi khách hàng bấm “Mua ngay”.`;

  if (!matches.length) {
    dom.recommendationList.innerHTML = `<div class="empty-state">Chưa có luật kết hợp phù hợp với sản phẩm ${escapeHtml(productName)} trong phân khúc ${escapeHtml(segment)}.</div>`;
  } else {
    dom.recommendationList.innerHTML = matches.map(rule => {
      const recommendedName = normalizeText(rule.antecedent) === normalizeText(productName) ? rule.consequent : rule.antecedent;
      const product = state.productMap[recommendedName] || fallbackProduct(recommendedName);
      const image = resolveProductImage(product.name, product.category, 'small');
      return `
        <article class="reco-product-card">
          <button class="reco-thumb" type="button" data-reco-action="view" data-product-name="${escapeHtml(product.name)}">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />
          </button>
          <div class="reco-topline">
            <span class="product-category-pill reco-category-pill">${escapeHtml(product.category)}</span>
            <span class="reco-segment-label">Gợi ý cho ${escapeHtml(segment)}</span>
          </div>
          <h4 class="reco-product-name">${escapeHtml(product.name)}</h4>
          <div class="reco-stats-grid">
            <div class="reco-stat-box"><strong>${(rule.confidence * 100).toFixed(1)}%</strong><span>Confidence</span></div>
            <div class="reco-stat-box"><strong>${(rule.support * 100).toFixed(2)}%</strong><span>Support</span></div>
            <div class="reco-stat-box"><strong>${rule.lift.toFixed(2)}</strong><span>Lift</span></div>
          </div>
          <div class="reco-actions">
            <button class="add-btn" type="button" data-reco-action="add" data-product-name="${escapeHtml(product.name)}">Thêm vào giỏ</button>
            <button class="secondary-btn" type="button" data-reco-action="view" data-product-name="${escapeHtml(product.name)}">Xem chi tiết</button>
          </div>
        </article>
      `;
    }).join('');
  }
  dom.recommendationModal.classList.remove('hidden');
}

function closeModal() {
  dom.recommendationModal.classList.add('hidden');
}

function handleRecommendationAction(event) {
  const button = event.target.closest('[data-reco-action]');
  if (!button) return;
  const action = button.dataset.recoAction;
  const productName = button.dataset.productName;
  if (!productName) return;
  const product = state.productMap[productName] || fallbackProduct(productName);
  if (action === 'add') {
    addToCart(productName);
    return;
  }
  if (action === 'view') {
    closeModal();
    showProductDetail(product);
  }
}

function renderPromoCarousel() {
  const slides = buildSlides();
  dom.promoTrack.innerHTML = slides.map(slide => `
    <article class="carousel-slide ${slide.background ? 'has-bg' : ''} ${slide.align === 'right' ? 'align-right' : ''}" style="${slide.background ? `--slide-bg:url('${slide.background.replace(/'/g, "\\'")}')` : ''}">
      <div class="carousel-slide-content">
        <span class="slide-tag">${escapeHtml(slide.tag)}</span>
        <h3>${escapeHtml(slide.title)}</h3>
        <p>${escapeHtml(slide.subtitle)}</p>
      </div>
    </article>
  `).join('');
  dom.promoDots.innerHTML = slides.map((_, index) => `
    <button class="carousel-dot ${index === state.activeSlide ? 'active' : ''}" type="button" data-slide-index="${index}" aria-label="Slide ${index + 1}"></button>
  `).join('');
  setActiveSlide(state.activeSlide || 0, false);
  startCarouselTimer();
}

function buildSlides() {
  const customer = state.currentCustomer;
  const baseSlides = (state.config.bannerSlides || []).length ? state.config.bannerSlides : [];
  const purchased = getPurchasedProducts(customer).slice(0, 3).map(item => item.name).join(', ');
  const topProducts = state.products.slice(0, 3).map(item => item.name).join(', ');
  const segmentRules = (state.rulesBySegment[customer.segment] || []).slice(0, 3).map(rule => `${rule.antecedent} → ${rule.consequent}`).join(' • ');

  return [
    {
      tag: baseSlides[0]?.tag || 'Dành cho bạn',
      title: baseSlides[0]?.title || 'Ưu tiên theo lịch sử mua của bạn',
      subtitle: baseSlides[0]?.subtitle || `Tập trung vào những nhóm sản phẩm mà ${customer.name} đã quan tâm như ${purchased || 'chưa có dữ liệu'} để gợi ý mua tiếp.`,
      background: baseSlides[0]?.background || '',
      align: baseSlides[0]?.align || 'left'
    },
    {
      tag: baseSlides[1]?.tag || 'Top bán chạy',
      title: baseSlides[1]?.title || 'Top bán chạy từ dữ liệu 2024',
      subtitle: baseSlides[1]?.subtitle || `Những sản phẩm nổi bật toàn hệ thống hiện gồm ${topProducts}. Bạn có thể thay ảnh nền slide này bằng link JPG trong cấu hình.`,
      background: baseSlides[1]?.background || '',
      align: baseSlides[1]?.align || 'left'
    },
    {
      tag: baseSlides[2]?.tag || 'RFM segment',
      title: baseSlides[2]?.title || `Khách hàng thuộc nhóm ${customer.segment}`,
      subtitle: baseSlides[2]?.subtitle || `Các đề xuất sẽ dùng riêng file luật của phân khúc ${customer.segment}, giúp kết quả sát với hành vi mua hơn.`,
      background: baseSlides[2]?.background || '',
      align: baseSlides[2]?.align || 'left'
    },
    {
      tag: baseSlides[3]?.tag || 'Association rules',
      title: baseSlides[3]?.title || 'Luật kết hợp mạnh để mua ngay',
      subtitle: baseSlides[3]?.subtitle || `${segmentRules || 'Bấm “Mua ngay” ở sản phẩm bất kỳ để xem luật kết hợp mạnh cho phân khúc hiện tại.'}`,
      background: baseSlides[3]?.background || '',
      align: baseSlides[3]?.align || 'left'
    }
  ];
}

function changeSlide(delta) {
  const slides = buildSlides();
  const nextIndex = (state.activeSlide + delta + slides.length) % slides.length;
  setActiveSlide(nextIndex, true);
}

function setActiveSlide(index, syncSpotlight) {
  const slides = buildSlides();
  state.activeSlide = ((index % slides.length) + slides.length) % slides.length;
  updateCarouselPosition();
  if (syncSpotlight) {
    const keys = ['for-you', 'top', 'segment', 'rules'];
    state.activeSpotlight = keys[state.activeSlide] || 'for-you';
    dom.spotlightButtons.forEach(button => button.classList.toggle('active', button.dataset.spotlight === state.activeSpotlight));
    renderHeroText();
    renderProductGrid();
  }
  startCarouselTimer();
}

function updateCarouselPosition() {
  dom.promoTrack.style.transform = `translateX(-${state.activeSlide * 100}%)`;
  Array.from(dom.promoDots.children).forEach((dot, index) => {
    dot.classList.toggle('active', index === state.activeSlide);
  });
}

function startCarouselTimer() {
  stopCarouselTimer();
  state.slideTimer = window.setInterval(() => changeSlide(1), 5000);
}

function stopCarouselTimer() {
  if (state.slideTimer) {
    clearInterval(state.slideTimer);
    state.slideTimer = null;
  }
}

function resolveProductImage(productName, category, size = 'large') {
  const configured = state.images[productName];
  if (typeof configured === 'string' && configured.trim()) return configured.trim();
  return createPlaceholderImage(productName, category, size);
}

function createPlaceholderImage(productName, category, size = 'large') {
  const palette = {
    'Thực phẩm': ['#fff4d7', '#fde7b3', '#c98a12'],
    'Đồ uống': ['#e4f3ff', '#cde9ff', '#3d81bc'],
    'Chăm sóc cá nhân': ['#dff8f2', '#b8eddc', '#1f8e75'],
    'Mẹ & bé': ['#f7e8ff', '#ead0ff', '#9153c8'],
    'Vệ sinh nhà cửa': ['#e4fbf6', '#c9f3ea', '#2e9980'],
    'Giấy & tiện ích': ['#f3efe5', '#ebe3cf', '#9f7b39'],
    'Sân vườn': ['#edf9e6', '#d5f0c3', '#5e9b3a'],
    'Gia dụng': ['#e8f7e7', '#d3f1d1', '#4f9958']
  };
  const [bg1, bg2, accent] = palette[category] || palette['Gia dụng'];
  const initials = productName.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase();
  const fontSize = size === 'small' ? 20 : 30;
  const width = size === 'small' ? 420 : 900;
  const height = size === 'small' ? 320 : 620;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs>
      <rect x="8" y="8" rx="32" width="${width - 16}" height="${height - 16}" fill="url(#g)" />
      <circle cx="${width * 0.72}" cy="${height * 0.22}" r="${size === 'small' ? 44 : 82}" fill="${accent}" opacity="0.12"/>
      <circle cx="${width * 0.2}" cy="${height * 0.78}" r="${size === 'small' ? 28 : 52}" fill="#fff" opacity="0.34"/>
      <rect x="${width * 0.24}" y="${height * 0.18}" rx="20" width="${width * 0.52}" height="${height * 0.46}" fill="#fff" opacity="0.96"/>
      <rect x="${width * 0.33}" y="${height * 0.1}" rx="14" width="${width * 0.34}" height="${height * 0.1}" fill="#fff" opacity="0.96"/>
      <text x="50%" y="${height * 0.46}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="${accent}">${initials}</text>
      <text x="50%" y="${height * 0.84}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size === 'small' ? 14 : 24}" font-weight="700" fill="#51655a">${escapeHtml(productName).slice(0, 22)}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let toastTimer = null;
function showToastMessage(message) {
  dom.toast.textContent = message;
  dom.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), 2600);
}
