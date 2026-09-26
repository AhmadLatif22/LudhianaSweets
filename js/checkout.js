/* ==========================================================================
   checkout.js — Ludhiana Sweets

   PAYMENT / SHIPPING RULES
   --------------------------------------------------------------------------
   Debit / Credit Card  -> FREE SHIPPING (Rs 0)
   JazzCash             -> FREE SHIPPING (Rs 0)
   EasyPaisa            -> FREE SHIPPING (Rs 0)
   Cash on Delivery     -> Rs 200 SHIPPING

   COD FLOW
   --------------------------------------------------------------------------
   Cash on Delivery orders go through WhatsApp confirmation.

   1. Order saved as "pending_whatsapp_confirmation"
   2. WhatsApp confirmation request is triggered
   3. Customer confirms/cancels through WhatsApp
   4. Supabase webhook handles final confirmation

   ONLINE / PREPAID FLOW
   --------------------------------------------------------------------------
   Card, JazzCash and EasyPaisa currently use the immediate EmailJS
   confirmation flow.

   IMPORTANT:
   This file does NOT itself process actual Visa, MasterCard, JazzCash or
   EasyPaisa payments. Payment gateway APIs must be integrated separately.
   ========================================================================== */


/* ==========================================================================
   EMAILJS CONFIGURATION
   ========================================================================== */

const EMAILJS_PUBLIC_KEY = "";
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";


if (
  typeof emailjs !== "undefined" &&
  EMAILJS_PUBLIC_KEY
) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}


/* ==========================================================================
   SHIPPING CONFIGURATION
   ========================================================================== */

const SHIPPING_RATES = {
  card: 0,
  jazzcash: 0,
  easypaisa: 0,
  cod: 200,
};


/* ==========================================================================
   PAYMENT METHOD LABELS
   ========================================================================== */

const PAYMENT_LABELS = {
  card: "Debit / Credit Card",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  cod: "Cash on Delivery",
};


/* ==========================================================================
   GENERATE ORDER NUMBER
   ========================================================================== */

function generateOrderNumber() {

  const d = new Date();

  const stamp =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;

  const rand =
    Math.floor(1000 + Math.random() * 9000);

  return `LS-${stamp}-${rand}`;
}


/* ==========================================================================
   SHIPPING CALCULATION
   ========================================================================== */

function getShippingCharge(paymentMethod) {

  return SHIPPING_RATES[paymentMethod] ?? 0;

}


/* ==========================================================================
   WHATSAPP COD CONFIRMATION
   ========================================================================== */

async function triggerWhatsAppConfirmation(orderNumber) {

  if (
    typeof isDatabaseConnected !== "function" ||
    !isDatabaseConnected()
  ) {
    return;
  }

  try {

    await fetch(
      `${SUPABASE_URL}/functions/v1/send-whatsapp-confirmation`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },

        body: JSON.stringify({
          orderNumber,
        }),
      }
    );

  } catch (err) {

    console.warn(
      "Could not reach the WhatsApp confirmation function:",
      err
    );

  }
}


/* ==========================================================================
   CHECKOUT
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {


  /* ------------------------------------------------------------------------
     CART
     ------------------------------------------------------------------------ */

  const items = getCart();


  if (!items || items.length === 0) {

    const checkoutGrid =
      document.querySelector(".checkout-grid");

    if (checkoutGrid) {

      checkoutGrid.innerHTML = `
        <div
          style="
            grid-column:1/-1;
            text-align:center;
            padding:70px 20px;
          "
        >
          <h2 style="margin-bottom:12px;">
            Your cart is empty
          </h2>

          <p style="
            color:rgba(74,44,29,.6);
            margin-bottom:22px;
          ">
            Add something delicious before proceeding to checkout.
          </p>

          <a
            href="shop.html"
            class="btn btn-primary"
          >
            Continue Shopping →
          </a>
        </div>
      `;

    }

    return;
  }


  /* ==========================================================================
     ELEMENT REFERENCES
     ========================================================================== */

  const form =
    document.getElementById("checkoutForm");

  const placeOrderBtn =
    document.getElementById("placeOrderBtn");

  const summaryItems =
    document.getElementById("summaryItems");

  const summarySubtotal =
    document.getElementById("summarySubtotal");

  const summaryShipping =
    document.getElementById("summaryShipping");

  const summaryTotal =
    document.getElementById("summaryTotal");

  const paymentMethodInput =
    document.getElementById("paymentMethod");

  const paymentOptions =
    document.querySelectorAll(
      ".checkout-payment-option"
    );

  const shippingCod =
    document.getElementById("shippingCod");

  const shippingPrepaid =
    document.getElementById("shippingPrepaid");

  const paymentShippingNotice =
    document.getElementById(
      "paymentShippingNotice"
    );

  const billingOptions =
    document.querySelectorAll(
      ".billing-option"
    );

  const differentBilling =
    document.getElementById(
      "differentBillingAddress"
    );


  /* ==========================================================================
     PAYMENT STATE

     Default is CARD because prepaid/card is selected in the new checkout UI.
     ========================================================================== */

  let paymentMethod = "card";


  /* ==========================================================================
     FORMAT CURRENCY

     Uses your existing formatPKR() function when available.
     ========================================================================== */

  function currency(amount) {

    if (typeof formatPKR === "function") {
      return formatPKR(amount);
    }

    return `Rs ${Number(amount).toLocaleString("en-PK")}`;

  }


  /* ==========================================================================
     CART SUBTOTAL
     ========================================================================== */

  function getSubtotal() {

    if (typeof cartSubtotal === "function") {
      return Number(cartSubtotal()) || 0;
    }


    return getCart().reduce(
      (total, item) => {

        const price =
          Number(item.unitPrice) || 0;

        const quantity =
          Number(item.quantity) || 0;

        return total + price * quantity;

      },
      0
    );

  }


  /* ==========================================================================
     RENDER ORDER ITEMS
     ========================================================================== */

  function renderOrderItems() {

    if (!summaryItems) return;


    summaryItems.innerHTML =
      getCart()
        .map((item) => {

          const itemTotal =
            Number(item.unitPrice) *
            Number(item.quantity);

          return `
            <div class="summary-line-item">

              <img
                src="${item.image}"
                alt="${item.name}"
              />

              <div
                style="
                  flex:1;
                  min-width:0;
                "
              >

                <p
                  style="
                    font-weight:600;
                    font-size:.88rem;
                  "
                >
                  ${item.name}
                </p>

                <p
                  style="
                    font-size:.78rem;
                    color:rgba(74,44,29,.6);
                  "
                >
                  ${item.weight} × ${item.quantity}
                </p>

              </div>

              <strong
                class="gold-text"
                style="
                  font-size:.9rem;
                  white-space:nowrap;
                "
              >
                ${currency(itemTotal)}
              </strong>

            </div>
          `;

        })
        .join("");

  }


  /* ==========================================================================
     RENDER TOTALS
     ========================================================================== */

  function renderTotals() {

    const subtotal =
      getSubtotal();

    const shipping =
      getShippingCharge(paymentMethod);

    const total =
      subtotal + shipping;


    if (summarySubtotal) {

      summarySubtotal.textContent =
        currency(subtotal);

    }


    if (summaryShipping) {

      summaryShipping.textContent =
        shipping === 0
          ? "FREE"
          : currency(shipping);

    }


    if (summaryTotal) {

      summaryTotal.textContent =
        currency(total);

    }

  }


  /* ==========================================================================
     SHIPPING METHOD UI
     ========================================================================== */

  function updateShippingMethodUI() {

    const isCOD =
      paymentMethod === "cod";


    /*
     * COD
     */

    if (shippingCod) {

      shippingCod.classList.toggle(
        "active",
        isCOD
      );

      shippingCod.setAttribute(
        "aria-pressed",
        isCOD ? "true" : "false"
      );

    }


    /*
     * PREPAID
     */

    if (shippingPrepaid) {

      shippingPrepaid.classList.toggle(
        "active",
        !isCOD
      );

      shippingPrepaid.setAttribute(
        "aria-pressed",
        !isCOD ? "true" : "false"
      );

    }


    /*
     * SHIPPING MESSAGE
     */

    if (paymentShippingNotice) {

      if (isCOD) {

        paymentShippingNotice.classList.add(
          "cod"
        );

        paymentShippingNotice.innerHTML = `
          <span>ℹ</span>

          <span>
            <strong>Rs 200 shipping</strong>
            applies to Cash on Delivery orders.
          </span>
        `;

      } else {

        paymentShippingNotice.classList.remove(
          "cod"
        );

        paymentShippingNotice.innerHTML = `
          <span>✓</span>

          <span>
            <strong>Free shipping</strong>
            applied for prepaid payment.
          </span>
        `;

      }

    }

  }


  /* ==========================================================================
     PLACE ORDER BUTTON
     ========================================================================== */

  function updatePlaceOrderButton() {

    if (!placeOrderBtn) return;


    if (paymentMethod === "cod") {

      placeOrderBtn.innerHTML = `
        <span>🔒</span>
        Place Order — Cash on Delivery
      `;

      return;
    }


    if (paymentMethod === "jazzcash") {

      placeOrderBtn.innerHTML = `
        <span>🔒</span>
        Continue with JazzCash
      `;

      return;
    }


    if (paymentMethod === "easypaisa") {

      placeOrderBtn.innerHTML = `
        <span>🔒</span>
        Continue with EasyPaisa
      `;

      return;
    }


    placeOrderBtn.innerHTML = `
      <span>🔒</span>
      Continue to Secure Payment
    `;

  }


  /* ==========================================================================
     SELECT PAYMENT METHOD
     ========================================================================== */

  function selectPaymentMethod(method) {

    if (!SHIPPING_RATES.hasOwnProperty(method)) {
      return;
    }


    paymentMethod = method;


    /*
     * Hidden form value
     */

    if (paymentMethodInput) {

      paymentMethodInput.value =
        paymentMethod;

    }


    /*
     * Payment card selection
     */

    paymentOptions.forEach((option) => {

      const selected =
        option.dataset.method ===
        paymentMethod;

      option.classList.toggle(
        "active",
        selected
      );

      option.setAttribute(
        "aria-pressed",
        selected ? "true" : "false"
      );

    });


    updateShippingMethodUI();

    updatePlaceOrderButton();

    renderTotals();

  }


  /* ==========================================================================
     PAYMENT OPTION EVENTS
     ========================================================================== */

  paymentOptions.forEach((option) => {

    option.addEventListener(
      "click",
      () => {

        const method =
          option.dataset.method;

        selectPaymentMethod(method);

      }
    );

  });


  /* ==========================================================================
     SHIPPING METHOD EVENTS

     Shipping method is linked directly to payment type.

     Clicking COD:
       -> select COD payment

     Clicking prepaid:
       -> if currently COD, switch back to Card
     ========================================================================== */

  if (shippingCod) {

    shippingCod.addEventListener(
      "click",
      () => {

        selectPaymentMethod("cod");

      }
    );

  }


  if (shippingPrepaid) {

    shippingPrepaid.addEventListener(
      "click",
      () => {

        if (paymentMethod === "cod") {

          selectPaymentMethod("card");

        }

      }
    );

  }


  /* ==========================================================================
     BILLING ADDRESS
     ========================================================================== */

  billingOptions.forEach((option) => {

    option.addEventListener(
      "click",
      () => {

        billingOptions.forEach(
          (item) => {

            item.classList.remove(
              "active"
            );

          }
        );


        option.classList.add(
          "active"
        );


        const radio =
          option.querySelector(
            'input[name="billingAddress"]'
          );


        if (!radio) return;


        radio.checked = true;


        if (radio.value === "different") {

          differentBilling?.classList.add(
            "show"
          );

        } else {

          differentBilling?.classList.remove(
            "show"
          );

        }

      }
    );

  });


  /* ==========================================================================
     FORM VALIDATION
     ========================================================================== */

  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "city",
  ];


  function clearFieldError(fieldName) {

    const input =
      form.elements[fieldName];

    const errorEl =
      form.querySelector(
        `[data-error-for="${fieldName}"]`
      );


    if (errorEl) {
      errorEl.textContent = "";
    }


    if (input) {
      input.classList.remove("invalid");
    }

  }


  function showFieldError(
    fieldName,
    message
  ) {

    const input =
      form.elements[fieldName];

    const errorEl =
      form.querySelector(
        `[data-error-for="${fieldName}"]`
      );


    if (errorEl) {
      errorEl.textContent = message;
    }


    if (input) {
      input.classList.add("invalid");
    }

  }


  function validate() {

    let valid = true;


    /*
     * Main shipping fields
     */

    requiredFields.forEach(
      (fieldName) => {

        clearFieldError(fieldName);

        const input =
          form.elements[fieldName];


        if (!input) return;


        const value =
          String(input.value || "").trim();


        if (!value) {

          showFieldError(
            fieldName,
            fieldName === "city"
              ? "Please select your city."
              : "This field is required."
          );

          valid = false;

          return;

        }


        if (
          input.validity &&
          !input.validity.valid
        ) {

          showFieldError(
            fieldName,
            "Please enter a valid value."
          );

          valid = false;

        }

      }
    );


    /*
     * Email
     */

    const email =
      form.elements.email;


    if (
      email &&
      email.value &&
      !email.validity.valid
    ) {

      showFieldError(
        "email",
        "Please enter a valid email address."
      );

      valid = false;

    }


    /*
     * Phone
     */

    const phone =
      form.elements.phone;


    if (phone) {

      const cleanedPhone =
        phone.value.replace(
          /[\s\-()+]/g,
          ""
        );


      if (
        cleanedPhone &&
        cleanedPhone.length < 10
      ) {

        showFieldError(
          "phone",
          "Please enter a valid phone number."
        );

        valid = false;

      }

    }


    /*
     * Different billing address
     */

    const billingChoice =
      form.querySelector(
        'input[name="billingAddress"]:checked'
      );


    if (
      billingChoice &&
      billingChoice.value === "different"
    ) {

      const billingFields = [
        "billingFirstName",
        "billingLastName",
        "billingAddressInput",
        "billingCity",
      ];


      billingFields.forEach(
        (fieldName) => {

          const input =
            form.elements[fieldName];


          if (
            input &&
            !input.value.trim()
          ) {

            input.classList.add(
              "invalid"
            );

            valid = false;

          } else if (input) {

            input.classList.remove(
              "invalid"
            );

          }

        }
      );

    }


    return valid;

  }


  /* ==========================================================================
     REMOVE ERROR WHILE USER TYPES
     ========================================================================== */

  requiredFields.forEach(
    (fieldName) => {

      const input =
        form.elements[fieldName];


      if (!input) return;


      const eventType =
        input.tagName === "SELECT"
          ? "change"
          : "input";


      input.addEventListener(
        eventType,
        () => {

          if (
            String(
              input.value || ""
            ).trim()
          ) {

            clearFieldError(
              fieldName
            );

          }

        }
      );

    }
  );


  /* ==========================================================================
     FORM SUBMISSION
     ========================================================================== */

  form.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      if (!validate()) {

        const firstInvalid =
          form.querySelector(
            ".input.invalid"
          );


        if (firstInvalid) {

          firstInvalid.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          firstInvalid.focus();

        }


        return;
      }


      /* ----------------------------------------------------------------------
         DISABLE SUBMIT
         ---------------------------------------------------------------------- */

      placeOrderBtn.disabled = true;

      placeOrderBtn.textContent =
        "Placing your order...";


      /* ----------------------------------------------------------------------
         CUSTOMER
         ---------------------------------------------------------------------- */

      const firstName =
        form.elements.firstName.value.trim();

      const lastName =
        form.elements.lastName.value.trim();

      const fullName =
        `${firstName} ${lastName}`.trim();


      const customer = {

        firstName,

        lastName,

        fullName,

        email:
          form.elements.email.value.trim(),

        phone:
          form.elements.phone.value.trim(),

        country:
          form.elements.country?.value ||
          "Pakistan",

        address:
          form.elements.address.value.trim(),

        city:
          form.elements.city.value.trim(),

        postalCode:
          form.elements.postalCode?.value.trim() ||
          "",

        notes:
          form.elements.notes?.value.trim() ||
          "",

      };


      /* ----------------------------------------------------------------------
         BILLING ADDRESS
         ---------------------------------------------------------------------- */

      const billingChoice =
        form.querySelector(
          'input[name="billingAddress"]:checked'
        );


      let billingAddress = {
        sameAsShipping: true,
      };


      if (
        billingChoice &&
        billingChoice.value === "different"
      ) {

        billingAddress = {

          sameAsShipping: false,

          firstName:
            form.elements.billingFirstName
              ?.value.trim() || "",

          lastName:
            form.elements.billingLastName
              ?.value.trim() || "",

          address:
            form.elements.billingAddressInput
              ?.value.trim() || "",

          city:
            form.elements.billingCity
              ?.value.trim() || "",

          postalCode:
            form.elements.billingPostalCode
              ?.value.trim() || "",

          country: "Pakistan",

        };

      }


      /* ----------------------------------------------------------------------
         ORDER DETAILS
         ---------------------------------------------------------------------- */

      const orderNumber =
        generateOrderNumber();

      const subtotal =
        getSubtotal();

      const shipping =
        getShippingCharge(
          paymentMethod
        );

      const total =
        subtotal + shipping;

      const cartItems =
        getCart();


      /*
       * Estimated delivery: 3 days
       */

      const estimatedDelivery =
        new Date(
          Date.now() +
          3 *
          24 *
          60 *
          60 *
          1000
        ).toDateString();


      /*
       * COD waits for WhatsApp confirmation.
       *
       * Prepaid methods keep your current
       * immediate confirmation flow.
       */

      const initialStatus =
        paymentMethod === "cod"
          ? "pending_whatsapp_confirmation"
          : "confirmed";


      const order = {

        orderNumber,

        items: cartItems,

        customer,

        billingAddress,

        paymentMethod,

        paymentMethodLabel:
          PAYMENT_LABELS[paymentMethod],

        paymentType:
          paymentMethod === "cod"
            ? "cash_on_delivery"
            : "prepaid",

        paymentStatus:
          paymentMethod === "cod"
            ? "pending"
            : "awaiting_payment",

        subtotal,

        shipping,

        total,

        status:
          initialStatus,

        estimatedDelivery,

        createdAt:
          new Date().toISOString(),

      };


      /* ----------------------------------------------------------------------
         LOCAL STORAGE BACKUP
         ---------------------------------------------------------------------- */

      localStorage.setItem(
        "ls_last_order",
        JSON.stringify(order)
      );


      const allOrders =
        JSON.parse(
          localStorage.getItem(
            "ls_all_orders"
          ) || "[]"
        );


      allOrders.unshift(order);


      localStorage.setItem(
        "ls_all_orders",
        JSON.stringify(allOrders)
      );


      /* ----------------------------------------------------------------------
         SAVE TO SUPABASE
         ---------------------------------------------------------------------- */

      if (
        typeof isDatabaseConnected === "function" &&
        isDatabaseConnected()
      ) {

        try {

          const {
            error,
          } =
            await supabaseClient
              .from("orders")
              .insert({

                order_number:
                  orderNumber,

                items:
                  cartItems,

                customer,

                billing_address:
                  billingAddress,

                payment_method:
                  paymentMethod,

                subtotal,

                shipping,

                total,

                status:
                  initialStatus,

                estimated_delivery:
                  estimatedDelivery,

              });


          if (error) {

            console.warn(
              "Could not save order to Supabase:",
              error.message
            );

          }

        } catch (error) {

          console.warn(
            "Supabase order save failed:",
            error
          );

        }

      }


      /* ==========================================================================
         CASH ON DELIVERY
         ========================================================================== */

      if (paymentMethod === "cod") {

        /*
         * Do not send EmailJS yet.
         *
         * Customer first confirms the COD
         * order through WhatsApp.
         */

        await triggerWhatsAppConfirmation(
          orderNumber
        );


        clearCart();


        window.location.href =
          `order-success.html?order=${encodeURIComponent(
            orderNumber
          )}&pending=whatsapp`;


        return;
      }


      /* ==========================================================================
         PREPAID / ONLINE PAYMENT

         Current flow:
           Card
           JazzCash
           EasyPaisa

         These currently trigger immediate EmailJS confirmation.

         Replace this section with your actual gateway redirect/API when
         real online payment processing is integrated.
         ========================================================================== */

      const readablePaymentMethod =
        PAYMENT_LABELS[paymentMethod] ||
        paymentMethod;


      const emailTemplateParams = {

        to_email:
          customer.email,

        to_name:
          customer.fullName,

        order_number:
          orderNumber,

        order_items:
          cartItems
            .map(
              (item) =>
                `${item.name} (${item.weight}) × ${item.quantity}`
            )
            .join(", "),

        subtotal:
          currency(subtotal),

        shipping:
          shipping === 0
            ? "FREE"
            : currency(shipping),

        order_total:
          currency(total),

        payment_method:
          readablePaymentMethod,

        delivery_address:
          [
            customer.address,
            customer.city,
            customer.postalCode,
            customer.country,
          ]
            .filter(Boolean)
            .join(", "),

        phone:
          customer.phone,

        estimated_delivery:
          estimatedDelivery,

      };


      /* ----------------------------------------------------------------------
         SEND EMAIL
         ---------------------------------------------------------------------- */

      const emailConfigured =
        typeof emailjs !== "undefined" &&
        EMAILJS_PUBLIC_KEY &&
        EMAILJS_SERVICE_ID &&
        EMAILJS_TEMPLATE_ID;


      let sendEmail =
        Promise.resolve();


      if (emailConfigured) {

        sendEmail =
          emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            emailTemplateParams
          );

      }


      sendEmail
        .catch((err) => {

          console.warn(
            "EmailJS confirmation failed or is not configured:",
            err
          );

        })
        .finally(() => {

          clearCart();


          window.location.href =
            `order-success.html?order=${encodeURIComponent(
              orderNumber
            )}`;

        });

    }
  );


  /* ==========================================================================
     INITIAL RENDER
     ========================================================================== */

  renderOrderItems();

  selectPaymentMethod("card");

});