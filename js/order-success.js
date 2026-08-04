document.addEventListener("DOMContentLoaded", () => {
  // ---- Animate checkmark ----
  requestAnimationFrame(() => document.querySelector(".check-circle").classList.add("animate"));

  // ---- Lightweight canvas confetti burst ----
  const canvas = document.getElementById("confettiCanvas");
  if (canvas) {
    canvas.width = 400;
    canvas.height = 260;
    const ctx = canvas.getContext("2d");
    const colors = ["#C89B3C", "#B78B5C", "#4A2C1D", "#F3E6D0"];
    const particles = Array.from({ length: 30 }, () => ({
      x: 200 + (Math.random() - 0.5) * 40,
      y: 0,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 2 + 2,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      shape: Math.random() > 0.5 ? "circle" : "square",
    }));
    let frame = 0;
    function drawConfetti() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / 90);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        ctx.restore();
      });
      if (frame < 90) requestAnimationFrame(drawConfetti);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawConfetti();
  }

  // ---- Render order details ----
  const params = new URLSearchParams(window.location.search);
  const orderNumberFromUrl = params.get("order");
  const raw = localStorage.getItem("ls_last_order");
  const order = raw ? JSON.parse(raw) : null;

  const box = document.getElementById("orderInfoBox");
  const downloadBtn = document.getElementById("downloadInvoiceBtn");

  if (order && (!orderNumberFromUrl || order.orderNumber === orderNumberFromUrl)) {
    box.innerHTML = `
      <div class="row"><span>Order Number</span><span class="value">${order.orderNumber}</span></div>
      <div class="row"><span>Payment Method</span><span class="value">${order.paymentMethod.toUpperCase()}</span></div>
      <div class="row"><span>Delivery Address</span><span class="value">${order.customer.address}, ${order.customer.city}</span></div>
      <div class="row"><span>Estimated Delivery</span><span class="value">${order.estimatedDelivery}</span></div>
      <div class="row"><span>Total Paid</span><span class="value gold-text">${formatPKR(order.total)}</span></div>
    `;

    downloadBtn.addEventListener("click", () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(74, 44, 29);
      doc.text("Ludhiana Sweets", 14, 20);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Invoice — Order ${order.orderNumber}`, 14, 30);
      doc.text(`Date: ${new Date(order.createdAt).toDateString()}`, 14, 37);
      doc.text(`Bill To: ${order.customer.fullName}`, 14, 48);
      doc.text(`${order.customer.address}, ${order.customer.city}`, 14, 54);
      doc.text(`Phone: ${order.customer.phone}`, 14, 60);

      let y = 75;
      doc.setFont("helvetica", "bold");
      doc.text("Item", 14, y);
      doc.text("Qty", 120, y);
      doc.text("Price", 150, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      order.items.forEach((item) => {
        doc.text(`${item.name} (${item.weight})`, 14, y);
        doc.text(String(item.quantity), 120, y);
        doc.text(formatPKR(item.unitPrice * item.quantity), 150, y);
        y += 7;
      });

      y += 5;
      doc.text(`Subtotal: ${formatPKR(order.subtotal)}`, 120, y);
      y += 6;
      doc.text(`Shipping: ${formatPKR(order.shipping)}`, 120, y);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`Total: ${formatPKR(order.total)}`, 120, y);

      doc.save(`${order.orderNumber}-invoice.pdf`);
    });
  } else {
    box.innerHTML = `<div class="row"><span>Order Number</span><span class="value">${orderNumberFromUrl || "—"}</span></div>`;
    downloadBtn.disabled = true;
  }
});
