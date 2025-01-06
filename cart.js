const scriptUrl = new URL(document.currentScript.getAttribute('src'));
const urlParams = Object.fromEntries(scriptUrl.searchParams);

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
  const color = urlParams?.color ?? 'green';
  const widgetStyle = urlParams?.widgetStyle ?? 'default';
  const withPopup = urlParams?.withPopup ?? true;
  const popupTheme = 'light';
  const isoCode = Shopify.locale;
  const locale = ['en', 'de'].includes(isoCode) ? isoCode : 'en';
  const initialCart = {
    items: [],
    currency: 'GBP',
    total_price: 0,
  };
  const shopUniqueName = Shopify.shop;
  const cartEl = document.querySelector('.drawer__footer');
  const gsWidgetTargetEl = document.querySelector('[data-greenspark-widget-target]');

  if (!gsWidgetTargetEl) {
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
    document.body.append(popup);
    popupHistory.push(popup);
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
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.onload = function () {
      resolve();
    };

    script.src = url;
    document.querySelector('head').appendChild(script);
  });
}

const packageUrl = 'https://cdn.getgreenspark.com/scripts/widgets%401.6.1-0-umd.js';

loadScript(packageUrl).then(runGreenspark);

(function (context, fetch) {
  if (typeof fetch !== 'function') return;

  context.fetch = function () {
    const response = fetch.apply(this, arguments);

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
