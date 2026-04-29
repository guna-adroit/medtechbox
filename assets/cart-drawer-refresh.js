window._cartRefresh = async function (){
    const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    const sections = cart.getSectionsToRender().map((section) => section.id);
    const sectionString = sections.join(',');
    const response = await fetch(`/?sections=${sectionString}`).then(res => res.json());
    const cartDrawer = document.querySelector('cart-drawer');
    const cartIconBubbleHtml = new DOMParser().parseFromString(response['cart-icon-bubble'], 'text/html').getElementById('shopify-section-cart-icon-bubble').innerHTML;
    const cartIconBubble = document.getElementById('cart-icon-bubble');
    const cartData = await fetch('/cart.js').then(res => res.json());
    if(cartDrawer){
        const cartDrawerHtml = new DOMParser().parseFromString(response['cart-drawer'], 'text/html').querySelector('cart-drawer').innerHTML;
        cartDrawer.classList.toggle('is-empty', cartData.item_count === 0);
        cartDrawer.innerHTML = cartDrawerHtml;
        cartDrawer.querySelector('#CartDrawer-Overlay').addEventListener('click', cartDrawer.close.bind(cartDrawer));
    }
    cartIconBubble.innerHTML = cartIconBubbleHtml;
}