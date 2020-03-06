(function() {
    let isFirefox = false;
    try {
        isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
    } catch (e) {}
    if (isFirefox) {
        // --- firefox's native implementation doesn't work well
        // --- force polyfill implementation
        window.__forceSmoothScrollPolyfill__ = true;
    }
    const smoothscroll = require("smoothscroll-polyfill");
    smoothscroll.polyfill();
})();
