(function () {
  var STORAGE_KEY = "snacksmate_landing_lang";
  var COOKIE = "snacksmate_lang";

  function setLangPreference(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    var maxAge = 60 * 60 * 24 * 365;
    document.cookie = COOKIE + "=" + lang + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax";
  }

  var lang = document.documentElement.lang === "he" ? "he" : "en";
  setLangPreference(lang);

  document.querySelectorAll("[data-set-lang]").forEach(function (el) {
    el.addEventListener("click", function () {
      setLangPreference(el.getAttribute("data-set-lang"));
    });
  });

  window.smScroll = function (id, evt) {
    var el = document.getElementById(id);
    if (!el) return true;
    if (evt && evt.preventDefault) evt.preventDefault();
    var y = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - 88;
    try { window.scrollTo({ top: Math.max(0, y), behavior: "smooth" }); }
    catch (e1) { window.scrollTo(0, Math.max(0, y)); }
    return false;
  };

  document.querySelectorAll("[data-sm-scroll]").forEach(function (el) {
    el.addEventListener("click", function (evt) {
      window.smScroll(el.getAttribute("data-sm-scroll"), evt);
    });
  });

  var topbar = document.getElementById("topbar");
  function onScroll() {
    if (!topbar) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    topbar.classList.toggle("is-scrolled", y > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var nodes = document.querySelectorAll(".reveal, .problem-list li, .steps li, .effects-grid li");
  if (!("IntersectionObserver" in window)) {
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add("is-in");
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].style.transitionDelay = (j % 5) * 60 + "ms";
      io.observe(nodes[j]);
    }
  }
})();
