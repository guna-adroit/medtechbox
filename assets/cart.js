// assets/cart.js
// class CartRemoveButton extends HTMLElement {
//   constructor() {
//     super();

//     this.addEventListener('click', (event) => {
//       event.preventDefault();
//       const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
//       cartItems.updateQuantity(this.dataset.index, 0, event);
//     });
//   }
// }

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();

      const isDrawer = this.closest('cart-drawer-items');

      // 👉 If inside cart drawer → use Dawn default behavior
      if (isDrawer) {
        const cartItems = this.closest('cart-drawer-items');
        cartItems.updateQuantity(this.dataset.index, 0, event);
        return;
      }

      // 👉 Cart page only → custom section rendering
      this.handleCartPageRemove();
      
    });
  }

  async handleCartPageRemove() {
      const cartItemsContainer = document.querySelector('cart-items');

      try {
        const line = this.dataset.index;
        cartItemsContainer?.classList.add('loading');

        // 1. Remove item
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line, quantity: 0 }),
        });
        const cartData = await response.json();

        // 2. Fetch the FULL cart page (guarantees blocks render correctly)
        const pageResponse = await fetch('/cart', {
          headers: { 'Accept': 'text/html' }
        });
        const pageHTML = await pageResponse.text();
        const pageDoc = new DOMParser().parseFromString(pageHTML, 'text/html');

        // 3. Replace cart-items
        const newCartItems = pageDoc.querySelector('cart-items');
        const currentCartItems = document.querySelector('cart-items');
        if (newCartItems && currentCartItems) {
          currentCartItems.replaceWith(newCartItems);
          this.reactivateScripts(newCartItems);
        }

        // 4. Replace footer — blocks will be populated this time
        const newFooter = pageDoc.querySelector('#main-cart-footer');
        const currentFooter = document.querySelector('#main-cart-footer');
        if (newFooter && currentFooter) {
          currentFooter.replaceWith(newFooter);
          this.reactivateScripts(newFooter);
        }

        // 5. Broadcast update
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cartData }));

      } catch (error) {
        console.error('Cart remove error:', error);
      } finally {
        document.querySelector('cart-items')?.classList.remove('loading');
      }
    }

    reactivateScripts(container) {
      container.querySelectorAll('script').forEach((oldScript) => {
        const newScript = document.createElement('script');
        [...oldScript.attributes].forEach((attr) =>
          newScript.setAttribute(attr.name, attr.value)
        );
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    }
}

// customElements.define('cart-remove-button', CartRemoveButton);

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
  // Check if vendor-grouped layout is active on cart page
  const isVendorGrouped = !!document.querySelector('.shipment');

  if (isVendorGrouped) {
    // Only re-render icon bubble — skip main-cart-items to preserve grouping
    return [
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
    ];
  }

  // Default Dawn behavior (drawer uses this path too)
  return [
    {
      id: 'main-cart-items',
      section: document.getElementById('main-cart-items').dataset.id,
      selector: '.js-contents',
    },
    {
      id: 'cart-icon-bubble',
      section: 'cart-icon-bubble',
      selector: '.shopify-section',
    },
    {
      id: 'cart-live-region-text',
      section: 'cart-live-region-text',
      selector: '.shopify-section',
    },
    {
      id: 'main-cart-footer',
      section: document.getElementById('main-cart-footer').dataset.id,
      selector: '.js-contents',
    },
  ];
}

  updateQuantity(line, quantity, event, name, variantId) {
  this.enableLoading(line);

  const isVendorGrouped = !!document.querySelector('.shipment');

  setTimeout(() => {
    const cartHeaderCount = document.getElementById('cart-header-count');
    if (cartHeaderCount) {
      const cartCountBubble = document.querySelector('#cart-icon-bubble .cart-count-bubble span');
      if (cartCountBubble) {
        cartHeaderCount.innerHTML = '(' + cartCountBubble.innerHTML + ')';
      }
    }
  }, 1250);

  const body = JSON.stringify({
    line,
    quantity,
    sections: this.getSectionsToRender().map((section) => section.section),
    sections_url: window.location.pathname,
  });

  const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';

  fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
    .then((response) => response.text())
    .then((state) => {
      const parsedState = JSON.parse(state);

      CartPerformance.measure(`${eventTarget}:paint-updated-sections"`, () => {
        const quantityElement =
          document.getElementById(`Quantity-${line}`) ||
          document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');
        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        if (isVendorGrouped) {
          // ── In-place update: don't re-render the full section ──────────

          const updatedItem = parsedState.items[line - 1];
          const row = document.getElementById(`CartItem-${line}`);

          if (row) {
            if (!updatedItem || updatedItem.quantity === 0) {
              // Remove the row if quantity hit 0
              row.remove();
            } else {
              // Update quantity input
              const qtyInput = row.querySelector('.quantity__input');
              if (qtyInput) qtyInput.setAttribute('value', updatedItem.quantity);

              // Update line price (the rightmost total column)
              const priceEl = row.querySelector('.price--end');
              if (priceEl) {
                priceEl.textContent = this.formatMoney(updatedItem.line_price);
              }
            }
          }

          // Update cart estimated total
          document.querySelectorAll('.totals__total-value').forEach((el) => {
            el.textContent = this.formatMoney(parsedState.total_price);
          });

          // Re-render only icon bubble and live region
          this.getSectionsToRender().forEach((section) => {
            const el =
              document.getElementById(section.id)?.querySelector(section.selector) ||
              document.getElementById(section.id);
            if (el && parsedState.sections?.[section.section]) {
              el.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector
              );
            }
          });

        } else {
          // ── Default Dawn section re-render (drawer / non-grouped) ──────
          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) ||
              document.getElementById(section.id);
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });
        }

        const updatedValue = parsedState.items[line - 1]
          ? parsedState.items[line - 1].quantity
          : undefined;
        let message = '';
        if (
          items.length === parsedState.items.length &&
          updatedValue !== parseInt(quantityElement?.value)
        ) {
          message =
            typeof updatedValue === 'undefined'
              ? window.cartStrings.error
              : window.cartStrings.quantityError.replace('[quantity]', updatedValue);
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.getElementById(`CartItem-${line}`) ||
          document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(
            cartDrawerWrapper.querySelector('.drawer__inner-empty'),
            cartDrawerWrapper.querySelector('a')
          );
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
        }
      });

      CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'cart-items',
        cartData: parsedState,
        variantId: variantId,
      });
    })
    .catch(() => {
      this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
      const errors =
        document.getElementById('cart-errors') ||
        document.getElementById('CartDrawer-CartErrors');
      errors.textContent = window.cartStrings.error;
    })
    .finally(() => {
      this.disableLoading(line);
    });
}

// Add this helper inside CartItems class
formatMoney(cents) {
  if (window.Shopify?.formatMoney) {
    return window.Shopify.formatMoney(
      cents,
      window.theme?.moneyFormat || window.Shopify.money_format || '${{amount}}'
    );
  }
  return '$' + (cents / 100).toFixed(2);
}

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);



if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then(() => CartPerformance.measureFromEvent('note-update:user-action', event));
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

// ─── Vendor-grouped cart page: in-place quantity update ──────────────────────
class VendorGroupedCartItems extends CartItems {
  
  getSectionsToRender() {
    // Keep cart-icon-bubble + live-region in sync, but skip main-cart-items
    // re-render so our vendor grouping layout is preserved.
    return [
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((s) => s.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((r) => r.text())
      .then((state) => {
        const parsedState = JSON.parse(state);

        if (parsedState.errors) {
          const quantityEl =
            document.getElementById(`Quantity-${line}`) ||
            document.getElementById(`Drawer-quantity-${line}`);
          if (quantityEl) quantityEl.value = quantityEl.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        // ── 1. Update the changed line item row in-place ──────────────────
        const updatedItem = parsedState.items[line - 1];
        const row =
          document.getElementById(`CartItem-${line}`) ||
          document.getElementById(`CartDrawer-Item-${line}`);

        if (row) {
          // Update quantity input value attribute (acts as "truth" for reset)
          const qtyInput = row.querySelector('.quantity__input');
          if (qtyInput) qtyInput.setAttribute('value', updatedItem ? updatedItem.quantity : 0);

          // Update line total
          const priceEl = row.querySelector('.price--end');
          if (priceEl && updatedItem) {
            priceEl.textContent = this.formatMoney(updatedItem.line_price);
          }
        }

        // ── 2. Remove row if quantity is 0 ────────────────────────────────
        if (!updatedItem || updatedItem.quantity === 0) {
          if (row) row.remove();
        }

        // ── 3. Update cart totals ─────────────────────────────────────────
        const totalEls = document.querySelectorAll('.totals__total-value');
        totalEls.forEach((el) => {
          el.textContent = this.formatMoney(parsedState.total_price);
        });

        // ── 4. Toggle empty state ─────────────────────────────────────────
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartFooter = document.getElementById('main-cart-footer');
        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);

        // ── 5. Refresh icon bubble + live region (section render) ─────────
        this.getSectionsToRender().forEach((section) => {
          const el =
            document.getElementById(section.id)?.querySelector(section.selector) ||
            document.getElementById(section.id);
          if (el && parsedState.sections?.[section.section]) {
            el.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          }
        });

        this.updateLiveRegions(line, '');

        // ── 6. Sync cart header count if present ─────────────────────────
        setTimeout(() => {
          const cartHeaderCount = document.getElementById('cart-header-count');
          const bubble = document.querySelector('#cart-icon-bubble .cart-count-bubble span');
          if (cartHeaderCount && bubble) {
            cartHeaderCount.innerHTML = `(${bubble.innerHTML})`;
          }
        }, 300);

        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: 'cart-items',
          cartData: parsedState,
          variantId,
        });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((el) => el.classList.add('hidden'));
        const errors =
          document.getElementById('cart-errors') ||
          document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  /**
   * Converts Shopify's integer price (cents) → formatted currency string.
   * Matches the store's money_with_currency format.
   */
  formatMoney(cents) {
    if (window.Shopify?.formatMoney) {
      return window.Shopify.formatMoney(cents, window.theme?.moneyFormat || '${{amount}}');
    }
    // Fallback
    return '$' + (cents / 100).toFixed(2);
  }
}

// Re-define cart-items ONLY on the cart page (not drawer)
if (document.getElementById('main-cart-items')) {
  // Unregister the generic cart-items custom element if already defined
  // (custom elements can't be redefined, so we scope by checking the page)
  // We use a flag to avoid double-registration
  if (!window._vendorGroupedCartDefined) {
    window._vendorGroupedCartDefined = true;
    customElements.define('vendor-grouped-cart-items', VendorGroupedCartItems);
  }
}


