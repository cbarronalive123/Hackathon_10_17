const state = { health: {}, calls: [], bookings: [], mode: null, pollTimer: null };

const $ = (sel) => document.querySelector(sel);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function api(path, options = {}) {
  const opts = { headers: { "Content-Type": "application/json" }, ...options };
  if (opts.body && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);
  const apiKey = localStorage.getItem("stayline_api_key");
  if (apiKey) opts.headers["X-Api-Key"] = apiKey;
  const res = await fetch(path, opts);
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add("hidden"), 5000);
}

function money(amount, currency) {
  if (amount === null || amount === undefined) return "â€”";
  return `${currency === "USD" ? "$" : (currency || "") + " "}${Number(amount).toFixed(2)}`;
}

function isoDatePlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadHealth() {
  state.health = await api("/api/health");
  const h = state.health;
  const chips = [
    ["ElevenLabs", h.elevenlabs_key],
    ["Booker agent", h.booker_agent],
    ["Front desk agent", h.frontdesk_agent],
    ["Twilio", h.twilio_ready && h.from_number],
    ["Public URL", h.public_url_set],
    ["liteAPI", h.liteapi],
    ["Places lookup", h.google_places],
  ];
  $("#health-chips").innerHTML = chips.map(([label, ok]) =>
    `<span class="chip ${ok ? "ok" : "bad"}">${label} ${ok ? "âœ“" : "âœ—"}</span>`
  ).join("");
  const keyInput = $("#api-key");
  if (h.api_auth) {
    keyInput.classList.remove("hidden");
    keyInput.value = localStorage.getItem("stayline_api_key") || "";
  }
  const mode = h.default_mode || "real";
  $("#call-mode").value = mode;
  state.mode = mode;
  renderModeHint();
}

function renderModeHint() {
  const h = state.health;
  const modes = h.modes_available || {};
  const notes = {
    real: "Dials the hotel's real phone number — only a verified source (manual or Google).",
    test: `Dials TEST_PHONE (${h.test_phone ? "set" : "not set"}) or the number dialed in the desktop GUI — you answer and role-play the front desk.`,
    sim: `Dials TWILIO_SIM_NUMBER (${h.sim_number ? "set" : "not set"}) — an AI front-desk agent answers. Point that number's voice webhook at POST {PUBLIC_URL}/twilio/voice/frontdesk.`,
  };
  const available = modes[state.mode];
  $("#mode-hint").innerHTML = `${esc(notes[state.mode] || "")} ${available ? "" : " <b style='color:var(--bad)'>This mode is not configured yet (check .env).</b>"}`;
}

async function loadProfile() {
  const p = await api("/api/profile");
  const form = $("#profile-form");
  for (const key of Object.keys(p)) {
    const input = form.elements[key];
    if (input && p[key] !== null && p[key] !== undefined && p[key] !== "") input.value = p[key];
  }
}

async function searchHotels(event) {
  event.preventDefault();
  const form = $("#search-form");
  const status = $("#search-status");
  status.textContent = "Searching live ratesâ€¦";
  try {
    const params = new URLSearchParams(new FormData(form));
    const data = await api(`/api/hotels?${params}`);
    status.textContent = `${data.results.length} hotels with live rates`;
    renderResults(data.results);
  } catch (err) {
    status.textContent = "";
    toast(err.message);
  }
}

function renderResults(results) {
  const box = $("#results");
  if (!results.length) {
    box.innerHTML = `<div class="muted">No results. Try another city or dates further out.</div>`;
    return;
  }
  box.innerHTML = results.map((r) => {
    const phone = r.phone
      ? `<span class="tag src">${esc(r.phone_source)}</span> <b>${esc(r.phone)}</b>`
      : `<span class="none">no phone yet</span>`;
    return `
    <div class="result" data-hotel-id="${esc(r.hotel_id)}">
      ${r.photo ? `<img src="${esc(r.photo)}" alt="" onerror="this.style.visibility='hidden'">` : ""}
      <div class="info">
        <div class="name">${esc(r.name)}</div>
        <div class="meta">${"â˜…".repeat(Math.round(r.stars || 0))} ${esc(r.rating ?? "â€“")}/10 Â· ${esc(r.review_count ?? 0)} reviews Â· ${esc(r.address)}, ${esc(r.city)}</div>
        <div class="tags">
          <span class="tag">${esc(r.room_name || "room")}</span>
          <span class="tag">${esc(r.board || "RO")}</span>
          <span class="tag ${esc((r.refundable || "").toLowerCase())}">${r.refundable === "RFN" ? "refundable" : (r.refundable === "NRFN" ? "non-refundable" : "â€”")}</span>
          ${r.max_occupancy ? `<span class="tag">sleeps ${esc(r.max_occupancy)}</span>` : ""}
        </div>
        <div class="phone-row">${phone}
          <input class="phone-input" placeholder="+12125550123">
          <button class="small" onclick="savePhone(this)">set phone</button>
        </div>
      </div>
      <div class="price">
        <div class="total">${money(r.total, r.currency)}</div>
        <div class="per">${money(r.per_night, r.currency)}/night Â· ${esc(r.nights)}n</div>
      </div>
      <div class="actions">
        <button class="primary small" onclick="placeCall(this)">Call to book</button>
        <button class="small" onclick="bookOnline(this)">Book online</button>
      </div>
    </div>`;
  }).join("");
  window._results = Object.fromEntries(results.map((r) => [r.hotel_id, r]));
}

async function savePhone(button) {
  const row = button.closest(".result");
  const hotelId = row.dataset.hotelId;
  const input = row.querySelector(".phone-input");
  const value = input.value.trim();
  if (!value) return toast("Enter a phone number first");
  try {
    const data = await api(`/api/hotels/${encodeURIComponent(hotelId)}/phone`, {
      method: "PUT",
      body: { phone: value },
    });
    const offer = window._results[hotelId];
    if (offer) {
      offer.phone = data.phone;
      offer.phone_source = "manual";
    }
    const phoneRow = row.querySelector(".phone-row");
    if (phoneRow) {
      phoneRow.innerHTML = `<span class="tag src">manual</span> <b>${esc(data.phone)}</b>
        <input class="phone-input" placeholder="+12125550123">
        <button class="small" onclick="savePhone(this)">set phone</button>`;
    }
    input.value = "";
    toast(`Saved ${data.phone} for this hotel`);
  } catch (err) {
    toast(err.message);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = $("#profile-form");
  const body = Object.fromEntries(new FormData(form));
  try {
    await api("/api/profile", { method: "PUT", body });
    $("#profile-status").textContent = "Profile saved âœ“";
    setTimeout(() => ($("#profile-status").textContent = ""), 2500);
  } catch (err) {
    toast(err.message);
  }
}

async function placeCall(button) {
  const row = button.closest(".result");
  const hotelId = row.dataset.hotelId;
  const offer = window._results[hotelId];
  if (!offer) return toast("Search again first");
  button.disabled = true;
  try {
    const call = await api("/api/calls", {
      method: "POST",
      body: { hotel_id: hotelId, offer, mode: state.mode },
    });
    toast(`Call #${call.id} placed to ${call.to_number}`);
    await pollCalls();
  } catch (err) {
    toast(err.message);
  } finally {
    button.disabled = false;
  }
}

async function bookOnline(button) {
  const row = button.closest(".result");
  const hotelId = row.dataset.hotelId;
  const offer = window._results[hotelId];
  if (!offer || !offer.offer_id) return toast("No bookable offer for this hotel");
  button.disabled = true;
  try {
    await api("/api/bookings/online", {
      method: "POST",
      body: {
        hotel_id: hotelId,
        offer_id: offer.offer_id,
        checkin: offer.checkin,
        checkout: offer.checkout,
        adults: offer.adults || 2,
      },
    });
    toast("Online booking placed (sandbox)");
    await loadBookings();
  } catch (err) {
    toast(err.message);
  } finally {
    button.disabled = false;
  }
}

async function hangupCall(callId) {
  try {
    await api(`/api/calls/${callId}/hangup`, { method: "POST" });
    await pollCalls();
  } catch (err) {
    toast(err.message);
  }
}

function renderCall(call) {
  const reservation = call.reservation || {};
  const outcome = call.outcome || {};
  const ctx = call.booking_context || {};
  const status = call.status || "queued";
  const transcript = (call.transcript || []).map((t) =>
    `<div class="turn ${t.role}"><div class="role">${t.role === "agent" ? "booker AI" : "hotel"}</div>${esc(t.message || "")}</div>`
  ).join("");
  const peer = (call.peer_transcript || []).map((t) =>
    `<div class="turn ${t.role === "agent" ? "" : "agent"}"><div class="role">${t.role === "agent" ? "front desk AI" : "booker AI"}</div>${esc(t.message || "")}</div>`
  ).join("");
  const kv = [];
  if (reservation.confirmation_number) kv.push(["Confirmation", reservation.confirmation_number]);
  if (reservation.total_price) kv.push(["Total price", reservation.total_price]);
  if (reservation.room_description) kv.push(["Room", reservation.room_description]);
  if (reservation.cancellation_policy) kv.push(["Cancellation", reservation.cancellation_policy]);
  if (reservation.notes) kv.push(["Notes", reservation.notes]);
  if (call.summary) kv.push(["Summary", call.summary]);
  if (call.call_successful) kv.push(["Analysis", call.call_successful]);
  const kvHtml = kv.length ? `<div class="kv">${kv.map(([k, v]) => `<div class="k">${esc(k)}</div><div>${esc(v)}</div>`).join("")}</div>` : "";
  const active = ["queued", "ringing", "in_progress"].includes(status);
  return `
  <div class="call">
    <div class="head">
      <span class="hotel">#${call.id} ${esc(call.hotel_name || "")}</span>
      <span class="badge ${esc(status)}">${esc(status)}</span>
      <span class="badge ${esc(call.mode)}">${esc(call.mode)}</span>
      ${outcome.outcome ? `<span class="badge ${esc(outcome.outcome === "booked" ? "booked" : "")}">${esc(outcome.outcome)}</span>` : ""}
      <span class="muted">${esc(call.to_number || "")} Â· ${esc(ctx.checkin || "")} â†’ ${esc(ctx.checkout || "")} Â· ${esc(ctx.room_type || "")}</span>
      <span class="muted" style="margin-left:auto">${esc((call.created_at || "").replace("T", " ").replace("+00:00", ""))} UTC</span>
    </div>
    ${kvHtml}
    ${call.error ? `<div class="muted" style="color:var(--bad)">${esc(call.error)}</div>` : ""}
    <div class="actions">
      ${active ? `<button class="small" onclick="hangupCall(${call.id})">Hang up</button>` : ""}
      ${call.recording_url ? `<a class="tag" href="${esc(call.recording_url)}" target="_blank">recording</a>` : ""}
    </div>
    ${transcript ? `<details><summary>Transcript (booker AI)</summary><div class="transcript">${transcript}</div></details>` : ""}
    ${peer ? `<details><summary>Transcript (front desk AI)</summary><div class="transcript">${peer}</div></details>` : ""}
  </div>`;
}

async function pollCalls() {
  try {
    const data = await api("/api/calls");
    state.calls = data.calls || [];
    $("#calls").innerHTML = state.calls.length
      ? state.calls.map(renderCall).join("")
      : `<div class="muted">No calls yet. Search a hotel and press â€œCall to bookâ€.</div>`;
    const anyActive = state.calls.some((c) => ["queued", "ringing", "in_progress"].includes(c.status));
    schedulePolling(anyActive ? 3000 : 15000);
  } catch (err) {
    schedulePolling(15000);
  }
}

function schedulePolling(interval) {
  if (state.pollTimer && state.pollTimer._interval === interval) return;
  if (state.pollTimer) clearInterval(state.pollTimer);
  const t = setInterval(pollCalls, interval);
  t._interval = interval;
  state.pollTimer = t;
}

async function loadBookings() {
  try {
    const data = await api("/api/bookings");
    state.bookings = data.bookings || [];
    $("#bookings").innerHTML = state.bookings.length
      ? state.bookings.map((b) => `
        <div class="booking">
          <span class="id">${esc(b.booking_id || b.prebook_id || ("#" + b.id))}</span>
          <span>${esc(b.hotel_name || b.hotel_id || "")}</span>
          <span>${esc(b.checkin)} â†’ ${esc(b.checkout)}</span>
          <span>${esc(b.guests)} guests</span>
          <span>${money(b.total_amount, b.currency)}</span>
          <span class="badge completed">${esc(b.status || "")}</span>
          ${b.voucher_url ? `<a href="${esc(b.voucher_url)}" target="_blank">voucher</a>` : ""}
        </div>`).join("")
      : `<div class="muted">No online bookings yet.</div>`;
  } catch (err) {
    $("#bookings").innerHTML = `<div class="muted">${esc(err.message)}</div>`;
  }
}

async function init() {
  const form = $("#search-form");
  form.elements.checkin.value = isoDatePlus(30);
  form.elements.checkout.value = isoDatePlus(32);
  form.addEventListener("submit", searchHotels);
  $("#profile-form").addEventListener("submit", saveProfile);
  $("#call-mode").addEventListener("change", (e) => {
    state.mode = e.target.value;
    renderModeHint();
  });
  $("#api-key").addEventListener("change", (e) => {
    localStorage.setItem("stayline_api_key", e.target.value.trim());
  });
  try {
    await loadHealth();
    await loadProfile();
  } catch (err) {
    toast(err.message);
  }
  await pollCalls();
  await loadBookings();
}

window.placeCall = placeCall;
window.bookOnline = bookOnline;
window.savePhone = savePhone;
window.hangupCall = hangupCall;

init();
