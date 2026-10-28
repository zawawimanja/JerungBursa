// Jerung Bursa Donation visibility helper.
// Self-contained: injects styles and elements so <script src="donate-banner.js">
// works on any page. It adds:
//   1) A permanent "♥ Donate" button in the navigation bar (.nav-links-bar or .nav-links).
//   2) A top announcement bar above the header — visible on arrival, dismissible,
//      hidden for 30 days after closing (localStorage).
(function () {
    'use strict';

    var STORAGE_KEY = 'jerungDonateBannerDismissedAt';
    var HIDE_DAYS = 30; // days to keep the bar hidden after closing

    if (window.location.search.indexOf('nodonate=1') !== -1) return;
    if (document.documentElement.getAttribute('data-donate') === 'off') return;

    function readDismissedAt() {
        try { return Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (e) { return 0; }
    }
    function persist(ts) {
        try { localStorage.setItem(STORAGE_KEY, String(ts)); } catch (e) { /* private mode */ }
    }

    var isNested = /\/articles\//.test(window.location.pathname);
    var donateHref = isNested ? '../donate.html' : 'donate.html';

    var STYLE_ID = 'jerung-donate-style';
    if (!document.getElementById(STYLE_ID)) {
        var css = document.createElement('style');
        css.id = STYLE_ID;
        css.textContent = [
            '.jerung-donate-top{position:relative;z-index:9999;display:flex;align-items:center;',
            'justify-content:center;gap:.9rem;flex-wrap:wrap;padding:.6rem 3rem .6rem 1.1rem;',
            'background:linear-gradient(135deg,#be185d,#db2777);color:#fff;',
            'font-family:Inter,system-ui,-apple-system,sans-serif;font-size:.88rem;text-align:center;}',
            '.jerung-donate-top a.jd-link{color:#fff;font-weight:700;text-decoration:none;white-space:nowrap;',
            'border:1px solid rgba(255,255,255,.55);border-radius:.55rem;padding:.28rem .75rem;',
            'background:rgba(255,255,255,.14);transition:background .2s ease;}',
            '.jerung-donate-top a.jd-link:hover{background:rgba(255,255,255,.28);}',
            '.jerung-donate-top button.jd-close{position:absolute;right:.6rem;top:50%;transform:translateY(-50%);',
            'background:transparent;border:none;color:rgba(255,255,255,.85);font-size:1.35rem;line-height:1;',
            'cursor:pointer;padding:.2rem .4rem;border-radius:.4rem;}',
            '.jerung-donate-top button.jd-close:hover{color:#fff;background:rgba(255,255,255,.15);}',
            '@media(max-width:560px){.jerung-donate-top{gap:.5rem;padding-right:2.4rem;font-size:.8rem;}}',
            '.jerung-donate-nav{background:linear-gradient(135deg,#db2777,#ec4899) !important;',
            'border:1px solid rgba(236,72,153,.5) !important;color:#fff !important;',
            'box-shadow:0 4px 15px rgba(236,72,153,.3) !important;font-weight:700 !important;}'
        ].join('');
        document.head.appendChild(css);
    }

    function addNavButton() {
        // Try .nav-links-bar first (main dashboard index.html), then .nav-links (other pages)
        var nav = document.querySelector('.nav-links-bar') || document.querySelector('.nav-links');
        if (!nav || nav.querySelector('.jerung-donate-nav')) return;

        var btn = document.createElement('a');
        btn.href = donateHref;
        btn.className = (nav.classList.contains('nav-links-bar') ? 'nav-btn ' : 'btn-nav ') + 'jerung-donate-nav';
        btn.innerHTML = '<span aria-hidden="true">&hearts;</span> <span>Donate</span>';
        nav.appendChild(btn);
    }

    function addTopBar() {
        var dismissedAt = readDismissedAt();
        if (dismissedAt) {
            if (HIDE_DAYS <= 0) return;
            if ((Date.now() - dismissedAt) / 86400000 < HIDE_DAYS) return;
        }

        var bar = document.createElement('div');
        bar.className = 'jerung-donate-top';
        bar.setAttribute('role', 'complementary');
        bar.setAttribute('aria-label', 'Support this project');

        var msg = document.createElement('span');
        msg.innerHTML = '<span aria-hidden="true">&hearts;</span> Jerung Bursa is free &amp; volunteer-run. '
            + 'A small donation keeps the scanners &amp; algorithms fresh.';

        var link = document.createElement('a');
        link.className = 'jd-link';
        link.href = donateHref;
        link.textContent = 'Support Us';

        var close = document.createElement('button');
        close.className = 'jd-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Dismiss');
        close.innerHTML = '&times;';

        bar.appendChild(msg);
        bar.appendChild(link);
        bar.appendChild(close);

        document.body.insertBefore(bar, document.body.firstChild);

        close.addEventListener('click', function () {
            persist(Date.now());
            if (bar.parentNode) bar.parentNode.removeChild(bar);
        });
    }

    function init() {
        addNavButton();
        addTopBar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
