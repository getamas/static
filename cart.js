const isDevStore = window.location.hostname.includes('greenspark-development-store');
const widgetUrl = isDevStore
  ? 'https://cdn.getgreenspark.com/scripts/widgets%401.6.1-0-umd.js'
  : 'https://cdn.getgreenspark.com/scripts/widgets%40latest.js';
const scriptSrc = document.currentScript?.getAttribute('src');
const popupHistory = [];

function parseCart(cart) {
  const lineItems = cart.items.map((item) => ({
    productId: item.product_id.toString(),
    quantity: item.quantity,
  }));
  const { currency } = cart;
  const totalPrice = cart.total_price;
  return {
    lineItems,
    currency,
    totalPrice,
  };
}

function runGreenspark() {
  if (!scriptSrc) {
    return;
  }

  const scriptUrl = new URL(scriptSrc);
  const urlParams = Object.fromEntries(scriptUrl.searchParams);
  const color = urlParams?.color ?? 'green';
  const widgetStyle = urlParams?.widgetStyle ?? 'default';
  const withPopup = urlParams?.withPopup === '1';
  const popupTheme = 'light';
  const isoCode = window.Shopify.locale;
  const locale = ['en', 'de'].includes(isoCode) ? isoCode : 'en';
  const initialCart = {
    items: [],
    currency: 'GBP',
    total_price: 0,
  };
  const shopUniqueName = window.Shopify.shop;
  const cartEl = document.querySelector('.cart__footer, .drawer__footer');
  const gsWidgetTargetEl = document.querySelector('[data-greenspark-widget-target]');

  if (cartEl && !gsWidgetTargetEl) {
    cartEl.insertAdjacentHTML('afterbegin', '<div data-greenspark-widget-target></div>');
  }

  const greenspark = new window.GreensparkWidgets({
    locale,
    integrationSlug: Shopify.designMode ? 'GS_PREVIEW' : shopUniqueName,
    isShopifyIntegration: Shopify.designMode ? false : true,
  });

  const widget = greenspark.cart({
    color,
    containerSelector: '[data-greenspark-widget-target]',
    useShadowDom: false,
    style: widgetStyle,
    withPopup,
    popupTheme,
    order: parseCart(initialCart),
    version: 'v2',
  });

  const movePopupToBody = () => {
    if (!withPopup) return;

    popupHistory.forEach((outdatedPopup) => {
      outdatedPopup.innerHTML = '';
      outdatedPopup.style.display = 'none';
    });

    const popup = document.querySelector('.gs-popup');
    if (popup) {
      document.body.append(popup);
      popupHistory.push(popup);
    }
  };

  fetch('/cart.js')
    .then((response) => response.json())
    .then((updatedCart) => {
      const order = parseCart(updatedCart);
      if (order.lineItems.length <= 0) return;

      widget
        .render({ order })
        .then(movePopupToBody)
        .catch((e) => {
          console.error('Greenspark Widget - ', e);
        });
    });
}

function loadScript(url) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.onload = function () {
      resolve();
    };

    script.src = url;
    const head = document.querySelector('head');

    if (head) {
      head.appendChild(script);
    }
  });
}

async function setup() {
  if (window.GreensparkWidgets) return;
  await loadScript(widgetUrl);
  window.dispatchEvent(new Event('greenspark-setup'));
}

setup().catch((e) => console.error('Greenspark Widget -', e));

if (!window.GreensparkWidgets) {
  window.addEventListener('greenspark-setup', runGreenspark, { once: true });
} else {
  runGreenspark();
}

(function (context, fetch) {
  if (typeof fetch !== 'function') return;

  context.fetch = function (...args) {
    const response = fetch.apply(this, args);

    response.then((res) => {
      if (
        [
          `${window.location.origin}/cart/add`,
          `${window.location.origin}/cart/update`,
          `${window.location.origin}/cart/change`,
          `${window.location.origin}/cart/clear`,
          `${window.location.origin}/cart/add.js`,
          `${window.location.origin}/cart/update.js`,
          `${window.location.origin}/cart/change.js`,
          `${window.location.origin}/cart/clear.js`,
        ].includes(res.url)
      ) {
        setTimeout(() => {
          runGreenspark();
        }, 100);
      }
    });

    return response;
  };
})(window, window.fetch);
