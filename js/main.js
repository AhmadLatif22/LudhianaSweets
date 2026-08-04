/* ==========================================================================
   main.js — shared header behavior + scroll-reveal animations
   Include on every page, after cart.js.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Sticky header background on scroll
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    onScroll();
  }

  // Mobile nav toggle
  const menuToggle = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");
  menuToggle?.addEventListener("click", () => {
    mobileNav?.classList.toggle("open");
    const expanded = mobileNav?.classList.contains("open");
    menuToggle.setAttribute("aria-expanded", String(!!expanded));
  });

  // Scroll-reveal (fade-up) for elements with .reveal, and ribbon dividers
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "-40px" }
  );
  document.querySelectorAll(".reveal, .ribbon-divider").forEach((el) => observer.observe(el));

  // Stagger reveal delay for elements grouped in a grid (feature cards etc.)
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => {
      child.classList.add("reveal");
      child.style.transitionDelay = `${i * 0.1}s`;
      observer.observe(child);
    });
  });
});
