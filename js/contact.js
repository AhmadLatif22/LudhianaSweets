document.getElementById("contactForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  // TODO(you): wire this to EmailJS (same account as checkout.js) with a
  // separate "contact" template, or a form service like Formspree.
  showToast("Message sent! We'll get back to you within a day.");
  e.target.reset();
});
