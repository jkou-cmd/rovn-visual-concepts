/* Rōvn subpage chrome: logo sprite, nav and footer, written in place by the script tag that calls them.
   One source for every subpage, so a new page only carries its own modules.
     <script>RovnChrome.nav('organizations')</script>   right after <body>
     <script>RovnChrome.close([...doors])</script>     last thing in <main> */
(function () {
  // Pages that exist. Anything not listed links to "#" and is marked as coming later.
  const ROUTES = {
    home: 'home.html',
    organizations: 'organizations.html',
    guide: 'next-role-guide.html',
    workflow: 'workflow.html',
    roi: 'roi-calculator.html',
  };
  const BUILT = new Set(['home', 'organizations']);
  const href = (k) => (BUILT.has(k) ? ROUTES[k] : '#');
  const soon = (k) => (BUILT.has(k) ? '' : ' data-soon');

  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="rovn-mark" viewBox="0 0 23.8727 23.9612"><path fill="currentColor" d="M4.29024 8.79812C4.96552 8.51314 5.71421 8.97746 6.3063 9.3165C7.55655 10.1223 8.86796 10.8593 10.3604 10.9281C13.0689 11.0608 16.1811 9.9921 18.5519 8.8276C18.9703 8.61387 19.3935 8.36328 19.7434 8.0611C21.1869 6.78359 20.1349 5.96794 18.5568 5.90898C17.0252 5.84756 15.4911 5.8623 13.9595 5.90898C11.2951 6.08341 8.6233 6.38559 5.98089 6.80324C4.84564 6.99732 3.69326 7.12999 2.57268 7.39286C0.693639 7.79085 0.0844177 8.50577 0.0281443 10.4982C0.0403777 11.5571 -0.260563 13.4561 0.855119 13.977C1.77751 14.3848 3.78378 13.8025 4.67192 13.3185C6.73936 12.1098 4.90925 11.2917 4.15323 10.056C3.90612 9.67027 3.79846 9.0438 4.28046 8.80058L4.2878 8.79566L4.29024 8.79812Z"/><path fill="currentColor" d="M1.46189 4.23108C1.9659 4.56274 2.82958 4.51852 3.50731 4.52589C4.10185 4.51852 4.71107 4.50869 5.31539 4.49641C7.76207 4.49641 10.2063 4.30969 12.6432 4.14018C14.6005 4.02962 16.5578 3.96575 18.5127 4.06893C20.1398 4.12544 22.2757 4.68558 22.4152 6.6043C22.6378 11.3655 10.7862 11.4441 12.3887 15.5149C12.7264 16.3085 13.4237 16.962 14.0353 17.5712C15.4299 18.9175 16.8417 20.2368 18.2901 21.5168C19.2296 22.3644 20.4921 23.1235 21.62 22.1432C24.4019 19.3548 23.8269 14.1883 23.8171 10.1936C23.7657 7.78108 23.9443 5.00004 22.3467 3.02236C19.3544 -0.677512 11.8358 -0.0191024 6.9987 0.162697C6.30385 0.2364 5.5356 0.405915 4.83585 0.673701C3.68347 1.11346 2.57268 1.821 1.79953 2.67841C1.36158 3.16976 0.940748 3.86748 1.4521 4.22616L1.45944 4.23108H1.46189Z"/><path fill="currentColor" d="M4.85542 16.844C4.38077 15.9056 3.30423 16.1316 2.45768 16.4682C1.53529 16.8465 0.556621 17.5295 0.559068 18.6203C0.468541 19.7332 2.21057 23.2414 3.6223 21.9811C4.04557 21.5929 4.30737 21.0353 4.5398 20.4653C4.95329 19.3598 5.36433 17.952 4.86276 16.8539L4.85542 16.8416V16.844Z"/><path fill="currentColor" d="M16.9885 23.3986C16.9811 22.7083 15.9388 21.814 15.3051 21.1262C14.7718 20.5881 14.2506 20.0526 13.7026 19.4777C12.3104 18.07 10.0326 15.3724 8.03365 17.2592C7.06721 18.2051 6.54852 19.6496 6.06163 20.9886C5.85366 21.6789 5.28359 22.9687 5.90015 23.5141C6.13258 23.718 6.5265 23.8237 7.05742 23.8728C8.38841 23.9637 9.92248 23.9514 11.3562 23.9612C12.7166 23.9612 13.9448 23.9539 15.1608 23.9367C15.6868 23.9219 16.9297 23.949 16.986 23.4085V23.4011L16.9885 23.3986Z"/></symbol>
<symbol id="rovn-word" viewBox="0 0 65.5174 22.9845"><path fill="currentColor" d="M0.0415929 22.434C0.134566 21.9844 0.663046 21.5717 0.94686 21.2032C1.28939 20.8076 1.22578 20.6971 1.23312 20.2721C1.23312 19.3729 1.23312 18.5057 1.23312 17.5819C1.21355 12.4743 1.27227 3.72831 1.2111 1.90049C1.03983 1.3944 0.0440401 0.627893 0 0.222529C0 -0.1337 0.966436 0.0579264 1.53406 0.00633466C3.47917 0.00633466 6.73568 0.00633466 8.12539 0.00633466C11.0125 -0.0477139 14.6213 0.389588 16.2263 3.12887C17.8069 6.01309 16.8086 9.82105 13.6867 11.1723C13.3246 11.3492 12.8279 11.5015 12.4854 11.6317C12.248 11.725 12.1086 11.8086 12.111 11.9019C12.1184 12.0862 12.6248 12.2876 12.8377 12.4203C15.4874 13.8084 15.8667 17.0365 16.7939 19.6014C17.0655 20.4907 17.227 20.8936 17.7971 21.3678C18.1151 21.6896 18.7072 22.0115 18.81 22.4438C18.7978 22.5839 18.5433 22.6355 18.1347 22.6576C17.3934 22.6797 16.4685 22.6772 15.7076 22.6625C14.9394 22.692 14.8366 22.2301 14.6629 21.5791C14.2421 20.105 13.8163 18.5351 13.3857 17.0832C12.6958 14.7247 11.2938 12.6463 8.61717 12.3884C7.36692 12.2188 5.82307 12.268 4.46762 12.2803C3.69202 12.2999 3.73607 12.5137 3.74341 13.4153C3.74341 15.3537 3.74096 19.0044 3.74585 20.3138C3.70426 20.9526 4.22051 21.3629 4.62176 21.8149C5.32395 22.5593 4.9961 22.6625 4.14221 22.6699C3.26875 22.6748 1.87904 22.6699 0.986008 22.6699C0.430614 22.6625 0.0685068 22.6355 0.0440401 22.4537V22.434H0.0415929ZM3.97094 10.5998C4.79058 10.7423 7.00237 10.6244 7.88072 10.6613C9.39521 10.676 11.032 10.5753 12.3386 9.71787C14.4574 8.45019 14.8219 5.13112 13.283 3.28855C11.6388 1.53198 9.45883 1.61305 7.11002 1.60814C6.26592 1.61059 4.85175 1.60077 4.32571 1.61305C4.11285 1.62533 3.88287 1.63025 3.86574 1.86855C3.82659 3.04779 3.86574 6.29562 3.85351 8.61233C3.85351 9.40095 3.84861 10.0225 3.8584 10.3271C3.86574 10.4303 3.87308 10.5311 3.96116 10.59L3.97584 10.5974L3.97094 10.5998Z"/><path fill="currentColor" d="M26.3335 22.9843C19.84 23.0064 16.8673 15.7811 19.429 10.3714C22.4555 4.0698 31.6868 4.81911 33.7812 11.4523C35.5379 16.7712 32.3499 23.0212 26.3873 22.9843H26.336H26.3335ZM26.3849 21.5692C31.3785 21.3924 32.893 14.8672 31.1632 10.9782C29.1912 6.26122 23.3877 6.28579 21.5625 11.0838C19.9648 14.9311 21.3692 21.4341 26.336 21.5668H26.3849V21.5692ZM22.6953 1.76537C24.2979 1.7236 26.9647 1.76537 28.467 1.75063C29.2206 1.79976 29.5362 1.65236 30.0573 1.27156C30.2482 1.14381 30.5344 1.0136 30.6812 1.24454C30.9063 1.62042 31.0385 2.69648 31.0776 3.29592C31.0752 3.56125 30.9797 3.61776 30.7546 3.62759C29.568 3.63741 24.7897 3.62759 23.3657 3.6325C23.055 3.62267 22.825 3.70129 22.5607 3.89291C22.2843 4.08208 21.9613 4.35724 21.8316 4.22458C21.7387 4.09928 21.7729 3.91257 21.7851 3.75042C21.9099 3.0871 21.9344 1.98402 22.6684 1.77274L22.6978 1.76782L22.6953 1.76537Z"/><path fill="currentColor" d="M40.6881 22.6207C40.4508 22.574 40.3676 22.4905 40.2918 22.2964C39.6067 20.4956 35.7385 10.2584 35.0559 8.4551C34.8675 7.84337 33.7078 7.10143 33.6662 6.59288C33.8032 6.21946 34.8479 6.39634 35.7972 6.35212C36.311 6.35704 36.8836 6.33247 37.3753 6.38406C38.2928 6.43074 37.5295 7.46749 37.4292 7.90725C37.3655 8.12344 37.3753 8.2733 37.4414 8.46984C37.8867 9.6933 39.6238 14.3955 40.7224 17.378C41.1872 18.5253 41.6228 20.1026 41.7402 19.8716C42.6797 17.351 45.3123 9.90458 45.831 8.4723C46.0121 7.9834 45.6744 7.58541 45.5056 7.08915C45.4151 6.83856 45.3882 6.61745 45.5399 6.50198C45.8897 6.29807 46.3987 6.36932 46.8121 6.34967C47.529 6.3988 48.9628 6.1998 49.0044 6.61991C48.904 7.1432 47.8544 7.83846 47.6562 8.45019C46.91 10.3394 43.081 20.331 42.2467 22.3947C41.9824 22.7804 41.1726 22.6551 40.715 22.6232L40.6857 22.6183L40.6881 22.6207Z"/><path fill="currentColor" d="M50.2791 22.4365C50.2326 22.0115 51.0253 21.3015 51.1109 20.7954C51.1795 18.8668 51.1207 10.8848 51.1354 9.00296C51.2186 8.31998 50.0564 7.48223 50.3623 6.91963C50.7244 6.55112 51.4877 6.55112 52.2046 6.39389C52.7527 6.3079 53.4084 6.16295 53.4206 6.92946C53.472 7.51417 53.4035 8.67621 53.4891 9.03981C53.5356 9.32725 53.7093 9.16019 53.8292 9.0005C54.365 8.23891 54.9816 7.49451 55.7939 6.99088C57.8271 5.66178 60.8903 5.76496 62.7522 7.28569C64.5921 8.73271 64.7095 11.0691 64.641 13.2286C64.641 15.3193 64.641 19.0486 64.641 20.3605C64.5848 21.0288 65.1181 21.5324 65.4191 22.0753C65.5218 22.2694 65.5585 22.4365 65.4582 22.5323C65.2918 22.7657 63.8997 22.6748 63.1045 22.6944C62.74 22.6478 61.3821 22.859 61.4604 22.3161C61.5631 21.9058 61.9203 21.5447 62.1136 21.1688C62.3363 20.7757 62.302 20.4883 62.3045 19.8692C62.3045 17.7637 62.3045 13.9189 62.3045 12.4817C62.3094 11.8233 62.2751 11.1772 62.1112 10.5261C61.7001 8.44036 59.4443 7.48223 57.5065 7.95392C55.7449 8.32489 54.4286 9.74981 53.8243 11.3737C53.5478 12.0592 53.4279 12.6414 53.4426 13.3539C53.4426 14.6928 53.4426 17.835 53.4426 19.5817C53.45 20.2672 53.3815 20.8101 53.6897 21.2572C53.861 21.557 54.1081 21.8567 54.2451 22.1687C54.6023 22.9475 52.8261 22.6207 51.9453 22.692C51.4657 22.6821 50.9421 22.7239 50.4944 22.6183C50.3794 22.5839 50.3109 22.5323 50.2889 22.4561L50.284 22.434L50.2791 22.4365Z"/></symbol>
<symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m12 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="menu" viewBox="0 0 18 18"><path d="M2 6h14M2 12h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
</svg>`;

  // Home's nav, word for word (home.html), so every page starts the same way.
  const NAV_LINKS = [
    ['clinicians', 'For clinicians'],
    ['organizations', 'For organizations'],
    ['about', 'About us'],
  ];

  function nav(active) {
    const links = NAV_LINKS.map(([k, l]) =>
      `<a class="nav__cell" href="${href(k)}"${soon(k)}${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('');
    const html = `${SPRITE}
<header class="nav" data-intro>
  <nav class="nav__bar" aria-label="Primary">
    <a class="nav__cell nav__logo logo" href="${ROUTES.home}" aria-label="Rōvn home">
      <svg class="logo__mark" aria-hidden="true"><use href="#rovn-mark"/></svg>
      <svg class="logo__word" aria-hidden="true"><use href="#rovn-word"/></svg>
    </a>
    <div class="nav__links">${links}</div>
    <span class="nav__spacer" aria-hidden="true"></span>
    <a class="nav__cell nav__contact" href="#"${soon('contact')}>Contact us</a>
    <a class="nav__cell nav__cta" href="#"${soon('waitlist')}><span>Join the waitlist</span><svg class="arrow" aria-hidden="true"><use href="#arrow"/></svg></a>
    <button class="nav__cell nav__menu" type="button" aria-label="Menu" aria-expanded="false"><svg aria-hidden="true"><use href="#menu"/></svg></button>
  </nav>
  <div class="nav__sheet" hidden>
    ${NAV_LINKS.map(([k, l]) => `<a href="${href(k)}"${soon(k)}>${l}</a>`).join('')}
    <a href="#"${soon('contact')}>Contact us</a>
  </div>
</header>`;
    document.currentScript.insertAdjacentHTML('beforebegin', html);
  }

  // Home's close (section 9): two doors, the ink footer and the wordmark band. Only the doors change per page:
  //   RovnChrome.close([{ label, title, cta, img, pos, href }, { … }])   — this page's audience first
  const FOOT = [
    ['Product', [['clinicians', 'For clinicians'], ['organizations', 'For organizations'], ['lab', 'Lab']]],
    ['Company', [['about', 'About'], ['careers', 'Careers'], ['contact', 'Contact']]],
    ['Trust', [['privacy', 'Privacy policy'], ['terms', 'Terms of service']]],
  ];

  function close(doors) {
    const door = (d) => `<a class="cdoor" href="${d.href || '#'}"${d.href ? '' : ' data-soon'}>
          <span class="cdoor__img" style="background-image:url(${d.img}); --pos: ${d.pos || '50%'}" aria-hidden="true"></span>
          <span class="door__shade" aria-hidden="true"></span>
          <span class="cdoor__body">
            <span class="door__text"><span class="door__label">${d.label}</span><span class="door__title">${d.title}</span></span>
            <span class="pbtn pbtn--paper cdoor__cta"><span class="pbtn__label">${d.cta}</span><span class="pbtn__chip"><svg class="arrow" aria-hidden="true"><use href="#arrow"/></svg></span></span>
          </span>
        </a>`;
    const cols = FOOT.map(([h, ls], i) => `<div class="foot__col">
            <p class="foot__head" id="foot-h${i}">${h}</p>
            <ul class="foot__list" aria-labelledby="foot-h${i}">${ls.map(([k, l]) => `<li><a class="foot__link" href="${href(k)}"${soon(k)}>${l}</a></li>`).join('')}</ul>
          </div>`).join('');
    const mark = '<svg class="band__m"><use href="#rovn-mark"/></svg><svg class="band__w"><use href="#rovn-word"/></svg>';
    const html = `<section class="close" id="close" aria-label="Get started with Rōvn">
      <div class="close__sheet">
        <div class="close__doors">${doors.map(door).join('')}</div>
        <footer class="foot" role="contentinfo">
          <div class="foot__brand">
            <span class="foot__logo" role="img" aria-label="Rōvn"><svg class="foot__mark" aria-hidden="true"><use href="#rovn-mark"/></svg><svg class="foot__word" aria-hidden="true"><use href="#rovn-word"/></svg></span>
            <p class="foot__tag">Less runaround. More career.</p>
            <p class="foot__copy">© 2026 Rōvn</p>
          </div>
          <nav class="foot__links" aria-label="Footer">${cols}</nav>
        </footer>
      </div>
      <div class="band" aria-hidden="true">
        <span class="band__photo"><span class="band__img" style="background-image:url(home/media/amber-mountains.jpg)"></span><span class="band__shade"></span></span>
        <span class="band__mark band__glow">${mark}</span>
        <span class="band__mark">${mark}</span>
        <span class="band__fade"></span>
      </div>
    </section>`;
    document.currentScript.insertAdjacentHTML('beforebegin', html);
  }

  window.RovnChrome = { nav, close, ROUTES };
})();
