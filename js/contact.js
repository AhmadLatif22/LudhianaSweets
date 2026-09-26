/* ==========================================================================
   contact.js
   Validates the contact form, then sends it via EmailJS.

   IMPORTANT: the keys `name`, `email`, `message` below are the template
   variable names sent to EmailJS. Open your template in the EmailJS
   dashboard (Email Templates -> template_jgtkgiq) and check which
   variables it actually uses, e.g. {{name}}, {{from_name}}, {{user_email}}.
   If yours are named differently, rename the keys in templateParams below
   to match — otherwise the fields will arrive empty in the email.
   ========================================================================== */

const EMAILJS_SERVICE_ID = "service_xajzc17";
const EMAILJS_TEMPLATE_ID = "template_jgtkgiq";
const EMAILJS_PUBLIC_KEY = "jHMv8DK7jwSSt5Z3g";

if (window.emailjs) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const msgEl = document.getElementById("contactFormMsg");
  const submitBtn = document.getElementById("contactSubmitBtn");

  function setFieldError(id, message) {
    const errorEl = document.querySelector(`[data-error-for="${id}"]`);
    if (errorEl) errorEl.textContent = message || "";
  }

  function validate() {
    let valid = true;
    const name = document.getElementById("cName").value.trim();
    const email = document.getElementById("cEmail").value.trim();
    const message = document.getElementById("cMessage").value.trim();

    setFieldError("cName", "");
    setFieldError("cEmail", "");
    setFieldError("cMessage", "");

    if (!name) {
      setFieldError("cName", "Please enter your name.");
      valid = false;
    }
    if (!email) {
      setFieldError("cEmail", "Please enter your email.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError("cEmail", "Enter a valid email address.");
      valid = false;
    }
    if (!message) {
      setFieldError("cMessage", "Please write a message.");
      valid = false;
    }

    return { valid, name, email, message };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";

    const { valid, name, email, message } = validate();
    if (!valid) return;

    if (!window.emailjs) {
      msgEl.style.color = "#c0392b";
      msgEl.textContent = "Couldn't load the email service — please try again in a moment.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        name,
        email,
        message,
      });

      msgEl.style.color = "#1e7e34";
      msgEl.textContent = "Thanks! Your message has been sent — we'll get back to you soon.";
      form.reset();
    } catch (err) {
      console.error("EmailJS send failed:", err);
      msgEl.style.color = "#c0392b";
      msgEl.textContent = "Something went wrong sending your message. Please try WhatsApp or email us directly instead.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });
});