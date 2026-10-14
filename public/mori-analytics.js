/* Mori Lab: consent-based, page-only analytics. No form values or URL queries. */
(() => {
  'use strict';
  if (window.__moriAnalytics) return;
  window.__moriAnalytics = true;
  const id = 'G-7C3C8EJW43';
  const key = 'mori-analytics-consent-v1';
  const host = location.hostname;
  const path = location.pathname;
  const appPages = ["apps.html", "notepad.html", "intuition-game.html", "forest-observatory.html", "waterlight.html", "kururi.html", "toitoyohaku.html"];
  const group = host === 'mori-lab-games.kazutumu0.chatgpt.site' ? 'games'
    : host === 'kazutumu.github.io' && path.startsWith('/kaigow-diary/') ? 'blog'
    : host === 'kazutumu.github.io' && path.startsWith('/mina-series-site/') ? 'mina'
    : host === 'kazutumu.github.io' && path.startsWith('/mori-lab-site/')
      ? (appPages.includes(path.split('/').pop()) ? 'apps' : 'mori') : '';
  if (!group) return;
  const privacy = group === 'games' ? '/analytics-privacy.html'
    : '/' + path.split('/')[1] + '/analytics-privacy.html';
  let choice = '';
  try { choice = localStorage.getItem(key) || ''; } catch (_) {}
  let started = false;
  let previousPath = '';
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  function cleanReferrer() {
    try { return new URL(document.referrer).origin + '/'; } catch (_) { return ''; }
  }
  function pageview() {
    if (!started || choice !== 'granted' || previousPath === location.pathname) return;
    previousPath = location.pathname;
    const pageGroup = group === 'mori' || group === 'apps'
      ? (appPages.includes(location.pathname.split('/').pop()) ? 'apps' : 'mori') : group;
    const details = {page_location: location.origin + location.pathname,
      page_referrer: cleanReferrer(), page_title: document.title,
      content_group: pageGroup};
    gtag('set', details);
    gtag('event', 'page_view', Object.assign({send_to: id}, details));
  }
  function start() {
    if (started || choice !== 'granted') return;
    started = true;
    gtag('consent', 'default', {analytics_storage:'granted', ad_storage:'denied',
      ad_user_data:'denied', ad_personalization:'denied'});
    gtag('js', new Date());
    gtag('config', id, {send_page_view:false, allow_google_signals:false,
      allow_ad_personalization_signals:false,
      campaign_id:'', campaign_name:'', campaign_source:'', campaign_medium:'', campaign_term:'', campaign_content:'',
      page_location:location.origin + location.pathname,
      page_referrer:cleanReferrer(), cookie_expires:60*60*24*90,
      cookie_flags:'SameSite=Lax;Secure'});
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    tag.referrerPolicy = 'origin';
    document.head.appendChild(tag);
    pageview();
    // Only path transitions count; hashes, query changes and game actions do not.
    for (const method of ['pushState','replaceState']) {
      const original = history[method];
      history[method] = function() {
        const result = original.apply(this, arguments);
        setTimeout(pageview, 0);
        return result;
      };
    }
    addEventListener('popstate', () => setTimeout(pageview, 0));
  }
  function save(value) {
    choice = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    if (value === 'denied') {
      window['ga-disable-' + id] = true;
      // Remove first-party GA cookies on this host when consent is withdrawn.
      for (const item of document.cookie.split(';')) {
        const name = item.trim().split('=')[0];
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ['', '; domain=' + host, '; domain=.' + host]) {
          document.cookie = name + '=; Max-Age=0; path=/' + domain;
        }
      }
    }
    panel.hidden = true;
    if (value === 'granted') {
      window['ga-disable-' + id] = false;
      if (started) location.reload(); else start();
    }
  }
  const style = document.createElement('style');
  style.textContent = '.mori-analytics-panel{position:fixed;bottom:16px;left:16px;right:16px;max-width:620px;margin:auto;z-index:9999;background:#fff;color:#18392d;border:1px solid #759585;border-radius:12px;padding:16px;box-shadow:0 4px 24px #0002;font:14px/1.6 system-ui,sans-serif}.mori-analytics-panel[hidden]{display:none}.mori-analytics-panel p{margin:0 0 10px}.mori-analytics-panel button,.mori-analytics-settings{font:inherit;cursor:pointer;padding:8px 12px;margin:4px;border:1px solid #4b705d;border-radius:6px;background:#fff;color:#18392d}.mori-analytics-panel a{color:#245b43;text-decoration:underline}.mori-analytics-footer{padding:12px;text-align:center;font:13px/1.6 system-ui,sans-serif;background:#f3f6f3;color:#18392d}.mori-analytics-footer a{color:#245b43}';
  document.head.appendChild(style);
  const footer = document.createElement('div');
  footer.className = 'mori-analytics-footer';
  const link = document.createElement('a'); link.href = privacy; link.textContent = 'このサイトのアクセス解析・プライバシー';
  const settings = document.createElement('button'); settings.type='button'; settings.className='mori-analytics-settings'; settings.textContent='アクセス解析の設定';
  footer.append(link, settings); document.body.appendChild(footer);
  const panel = document.createElement('section'); panel.className='mori-analytics-panel'; panel.setAttribute('aria-label','アクセス解析の設定');
  panel.innerHTML='<p>サイト改善のため、同意いただいた場合にGoogle Analyticsで閲覧ページ・端末などを集計します。フォームの入力内容、URLの検索文字列・ハッシュは送信しません。拒否してもサイトを利用できます。</p>';
  const yes=document.createElement('button'); yes.type='button'; yes.textContent='解析を許可'; yes.onclick=()=>save('granted');
  const no=document.createElement('button'); no.type='button'; no.textContent='解析を拒否'; no.onclick=()=>save('denied');
  const more=link.cloneNode(true); panel.append(yes,no,more); document.body.appendChild(panel);
  panel.hidden=choice==='granted'||choice==='denied';
  settings.onclick=()=>{panel.hidden=false; no.focus();};
  start();
})();
