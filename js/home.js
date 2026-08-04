/* ==========================================================================
   home.js — testimonials carousel, FAQ accordion, newsletter (index.html only)
   Requires products-data.js to be loaded first.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ---- Testimonials ----
  const wrap = document.getElementById("testimonialWrap");
  if (wrap) {
    let index = 0;
    function renderTestimonial() {
      const r = REVIEWS[index];
      wrap.innerHTML = `
        <div class="testimonial-card">
          <div class="testimonial-stars">${stars(r.rating)}</div>
          <p>"${r.comment}"</p>
          <p class="name">${r.name}</p>
        </div>
        <div class="testimonial-dots">
          ${REVIEWS.map((_, i) => `<button aria-label="Show testimonial ${i + 1}" class="${i === index ? "active" : ""}" data-i="${i}"></button>`).join("")}
        </div>`;
      wrap.querySelectorAll(".testimonial-dots button").forEach((btn) => {
        btn.addEventListener("click", () => {
          index = Number(btn.dataset.i);
          renderTestimonial();
        });
      });
    }
    renderTestimonial();
    setInterval(() => {
      index = (index + 1) % REVIEWS.length;
      renderTestimonial();
    }, 5000);
  }

  // ---- FAQ accordion ----
  const FAQS = [
    { q: "How long does delivery take?", a: "Orders within Punjab typically arrive within 1-2 days. Other regions across Pakistan usually take 2-4 days depending on courier availability." },
    { q: "How do you keep the barfi fresh during delivery?", a: "Every order is packed in sealed, insulated boxes shortly after preparation to lock in freshness and prevent damage in transit." },
    { q: "What payment methods do you accept?", a: "We accept Visa, MasterCard, JazzCash, EasyPaisa, and Cash on Delivery — choose whichever is most convenient at checkout." },
    { q: "How should I store the barfi after it arrives?", a: "Keep it in an airtight container at room temperature for up to 4 days, or refrigerate for up to 10 days. Let it reach room temperature before serving." },
  ];
  const faqList = document.getElementById("faqList");
  if (faqList) {
    faqList.innerHTML = FAQS.map(
      (f, i) => `
      <div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-question" aria-expanded="${i === 0}">
          ${f.q}
          <span class="faq-chevron">▾</span>
        </button>
        <div class="faq-answer"><p>${f.a}</p></div>
      </div>`
    ).join("");

    faqList.querySelectorAll(".faq-item").forEach((item) => {
      const btn = item.querySelector(".faq-question");
      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        faqList.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      });
    });
  }

  // ---- Newsletter ----
  document.getElementById("newsletterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = e.target.querySelector("input").value;
    if (!email.includes("@")) {
      showToast("Please enter a valid email address.", true);
      return;
    }
    // TODO(you): POST to your email list provider (Mailchimp, EmailJS
    // audiences, etc.) here.
    showToast("You're subscribed! Watch for our next batch announcement.");
    e.target.reset();
  });
});
