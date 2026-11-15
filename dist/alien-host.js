/* Decorative, silent character animation. Independent of all sonification. */
(function () {
  'use strict';

  function initializeAlien() {
    const welcome = document.getElementById('welcomeScreen');
    const start = document.getElementById('welcomeStart');
    const surface = document.getElementById('appSurface');
    let welcomeDismissed = false;
    let dismissAnimation = null;

    if (welcome && start && surface) {
      welcome.hidden = false;
      surface.inert = true;
      surface.setAttribute('inert', '');
      surface.setAttribute('aria-hidden', 'true');
      document.body.classList.add('welcome-open');
      start.type = 'button';
      start.addEventListener('click', function () {
        if (welcomeDismissed) return;
        welcomeDismissed = true;
        if (dismissAnimation) dismissAnimation();
        surface.inert = false;
        surface.removeAttribute('inert');
        surface.removeAttribute('aria-hidden');
        document.body.classList.remove('welcome-open');
        welcome.hidden = true;
        const theme = document.querySelector('meta[name="theme-color"]');
        if (theme) theme.setAttribute('content', '#eee3f5');
        if (typeof window.scrollTo === 'function') {
          try { window.scrollTo({top:0, left:0, behavior:'instant'}); }
          catch (_) { window.scrollTo(0, 0); }
        }
        const title = document.getElementById('title');
        if (title && typeof title.focus === 'function') {
          try { title.focus({preventScroll:true}); } catch (_) { title.focus(); }
        }
      });
    }

    const video = document.getElementById('alienVideo');
    const button = document.getElementById('alienMotion');
    const icon = document.getElementById('alienMotionIcon');
    const label = document.getElementById('alienMotionLabel');
    if (!video || !button || !icon || !label) return;

    const preference = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const sources = Array.from(video.querySelectorAll('source'));
    const failedSources = new Set();
    let userPlayback = null;
    let resumeAfterVisibility = false;
    let pending = false;
    let request = 0;
    let failed = false;
    let posterMode = false;

    const poster = document.createElement('img');
    poster.className = 'alien-video alien-poster';
    poster.alt = '';
    poster.setAttribute('aria-hidden', 'true');
    poster.width = video.width || 512;
    poster.height = video.height || 752;
    poster.src = video.poster || 'assets/alien/poster.jpg';
    poster.hidden = true;
    video.insertAdjacentElement('afterend', poster);

    const status = document.createElement('span');
    status.id = 'alienMotionStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    button.insertAdjacentElement('afterend', status);
    button.type = 'button';
    button.setAttribute('aria-controls', video.id);
    const description = button.getAttribute('aria-describedby');
    button.setAttribute('aria-describedby', (description ? description + ' ' : '') + status.id);

    function keepSilent() {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
    }

    function reducedMotion() { return Boolean(preference && preference.matches); }
    function playing() { return !video.paused && !video.ended && !failed; }
    function wantsPlayback() {
      return !welcomeDismissed && !failed && userPlayback !== false && (userPlayback === true || !reducedMotion());
    }

    function updateButton() {
      const active = playing();
      const text = active ? 'Pausar animación' : 'Reproducir animación';
      icon.textContent = active ? 'Ⅱ' : '▶';
      icon.setAttribute('aria-hidden', 'true');
      label.textContent = text;
      button.setAttribute('aria-label', text);
      button.setAttribute('aria-pressed', String(active));
      button.title = text;
      button.disabled = failed;
      button.hidden = failed;
    }

    function showPoster(show) {
      posterMode = Boolean(show);
      poster.hidden = !posterMode;
      video.hidden = posterMode;
    }

    function resetFrame() {
      try { video.currentTime = 0; } catch (_) { /* Metadata may not exist yet. */ }
    }

    function pauseAnimation(reset) {
      request++;
      pending = false;
      if (typeof video.pause === 'function') video.pause();
      if (reset) { resetFrame(); showPoster(true); }
      updateButton();
    }

    async function playAnimation() {
      if (failed || document.hidden || !wantsPlayback()) { updateButton(); return; }
      const token = ++request;
      pending = true;
      keepSilent();
      showPoster(false);
      try {
        await video.play();
        if (token !== request) return;
        pending = false;
        status.textContent = '';
        if (document.hidden || !wantsPlayback()) pauseAnimation(reducedMotion() && userPlayback !== true);
        else updateButton();
      } catch (_) {
        if (token !== request) return;
        pending = false;
        video.pause();
        showPoster(true);
        status.textContent = 'Animación en pausa. Puedes reproducirla con el botón.';
        updateButton();
      }
    }

    function animationUnavailable() {
      if (failed) return;
      failed = true;
      resumeAfterVisibility = false;
      video.autoplay = false;
      pauseAnimation(true);
      status.textContent = 'La animación no está disponible. Se muestra la imagen del personaje.';
      updateButton();
    }

    dismissAnimation = function () {
      userPlayback = false;
      resumeAfterVisibility = false;
      video.autoplay = false;
      video.removeAttribute('autoplay');
      if (typeof video.pause === 'function') pauseAnimation(false);
      else { request++; pending = false; updateButton(); }
    };

    keepSilent();
    video.addEventListener('volumechange', function () {
      if (!video.muted || !video.defaultMuted || video.volume !== 0) keepSilent();
    });
    video.addEventListener('play', function () {
      keepSilent();
      if (document.hidden || !wantsPlayback()) pauseAnimation(reducedMotion() && userPlayback !== true);
      else { showPoster(false); updateButton(); }
    });
    video.addEventListener('playing', updateButton);
    video.addEventListener('pause', updateButton);
    video.addEventListener('ended', updateButton);
    video.addEventListener('loadedmetadata', function () { if (posterMode) resetFrame(); });
    video.addEventListener('error', animationUnavailable);
    sources.forEach(function (source) {
      source.addEventListener('error', function () {
        failedSources.add(source);
        if (failedSources.size === sources.length) animationUnavailable();
      });
    });

    button.addEventListener('click', function () {
      if (failed || welcomeDismissed) return;
      if (playing() || pending) {
        userPlayback = false;
        resumeAfterVisibility = false;
        pauseAnimation(reducedMotion());
      } else {
        userPlayback = true;
        playAnimation();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        resumeAfterVisibility = (playing() || pending) && wantsPlayback();
        pauseAnimation(false);
      } else {
        const resume = resumeAfterVisibility && wantsPlayback();
        resumeAfterVisibility = false;
        if (resume) playAnimation();
        else updateButton();
      }
    });

    function preferenceChanged() {
      video.autoplay = wantsPlayback();
      if (!wantsPlayback()) {
        resumeAfterVisibility = false;
        pauseAnimation(reducedMotion());
      } else if (!document.hidden) playAnimation();
      else updateButton();
    }
    if (preference) {
      if (typeof preference.addEventListener === 'function') preference.addEventListener('change', preferenceChanged);
      else if (typeof preference.addListener === 'function') preference.addListener(preferenceChanged);
    }

    if (typeof video.play !== 'function' || typeof video.pause !== 'function' || video.error) {
      failed = true;
      showPoster(true);
      status.textContent = 'La animación no está disponible. Se muestra la imagen del personaje.';
      updateButton();
      return;
    }
    video.autoplay = wantsPlayback();
    if (reducedMotion()) pauseAnimation(true);
    else if (!document.hidden) playAnimation();
    else {
      // Defer the initial autoplay until this tab is visible. Later explicit
      // pauses still clear this intent in the button handler above.
      resumeAfterVisibility = wantsPlayback();
      video.pause();
      updateButton();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeAlien, {once:true});
  else initializeAlien();
})();
