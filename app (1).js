import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, sendPasswordResetEmail, signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJoxAeEX_XXSeMq8MPSa5UorjUKxAvncE",
  authDomain: "basogas-legacy.firebaseapp.com",
  projectId: "basogas-legacy",
  storageBucket: "basogas-legacy.firebasestorage.app",
  messagingSenderId: "876153529403",
  appId: "1:876153529403:web:52ef61f9b0249ebc5ce81e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23e3b83d'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
const VIDPH = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='110' viewBox='0 0 160 110'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23145b41'/%3E%3Cstop offset='1' stop-color='%239b8cff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='110' fill='url(%23g)'/%3E%3Cpath d='M64 34l40 21-40 21z' fill='white'/%3E%3C/svg%3E";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const genTitles = {"1":"Generation 1: Parents","2":"Generation 2: Children","3":"Generation 3: Grandchildren","4":"Generation 4+: Descendants"};
const GEN_COLOR = {"1":"var(--g1)","2":"var(--g2)","3":"var(--g3)","4":"var(--g4)"};
const REL_TITLE = {"1":"Parent","2":"Child","3":"Grandchild","4":"Descendant"};
const IC = n => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const genOf = m => String((m && m.generation) || "1");
const colorOf = m => GEN_COLOR[genOf(m)] || "var(--gold)";
const nextGen = g => String(Math.min(4, (parseInt(g, 10) || 1) + 1));
const byName = (a, b) => (a.name || "").localeCompare(b.name || "");

let currentUser = null, currentUserDoc = null, isRegisterMode = false;
let members = [], newPhoto = null, viewingId = null, treeMode = "branch", galFilter = "all";
const isAdmin = () => currentUserDoc && currentUserDoc.role === "admin";
const memberById = id => members.find(x => x.id === id);

// ---------- Auth ----------
$("btn-toggle-auth").addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  $("register-fields").classList.toggle("hidden", !isRegisterMode);
  $("auth-title").innerText = isRegisterMode ? "Register Family Account" : "Family Login";
  $("btn-auth-submit").innerText = isRegisterMode ? "Register" : "Sign In";
  $("btn-toggle-auth").innerText = isRegisterMode ? "Already registered? Log in" : "Need an account? Register here";
});

$("form-auth").addEventListener("submit", async e => {
  e.preventDefault();
  $("auth-msg").style.display = "none";
  const email = $("auth-email").value, password = $("auth-password").value;
  try {
    if (isRegisterMode) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, name: $("auth-name").value, email,
        role: "member", status: "pending", createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) { showAuthErr(err); }
});

const friendlyAuth = err => {
  const c = (err && err.code) || "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found")
    return "Wrong email or password. If you joined with Google, tap “Continue with Google”. Forgot your password? Tap “Forgot password?” below.";
  if (c === "auth/email-already-in-use") return "That email is already registered. Sign in instead, or tap “Continue with Google” or “Forgot password?”.";
  if (c === "auth/weak-password") return "Please choose a password with at least 6 characters.";
  if (c === "auth/invalid-email") return "That email address does not look right.";
  if (c === "auth/too-many-requests") return "Too many tries. Please wait a few minutes, or reset your password.";
  if (c === "auth/network-request-failed") return "No internet connection. Please check your data and try again.";
  if (c === "auth/unauthorized-domain") return "This website address is not allowed in Firebase yet. The administrator must add it under Authentication → Settings → Authorized domains.";
  if (c === "auth/operation-not-allowed") return "This sign-in method is switched off in Firebase. The administrator must enable it under Authentication → Sign-in method.";
  return (err && err.message) || "Something went wrong. Please try again.";
};
const showAuthErr = (err, ok) => { const m = $("auth-msg"); m.className = "msg " + (ok ? "msg-success" : "msg-error"); m.innerText = ok ? err : friendlyAuth(err); m.style.display = "block"; };
$("btn-forgot").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  if (!email) { showAuthErr({ code: "auth/invalid-email" }); return; }
  try { await sendPasswordResetEmail(auth, email); showAuthErr("A password reset link was sent to " + email + ". Check your inbox and spam folder.", true); }
  catch (err) { showAuthErr(err); }
});
$("btn-google").addEventListener("click", async () => {
  $("auth-msg").style.display = "none";
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
      try { await signInWithRedirect(auth, provider); } catch (e2) { showAuthErr(e2); }
    } else if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
      showAuthErr(err);
    }
  }
});
getRedirectResult(auth).catch(showAuthErr);

$("btn-logout").addEventListener("click", () => signOut(auth));
$("btn-logout-pending").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  currentUser = user;
  const show = (id, on) => $(id).classList.toggle("hidden", !on);
  if (!user) {
    currentUserDoc = null;
    stopLive(); show("section-auth", true); show("auth-hero", true); show("section-pending", false); show("app-content", false); show("btn-menu", false); show("fab", false);
    return;
  }
  show("section-auth", false); show("auth-hero", false);
  let snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    const viaGoogle = user.providerData.some(p => p.providerId === "google.com");
    if (!viaGoogle) return; // email registration creates its own record
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid, name: user.displayName || "", email: user.email || "",
        role: "member", status: "pending", createdAt: serverTimestamp()
      });
      snap = await getDoc(doc(db, "users", user.uid));
    } catch (err) { showAuthErr(err); show("section-auth", true); show("auth-hero", true); return; }
  }
  currentUserDoc = snap.data();
  if (currentUserDoc.status === "approved") {
    show("section-pending", false); show("app-content", true); show("btn-menu", true); show("fab", true);
    show("dr-admin", isAdmin());
    if (isAdmin()) loadPendingUsers();
    $("user-info-display").innerText = `Logged in as: ${currentUserDoc.name} (${currentUserDoc.role.toUpperCase()})`;
    resetForm();
    resetNav();
    startLive();
    showTab("home");
    await Promise.all([loadFamilyMembers(), loadEvents(), loadPhotos()]);
    fillProfile();
  } else {
    const blocked = currentUserDoc.status === "blocked";
    $("pend-title").innerText = blocked ? "Access Removed" : "Account Pending Approval";
    $("pend-text").innerText = blocked ? "An administrator has removed your access. Please contact the family administrator." : "Your registration has been submitted. An administrator must approve your account before you can access private family profiles and memories.";
    show("section-pending", true); show("app-content", false); show("btn-menu", false); show("fab", false);
  }
});

// ---------- Check in / out ----------
let unsubCi = null, ciDocs = [], unsubChat = null, chatDocs = [], chatPhoto = "", chatFirst = true;
const IMG_OK = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
const DAY_MS = 86400000;
const tmsOf = d => (d.at && d.at.toMillis) ? d.at.toMillis() : Date.now();
const clockOf = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function dayLabel(ms) {
  const d = new Date(ms), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === t.getFullYear() ? undefined : "numeric" });
}
const whenShort = ms => dayLabel(ms) + ", " + clockOf(ms);
const myUid = () => (auth.currentUser && auth.currentUser.uid) || "";
function liveErr(box, err) {
  const denied = err && err.code === "permission-denied";
  box.innerHTML = `<p style="color:#ff9a95;padding:10px 0">${denied ? "The database rules do not allow this yet. Ask the administrator to publish the updated rules." : "Could not load. Check your internet and try again."}</p>`;
}
function ciState() {
  const latest = new Map();
  for (const d of ciDocs) if (!latest.has(d.uid)) latest.set(d.uid, d);
  const now = Date.now();
  return { latest, here: [...latest.values()].filter(d => d.type === "in" && now - tmsOf(d) < DAY_MS) };
}
function renderCheckins() {
  const { latest, here } = ciState(), me = latest.get(myUid());
  const inNow = !!(me && me.type === "in" && Date.now() - tmsOf(me) < DAY_MS);
  $("ci-status").innerHTML = inNow
    ? `<div class="ci-pill on"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg> You are checked in</div><p>since ${esc(whenShort(tmsOf(me)))}${me.note ? " · " + esc(me.note) : ""}</p>`
    : `<div class="ci-pill"><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg> You are checked out</div><p>${me ? "Last seen " + esc(whenShort(tmsOf(me))) : "Tap the button below when you arrive."}</p>`;
  const btn = $("ci-btn"); btn.textContent = inNow ? "Check out" : "Check in"; btn.classList.toggle("btn-danger", inNow);
  $("ci-note-wrap").classList.toggle("hidden", inNow);
  $("ci-now").innerHTML = here.length
    ? here.map(d => `<div class="ci-row"><b>${esc(d.name || "Family")}</b><span>since ${esc(whenShort(tmsOf(d)))}${d.note ? " · " + esc(d.note) : ""}</span></div>`).join("")
    : `<p style="color:var(--muted);padding:10px 0">Nobody is checked in right now.</p>`;
  $("ci-log").innerHTML = ciDocs.slice(0, 25).map(d => `<div class="ci-row"><b>${esc(d.name || "Family")}</b><span>${d.type === "in" ? "checked in" : "checked out"}${d.note ? " · " + esc(d.note) : ""} · ${esc(whenShort(tmsOf(d)))}</span></div>`).join("") || `<p style="color:var(--muted);padding:10px 0">No activity yet.</p>`;
  $("tile-ci").textContent = here.length ? `${here.length} here now` : "Tap to check in";
}
function renderChat() {
  const box = $("chat-list"), me = myUid();
  if (!chatDocs.length) { box.innerHTML = `<p class="chat-empty">No messages yet. Say hello to the family.</p>`; return; }
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  let html = "", lastDay = "";
  for (const m of chatDocs) {
    const ms = tmsOf(m), day = dayLabel(ms), mine = m.uid === me;
    if (day !== lastDay) { html += `<div class="chat-day"><span>${esc(day)}</span></div>`; lastDay = day; }
    const photo = typeof m.photo === "string" && IMG_OK.test(m.photo) ? `<img src="${m.photo}" alt="Shared photo">` : "";
    const del = (mine || isAdmin()) ? ` · <a href="#" data-del="${esc(m.id)}">Delete</a>` : "";
    html += `<div class="chat-row${mine ? " mine" : ""}"><div class="chat-bub">${mine ? "" : `<b>${esc(m.name || "Family")}</b>`}${photo}${m.text ? `<p>${esc(m.text)}</p>` : ""}<small>${clockOf(ms)}${del}</small></div></div>`;
  }
  box.innerHTML = html;
  if (chatFirst || nearBottom) { box.scrollTop = box.scrollHeight; chatFirst = false; }
}
function showChatPrev() {
  const p = $("chat-prev");
  p.innerHTML = chatPhoto ? `<img src="${chatPhoto}" alt=""><button type="button" id="chat-prev-x" aria-label="Remove photo">×</button>` : "";
  p.classList.toggle("hidden", !chatPhoto);
}
$("chat-attach").addEventListener("click", () => $("chat-file").click());
$("chat-file").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { const url = await compressImage(f, 800); if (url.length > 600000) throw new Error("big"); chatPhoto = url; showChatPrev(); }
  catch (err) { say("chat-msg", "That photo could not be added. Try a smaller one.", false); }
});
$("chat-prev").addEventListener("click", e => { if (e.target.closest("#chat-prev-x")) { chatPhoto = ""; showChatPrev(); } });
$("chat-form").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("chat-input").value.trim();
  if (!text && !chatPhoto) return;
  const btn = $("chat-send"); btn.disabled = true; $("chat-msg").style.display = "none";
  try {
    await addDoc(collection(db, "messages"), { uid: myUid(), name: (currentUserDoc && currentUserDoc.name) || "Family", text, photo: chatPhoto, at: serverTimestamp() });
    $("chat-input").value = ""; chatPhoto = ""; showChatPrev(); chatFirst = true;
  } catch (err) {
    say("chat-msg", err.code === "permission-denied" ? "The database rules do not allow chat yet. Ask the administrator to publish the updated rules." : "Message not sent. Try again.", false);
  }
  btn.disabled = false;
});
$("chat-list").addEventListener("click", async e => {
  const a = e.target.closest("[data-del]"); if (!a) return;
  e.preventDefault();
  if (!confirm("Delete this message?")) return;
  try { await deleteDoc(doc(db, "messages", a.dataset.del)); } catch (err) { say("chat-msg", "Could not delete that message.", false); }
});
function stopLive() { if (unsubCi) unsubCi(); if (unsubChat) unsubChat(); unsubCi = unsubChat = null; ciDocs = []; chatDocs = []; }
function startLive() {
  stopLive(); chatFirst = true;
  unsubChat = onSnapshot(query(collection(db, "messages"), orderBy("at", "desc"), limit(150)),
    snap => { chatDocs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })).reverse(); renderChat(); },
    err => liveErr($("chat-list"), err));
  unsubCi = onSnapshot(query(collection(db, "checkins"), orderBy("at", "desc"), limit(80)),
    snap => { ciDocs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })); renderCheckins(); },
    err => { liveErr($("ci-now"), err); $("tile-ci").textContent = ""; });
}
$("ci-btn").addEventListener("click", async () => {
  const me = ciState().latest.get(myUid());
  const inNow = !!(me && me.type === "in" && Date.now() - tmsOf(me) < DAY_MS);
  const btn = $("ci-btn"); btn.disabled = true;
  try {
    await addDoc(collection(db, "checkins"), { uid: myUid(), name: (currentUserDoc && currentUserDoc.name) || "Family", type: inNow ? "out" : "in", note: inNow ? (me.note || "") : $("ci-note").value.trim().slice(0, 80), at: serverTimestamp() });
    $("ci-note").value = ""; $("ci-msg").style.display = "none";
  } catch (err) {
    say("ci-msg", err.code === "permission-denied" ? "The database rules do not allow check-in yet. Ask the administrator to publish the updated rules." : "Could not save. Try again.", false);
  }
  btn.disabled = false;
});

// ---------- Tabs ----------
const NAV_FOR = { "member": "tree", "add-member": "tree", "add-grandchild": "grandchildren" };
function closeDrawer() { $("drawer").classList.remove("open"); $("scrim").classList.remove("open"); }
function closeFab() { $("fab-menu").classList.remove("open"); $("fab").classList.remove("on"); }
function renderTab(tab) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  $(`section-${tab}`).classList.remove("hidden");
  document.querySelectorAll("#drawer [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === (NAV_FOR[tab] || tab)));
  closeDrawer(); closeFab();
  $("fab").classList.toggle("away", ["add-member", "add-grandchild", "chat"].includes(tab));
  window.scrollTo(0, 0);
  curTab = tab;
}
// Back button: remembers the pages you visited, works with the phone's own back button too
let navDepth = 0, navPopping = false, curTab = "home";
function updateBack() { $("back-bar").classList.toggle("hidden", navDepth <= 0 || curTab === "home"); }
window.resetNav = function () { navDepth = 0; history.replaceState({ tab: "home", n: 0 }, ""); updateBack(); };
window.goBack = function () { if (navDepth > 0) history.back(); else showTab("home"); };
window.showTab = function (tab) {
  renderTab(tab);
  if (tab === "chat") setTimeout(() => { const b = $("chat-list"); b.scrollTop = b.scrollHeight; }, 0);
  if (!navPopping) {
    const last = history.state;
    const same = last && last.tab === tab && (tab !== "member" || last.id === viewingId);
    if (!same) {
      navDepth = (last && typeof last.n === "number" ? last.n : navDepth) + 1;
      history.pushState({ tab, id: tab === "member" ? viewingId : null, n: navDepth }, "");
    }
  }
  updateBack();
};
window.addEventListener("popstate", e => {
  const st = e.state;
  if (!st || !st.tab || $("app-content").classList.contains("hidden")) return;
  navPopping = true; navDepth = st.n || 0;
  try { if (st.tab === "member" && st.id) showProfile(st.id); else showTab(st.tab); } finally { navPopping = false; }
  updateBack();
});
$("btn-menu").addEventListener("click", () => { $("drawer").classList.add("open"); $("scrim").classList.add("open"); });
$("scrim").addEventListener("click", closeDrawer);
$("drawer").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) showTab(b.dataset.tab); });
$("dr-logout").addEventListener("click", () => { closeDrawer(); signOut(auth); });
$("fab").addEventListener("click", e => { e.stopPropagation(); $("fab-menu").classList.toggle("open"); $("fab").classList.toggle("on"); });
$("fab-menu").addEventListener("click", e => {
  const b = e.target.closest("[data-fab]"); if (!b) return;
  closeFab();
  if (b.dataset.fab === "member") newMember(); else if (b.dataset.fab === "grandchild") newGrandchild(); else if (b.dataset.fab === "photo") showTab("gallery"); else showTab("events");
});
document.addEventListener("click", e => { if (!e.target.closest("#fab") && !e.target.closest("#fab-menu")) closeFab(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDrawer(); closeFab(); } });

// ---------- Image helpers ----------
function compressImage(file, max = 500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function videoPoster(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = fn => v => { URL.revokeObjectURL(url); fn(v); };
    const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error("poster timeout")); }, 8000);
    v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
    v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (e) { reject(e); } };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        const s = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.7));
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    v.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error("video error")); };
  });
}

function say(id, text, ok = true) {
  const m = $(id);
  m.className = "msg " + (ok ? "msg-success" : "msg-error");
  m.innerText = text; m.style.display = "block";
}
const flash = (t, ok = true) => say("member-msg", t, ok);

// ---------- Family helpers ----------
function descendantsOf(id) {
  const out = new Set(), q = [id];
  while (q.length) {
    const cur = q.shift();
    members.forEach(m => { if (m.parentId === cur && !out.has(m.id)) { out.add(m.id); q.push(m.id); } });
  }
  return out;
}
const childrenOf = id => members.filter(m => m.parentId === id).sort(byName);
function siblingsOf(m) {
  return members.filter(x => x.id !== m.id && (x.parentId || "") === (m.parentId || "") && (m.parentId || genOf(x) === genOf(m))).sort(byName);
}

// ---------- Member form ----------
function fillParentSelect(excludeId, selected) {
  const bad = excludeId ? new Set([excludeId, ...descendantsOf(excludeId)]) : new Set();
  const opts = members.filter(m => !bad.has(m.id)).sort((a, b) => genOf(a).localeCompare(genOf(b)) || byName(a, b));
  $("member-parent").innerHTML = `<option value="">— No parent / top of the family —</option>` +
    opts.map(m => `<option value="${esc(m.id)}">${esc(m.name)} (Gen ${esc(genOf(m))})</option>`).join("");
  $("member-parent").value = selected || "";
}

$("member-parent").addEventListener("change", () => {
  const p = memberById($("member-parent").value);
  if (!p) return;
  const g = nextGen(genOf(p));
  $("member-generation").value = g;
  if (!$("member-relationship").value.trim()) $("member-relationship").value = REL_TITLE[g] || "";
});

const onPhoto = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    newPhoto = await compressImage(file);
    $("member-photo-preview").src = newPhoto;
  } catch { flash("Could not read that photo. Try another.", false); }
  e.target.value = "";
};
["member-photo-input", "member-photo-camera"].forEach(id => $(id).addEventListener("change", onPhoto));

function resetForm() {
  $("form-member").reset();
  $("member-id").value = "";
  newPhoto = null;
  $("member-photo-preview").src = AVATAR;
  $("member-form-title").innerText = "Add Family Member";
  $("btn-save-member").innerText = "Save Family Member";
  $("btn-delete-member").classList.add("hidden");
  fillParentSelect(null, "");
}

function editMember(id) {
  const m = memberById(id);
  if (!m) return;
  resetForm();
  $("member-msg").style.display = "none";
  $("member-id").value = id;
  fillParentSelect(id, m.parentId || "");
  $("member-name").value = m.name || "";
  $("member-generation").value = genOf(m);
  $("member-relationship").value = m.relationship || "";
  $("member-dob").value = m.dob || "";
  $("member-bio").value = m.bio || "";
  $("member-photo-preview").src = m.photo || AVATAR;
  $("member-form-title").innerText = "Edit Profile / Change Photo";
  $("btn-save-member").innerText = "Save Changes";
  $("btn-delete-member").classList.toggle("hidden", !isAdmin());
  showTab("add-member");
}

window.newMember = function (parentId) {
  const pp = typeof parentId === "string" ? memberById(parentId) : null;
  if (pp && genOf(pp) === "2") { newGrandchild(pp.id); return; }
  resetForm();
  $("member-msg").style.display = "none";
  const p = typeof parentId === "string" ? memberById(parentId) : null;
  if (p) {
    const g = nextGen(genOf(p));
    $("member-parent").value = p.id;
    $("member-generation").value = g;
    $("member-relationship").value = REL_TITLE[g] || "";
    $("member-form-title").innerText = `Add a child of ${p.name}`;
  }
  showTab("add-member");
};

$("btn-cancel-edit").addEventListener("click", () => {
  const id = $("member-id").value;
  $("member-msg").style.display = "none";
  if (id) showProfile(id); else showTab("tree");
});

$("form-member").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("member-id").value;
  const parentId = $("member-parent").value;
  const parent = memberById(parentId);
  const generation = parent ? nextGen(genOf(parent)) : $("member-generation").value;
  const data = {
    name: $("member-name").value.trim(),
    generation,
    parentId: parentId || "",
    relationship: $("member-relationship").value.trim() || REL_TITLE[generation] || "",
    dob: $("member-dob").value,
    bio: $("member-bio").value.trim()
  };
  try {
    let savedId = id;
    if (id) {
      if (newPhoto) data.photo = newPhoto;
      data.updatedBy = currentUser.uid;
      data.updatedAt = serverTimestamp();
      await updateDoc(doc(db, "members", id), data);
    } else {
      const ref = await addDoc(collection(db, "members"), {
        ...data, photo: newPhoto || "",
        createdBy: currentUser.uid, createdByName: currentUserDoc.name || "",
        createdAt: serverTimestamp()
      });
      savedId = ref.id;
    }
    await loadFamilyMembers();
    resetForm();
    showProfile(savedId);
  } catch (err) { flash("Error saving profile: " + err.message, false); }
});

async function deleteMember(id) {
  if (!isAdmin()) return;
  const m = memberById(id);
  const kids = childrenOf(id);
  const note = kids.length ? ` Their ${kids.length} child(ren) will move up to ${m && m.parentId ? "their grandparent" : "the top level"}.` : "";
  if (!confirm(`Permanently delete ${m ? m.name : "this member"}? This cannot be undone.${note}`)) return;
  try {
    for (const k of kids) await updateDoc(doc(db, "members", k.id), { parentId: (m && m.parentId) || "" });
    await deleteDoc(doc(db, "members", id));
    resetForm();
    await loadFamilyMembers();
    showTab("tree");
  } catch (err) { alert("Could not delete: " + err.message); }
}
$("btn-delete-member").addEventListener("click", () => deleteMember($("member-id").value));

// ---------- Tree ----------
async function loadFamilyMembers() {
  const snap = await getDocs(collection(db, "members"));
  members = [];
  snap.forEach(d => members.push({ id: d.id, ...d.data() }));
  render();
}

function cardHTML(m, row) {
  const kids = childrenOf(m.id).length;
  const par = memberById(m.parentId);
  const sub = row
    ? `${esc(m.relationship || REL_TITLE[genOf(m)] || "")}${kids ? ` • ${kids} child${kids > 1 ? "ren" : ""}` : ""}`
    : esc(m.relationship || "");
  return `<div class="member-card${row ? " row" : ""}" data-id="${esc(m.id)}" style="--c:${colorOf(m)}">
    <img src="${esc(m.photo || AVATAR)}" alt="">
    <div><div class="name">${esc(m.name)}</div>
    <div class="rel">${sub}</div>
    ${!row && par ? `<div class="rel">child of ${esc(par.name)}</div>` : ""}
    ${!row && kids ? `<div class="rel">${kids} child${kids > 1 ? "ren" : ""}</div>` : ""}
    <div class="tap">Open profile</div></div>
  </div>`;
}

function branchHTML(m, seen) {
  if (seen.has(m.id)) return "";
  seen.add(m.id);
  const kids = childrenOf(m.id);
  return `<div class="branch" style="--c:${colorOf(m)}">${cardHTML(m, true)}${kids.length ? `<div class="kids">${kids.map(k => branchHTML(k, seen)).join("")}</div>` : ""}</div>`;
}

function render() {
  const tree = $("tree-container");
  const term = $("tree-search").value.trim().toLowerCase();
  if (!members.length) {
    tree.innerHTML = `<div class="card"><p style="color:var(--muted)">No family members yet. Tap "+ Add Family Member" to start the tree.</p></div>`;
  } else if (term) {
    const hits = members.filter(m => (m.name || "").toLowerCase().includes(term)).sort(byName);
    tree.innerHTML = hits.length ? `<div class="member-grid">${hits.map(m => cardHTML(m, false)).join("")}</div>` : `<p style="color:var(--muted)">No one matches “${esc(term)}”.</p>`;
  } else if (treeMode === "gen") {
    tree.innerHTML = ["1", "2", "3", "4"].map(gen => {
      const group = members.filter(m => genOf(m) === gen).sort(byName);
      if (!group.length) return "";
      return `<div class="tree-group"><div class="tree-title" style="--c:${GEN_COLOR[gen]}">${genTitles[gen]} (${group.length})</div><div class="member-grid">${group.map(m => cardHTML(m, false)).join("")}</div></div>`;
    }).join("");
  } else {
    const seen = new Set();
    const ids = new Set(members.map(m => m.id));
    const roots = members.filter(m => !m.parentId || !ids.has(m.parentId)).sort((a, b) => genOf(a).localeCompare(genOf(b)) || byName(a, b));
    let html = roots.map(r => branchHTML(r, seen)).join("");
    members.filter(m => !seen.has(m.id)).forEach(m => { html += branchHTML(m, seen); });
    tree.innerHTML = html;
  }
  fillMemberSelect(); fillTagSelect(); renderPeople(); updateHome();
  if (viewingId && !$("section-member").classList.contains("hidden")) showProfile(viewingId);
}
$("tree-search").addEventListener("input", render);
$("tree-mode").addEventListener("click", e => {
  const b = e.target.closest("[data-mode]");
  if (!b) return;
  treeMode = b.dataset.mode;
  $("tree-mode").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  render();
});

// ---------- Children & Grandchildren pages ----------
function renderPeople() {
  [["2", "list-children", "count-children", "No children added yet. Tap “+ Add child”."],
   ["3", "list-grandchildren", "count-grandchildren", "No grandchildren added yet. Tap “+ Add grandchild” and choose the parent."]].forEach(([gen, boxId, countId, empty]) => {
    const list = members.filter(m => genOf(m) === gen);
    $(countId).innerText = list.length;
    if (!list.length) { $(boxId).innerHTML = `<div class="card"><p class="empty">${empty}</p></div>`; return; }
    const groups = new Map();
    list.forEach(m => { const k = memberById(m.parentId) ? m.parentId : ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    const keys = [...groups.keys()].sort((a, b) => (a ? memberById(a).name : "~").localeCompare(b ? memberById(b).name : "~"));
    $(boxId).innerHTML = keys.map(k => {
      const p = memberById(k);
      const title = p ? `${gen === "2" ? "Children" : "Grandchildren"} of ${esc(p.name)}` : (gen === "2" ? "Children (parent not set)" : "Grandchildren (parent not set)");
      return `<div class="tree-group"><div class="tree-title" style="--c:${GEN_COLOR[gen]}">${title} (${groups.get(k).length})</div><div class="member-grid">${groups.get(k).sort(byName).map(m => cardHTML(m, false)).join("")}</div></div>`;
    }).join("");
  });
}
window.newMemberGen = g => {
  if (g === "3") { newGrandchild(); return; }
  newMember();
  $("member-generation").value = g;
  $("member-relationship").value = REL_TITLE[g] || "";
  $("member-form-title").innerText = g === "2" ? "Add a child" : "Add a grandchild";
};

// ---------- Grandchild form ----------
let gcPhoto = null;
function fillGcParents(sel) {
  const kids = members.filter(m => genOf(m) === "2").sort(byName);
  $("gc-parent").innerHTML = `<option value="">— Choose the parent —</option>` + kids.map(k => `<option value="${esc(k.id)}">${esc(k.name)}</option>`).join("");
  $("gc-parent").value = sel || "";
  $("gc-none").classList.toggle("hidden", kids.length > 0);
}
window.newGrandchild = parentId => {
  $("form-grandchild").reset(); gcPhoto = null;
  $("gc-preview").src = AVATAR; $("gc-msg").style.display = "none";
  fillGcParents(typeof parentId === "string" ? parentId : "");
  showTab("add-grandchild");
};
["gc-photo-file", "gc-photo-cam"].forEach(id => $(id).addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { gcPhoto = await compressImage(f, 500); $("gc-preview").src = gcPhoto; }
  catch { say("gc-msg", "Could not read that photo. Try another.", false); }
}));
$("gc-cancel").addEventListener("click", () => showTab("grandchildren"));
$("form-grandchild").addEventListener("submit", async e => {
  e.preventDefault();
  const parent = memberById($("gc-parent").value);
  if (!parent) { say("gc-msg", "Please choose the parent first.", false); return; }
  try {
    const ref = await addDoc(collection(db, "members"), {
      name: $("gc-name").value.trim(), generation: "3", parentId: parent.id,
      relationship: $("gc-rel").value, dob: $("gc-dob").value,
      otherParent: $("gc-other").value.trim(), bio: $("gc-bio").value.trim(), photo: gcPhoto || "",
      createdBy: currentUser.uid, createdByName: currentUserDoc.name || "", createdAt: serverTimestamp()
    });
    await loadFamilyMembers();
    showProfile(ref.id);
  } catch (err) { say("gc-msg", "Could not save: " + err.message, false); }
});

// ---------- Member profile page ----------
function chipHTML(m) {
  return `<button type="button" class="chip" data-open="${esc(m.id)}" style="--c:${colorOf(m)}"><img src="${esc(m.photo || AVATAR)}" alt=""><span>${esc(m.name)}</span></button>`;
}
function section(title, arr) {
  return arr.length ? `<div class="sect-t">${title} (${arr.length})</div><div class="chips">${arr.map(chipHTML).join("")}</div>` : "";
}
function ageText(dob) {
  if (!dob) return "";
  const d = new Date(dob); if (isNaN(d)) return esc(dob);
  const t = new Date(); let a = t.getFullYear() - d.getFullYear();
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--;
  return `${esc(dob)}${a >= 0 ? ` (${a} yrs)` : ""}`;
}

function showProfile(id) {
  const m = memberById(id);
  if (!m) { showTab("tree"); return; }
  viewingId = id;
  const c = colorOf(m);
  const par = memberById(m.parentId);
  const kids = childrenOf(id);
  const grand = kids.flatMap(k => childrenOf(k.id));
  const sibs = siblingsOf(m);
  const tagged = photos.filter(p => p.memberId === id);
  $("mv-card").style.setProperty("--c", c);
  $("mv-body").innerHTML = `
    <div class="pv-hero">
      <img class="big" src="${esc(m.photo || AVATAR)}" alt="">
      <h2>${esc(m.name)}</h2>
      <span class="pill" style="--c:${c}">${esc(m.relationship || REL_TITLE[genOf(m)] || "Family")}</span>
      <span class="pill" style="--c:${c};opacity:.8">${esc(genTitles[genOf(m)] || "")}</span>
    </div>
    <div class="btn-row">
      <button type="button" class="btn-secondary" data-act="photo-file">${IC("folder")} Change photo</button>
      <button type="button" class="btn-secondary" data-act="photo-cam">${IC("camera")} Take photo</button>
    </div>
    <div class="btn-row">
      <button type="button" data-act="edit">${IC("pencil")} Edit details</button>
      <button type="button" data-act="addchild">＋ ${genOf(m) === "2" ? "Add grandchild" : "Add child"}</button>
    </div>
    ${m.dob ? `<div class="pv-row">${IC("cake")} Born: <b>${ageText(m.dob)}</b></div>` : ""}
    ${par ? `<div class="pv-row">Child of: <b>${esc(par.name)}</b></div>` : ""}
    ${m.otherParent ? `<div class="pv-row">Other parent: <b>${esc(m.otherParent)}</b></div>` : ""}
    ${m.createdByName ? `<div class="pv-row">Added by ${esc(m.createdByName)}</div>` : ""}
    ${m.bio ? `<div class="pv-bio">${esc(m.bio)}</div>` : `<div class="pv-bio" style="color:var(--muted)">No biography yet. Tap “Edit details” to add one.</div>`}
    ${section("Parent", par ? [par] : [])}
    ${section("Brothers &amp; sisters", sibs)}
    ${section("Children", kids)}
    ${section("Grandchildren", grand)}
    ${tagged.length ? `<div class="sect-t">Photos &amp; videos with ${esc(m.name.split(" ")[0])}</div><div class="thumbs">${tagged.map(p => `<img src="${esc(p.photo || VIDPH)}" data-photo="${esc(p.id)}" alt="">`).join("")}</div>` : ""}
    <button type="button" class="btn-secondary" data-act="back" style="margin-top:20px">← Back to the Tree</button>
    ${isAdmin() ? `<button type="button" class="btn-danger" data-act="delete">Delete this member (Admin)</button>` : ""}`;
  showTab("member");
}

$("mv-body").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || !viewingId) return;
  const a = b.dataset.act;
  if (a === "photo-file") $("mv-photo-file").click();
  else if (a === "photo-cam") $("mv-photo-cam").click();
  else if (a === "edit") editMember(viewingId);
  else if (a === "addchild") newMember(viewingId);
  else if (a === "back") showTab("tree");
  else if (a === "delete") deleteMember(viewingId);
});
["mv-photo-file", "mv-photo-cam"].forEach(id => $(id).addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f || !viewingId) return;
  try {
    const photo = await compressImage(f, 500);
    await updateDoc(doc(db, "members", viewingId), { photo, updatedBy: currentUser.uid, updatedAt: serverTimestamp() });
    await loadFamilyMembers();
  } catch (err) { alert("Could not change the photo: " + err.message); }
}));

// One click handler for cards, relative chips and admin buttons
document.addEventListener("click", e => {
  const open = e.target.closest("[data-open]");
  if (open) { showProfile(open.dataset.open); return; }
  const card = e.target.closest(".member-card[data-id]");
  if (card) showProfile(card.dataset.id);
});

// ---------- Admin: approvals ----------
async function loadPendingUsers() {
  if (!isAdmin()) return;
  const list = $("admin-user-list");
  const snap = await getDocs(collection(db, "users"));
  const users = [];
  snap.forEach(d => users.push(d.data()));
  const order = { pending: 0, approved: 1, blocked: 2 };
  users.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (a.name || "").localeCompare(b.name || ""));
  pendingCount = users.filter(u => u.status === "pending").length;
  const COL = { pending: "var(--violet)", approved: "var(--teal)", blocked: "var(--danger)" };
  list.innerHTML = users.length ? users.map(u => {
    const self = currentUser && u.uid === currentUser.uid;
    const btns = self ? `<p class="em" style="margin-top:8px">This is you.</p>` : `<div class="btn-row">
      ${u.status !== "approved" ? `<button type="button" data-uact="approve" data-uid="${esc(u.uid)}">Approve</button>` : `<button type="button" class="btn-secondary" data-uact="block" data-uid="${esc(u.uid)}">Block</button>`}
      ${u.status === "approved" ? `<button type="button" class="btn-secondary" data-uact="${u.role === "admin" ? "member" : "admin"}" data-uid="${esc(u.uid)}">${u.role === "admin" ? "Make member" : "Make admin"}</button>` : ""}
      <button type="button" class="btn-danger" data-uact="remove" data-uid="${esc(u.uid)}">Remove</button></div>`;
    return `<div class="ucard" style="--c:${COL[u.status] || "var(--border)"}">
      <div class="row"><div><b>${esc(u.name || "Unnamed")}</b><div class="em">${esc(u.email)}</div></div>
      <span class="pill" style="--c:${COL[u.status] || "var(--border)"}">${esc((u.status || "").toUpperCase())}${u.role === "admin" ? " • ADMIN" : ""}</span></div>${btns}</div>`;
  }).join("") : `<p style="color:var(--muted)">No registered accounts yet.</p>`;
  updateHome();
}
$("admin-user-list").addEventListener("click", async e => {
  const b = e.target.closest("[data-uact]");
  if (!b || !isAdmin()) return;
  const uid = b.dataset.uid, act = b.dataset.uact;
  if (!uid || uid === currentUser.uid) return;
  try {
    if (act === "approve") await updateDoc(doc(db, "users", uid), { status: "approved" });
    else if (act === "block") { if (!confirm("Block this person? They will lose access until you approve them again.")) return; await updateDoc(doc(db, "users", uid), { status: "blocked" }); }
    else if (act === "admin") { if (!confirm("Make this person an administrator? Admins can delete members and manage accounts.")) return; await updateDoc(doc(db, "users", uid), { role: "admin" }); }
    else if (act === "member") await updateDoc(doc(db, "users", uid), { role: "member" });
    else if (act === "remove") { if (!confirm("Remove this registered account permanently? Use Block instead if you may want them back.")) return; await deleteDoc(doc(db, "users", uid)); }
    loadPendingUsers();
  } catch (err) { alert("Could not do that: " + err.message); }
});

// ---------- Seed the 11 children (admin, safe to press repeatedly) ----------
const CHILDREN = ["Kisira Habert","Namuhanga Juliet","Walusansa Susan","Namaganda Lydia","Namatende Hellen","Wambuzi Benard","Naisamula Miria","Nakisige Brenda","Basoga Andrew","Mugonyi Edrine Dickson","Namuyonjo Abel Nelson"];
$("btn-seed").addEventListener("click", async () => {
  if (!isAdmin()) return;
  let added = 0;
  for (const name of CHILDREN) {
    const id = "child-" + name.toLowerCase().replace(/\s+/g, "-");
    const ref = doc(db, "members", id);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, { name, generation: "2", parentId: "", relationship: "Child", dob: "", bio: "", photo: "", createdBy: currentUser.uid, createdAt: serverTimestamp() });
    added++;
  }
  $("seed-msg").innerText = added ? `${added} members added.` : "All 11 are already in the Tree.";
  loadFamilyMembers();
});

// ---------- Events ----------
let events = [];
async function loadEvents() {
  const snap = await getDocs(collection(db, "events"));
  events = [];
  snap.forEach(d => events.push({ id: d.id, ...d.data() }));
  events.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  $("event-list").innerHTML = events.length ? events.map(ev => `
    <div class="ev">
      <div class="t">${esc(ev.title)}</div>
      <div class="d">${IC("calendar")} ${esc(ev.date)}${ev.place ? " • " + IC("pin") + " " + esc(ev.place) : ""}${ev.byName ? " • added by " + esc(ev.byName) : ""}</div>
      <div>${esc(ev.details)}</div>
      ${isAdmin() ? `<button class="btn-danger" data-delev="${esc(ev.id)}">Delete</button>` : ""}
    </div>`).join("") : `<p style="color:var(--muted)">No events yet. Add the first one above.</p>`;
  updateHome();
}
$("form-event").addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("event-msg");
  try {
    await addDoc(collection(db, "events"), {
      title: $("ev-title").value.trim(), date: $("ev-date").value, place: $("ev-place").value.trim(),
      details: $("ev-details").value.trim(), by: currentUser.uid, byName: currentUserDoc.name || "", createdAt: serverTimestamp()
    });
    $("form-event").reset();
    m.className = "msg msg-success"; m.innerText = "Event added!"; m.style.display = "block";
    loadEvents();
  } catch (err) { m.className = "msg msg-error"; m.innerText = err.message; m.style.display = "block"; }
});
$("event-list").addEventListener("click", async e => {
  const id = e.target.dataset.delev;
  if (!id || !isAdmin() || !confirm("Delete this event?")) return;
  await deleteDoc(doc(db, "events", id));
  loadEvents();
});

// ---------- Home dashboard ----------
let photos = [], pendingCount = 0;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function nextBirthdays() {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return members.filter(m => /^\d{4}-\d{2}-\d{2}$/.test(m.dob || "")).map(m => {
    const [y, mo, d] = m.dob.split("-").map(Number);
    let next = new Date(t.getFullYear(), mo - 1, d);
    if (next < t) next = new Date(t.getFullYear() + 1, mo - 1, d);
    return { m, days: Math.round((next - t) / 864e5), age: next.getFullYear() - y, mo, d };
  }).sort((a, b) => a.days - b.days).slice(0, 5);
}
const ago = s => { const d = Math.floor((Date.now() / 1000 - s) / 86400); return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? d + " days ago" : Math.floor(d / 30) + " mo ago"; };
$("home-search").addEventListener("input", () => {
  const q = $("home-search").value.trim().toLowerCase(), box = $("home-search-res");
  if (!q) { box.innerHTML = ""; return; }
  const hits = members.filter(m => (m.name || "").toLowerCase().includes(q)).sort(byName).slice(0, 8);
  box.innerHTML = hits.length ? hits.map(chipHTML).join("") : `<p class="empty">No one matches “${esc(q)}”.</p>`;
});
function updateHome() {
  if (!currentUserDoc) return;
  $("st-members").innerText = members.length;
  $("st-kids").innerText = members.filter(m => genOf(m) === "2").length;
  $("st-grand").innerText = members.filter(m => genOf(m) === "3").length;
  $("st-events").innerText = events.length;
  $("st-photos").innerText = photos.length;
  $("st-pending-box").classList.toggle("hidden", !isAdmin());
  $("st-pending").innerText = pendingCount;
  const hr = new Date().getHours();
  $("home-greet").innerText = (hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening") + (isAdmin() ? " • Admin" : "");

  const t = new Date(); t.setHours(0, 0, 0, 0);
  const upcoming = events.map(e => ({ e, days: Math.round((new Date((e.date || "") + "T00:00:00") - t) / 864e5) }))
    .filter(x => !isNaN(x.days) && x.days >= 0).sort((a, b) => a.days - b.days)[0];
  $("home-next").innerHTML = upcoming ? `<div class="next">
      <div class="days"><b>${upcoming.days === 0 ? "Today" : upcoming.days}</b><span>${upcoming.days === 0 ? "" : upcoming.days === 1 ? "day to go" : "days to go"}</span></div>
      <div class="info"><b>${esc(upcoming.e.title)}</b><div>${IC("calendar")} ${esc(upcoming.e.date)}</div>${upcoming.e.place ? `<div>${IC("pin")} ${esc(upcoming.e.place)}</div>` : ""}</div>
    </div>` : `<p class="empty">No upcoming events yet. Tap “Add event” to plan the next family gathering.</p>`;

  const bds = nextBirthdays();
  $("home-bdays").innerHTML = bds.length ? bds.map(x => `
    <div class="bd" data-open="${esc(x.m.id)}" style="--c:${colorOf(x.m)}">
      <img src="${esc(x.m.photo || AVATAR)}" alt="">
      <div class="t">${esc(x.m.name)}<small>${x.d} ${MONTHS[x.mo - 1]} • turns ${x.age}</small></div>
      <span class="when">${x.days === 0 ? "Today" : x.days === 1 ? "Tomorrow" : "in " + x.days + " d"}</span>
    </div>`).join("") : `<p class="empty">Add dates of birth on member profiles and birthdays will show here.</p>`;

  const counts = ["1", "2", "3", "4"].map(g => members.filter(m => genOf(m) === g).length);
  const max = Math.max(1, ...counts);
  $("home-gen").innerHTML = members.length ? ["1", "2", "3", "4"].map((g, i) => `
    <div class="bar" style="--c:${GEN_COLOR[g]}"><span class="lbl">${esc(genTitles[g].split(": ")[1])}</span>
    <span class="track"><i style="width:${counts[i] ? Math.max(6, counts[i] / max * 100) : 0}%"></i></span><span class="n">${counts[i]}</span></div>`).join("")
    : `<p class="empty">Your family tree is empty. Add the first member.</p>`;

  const acts = [];
  members.forEach(m => m.createdAt?.seconds && acts.push({ t: m.createdAt.seconds, icon: IC("users"), open: m.id, text: m.createdByName ? `${esc(m.createdByName)} added <b>${esc(m.name)}</b> to the tree` : `<b>${esc(m.name)}</b> joined the tree` }));
  photos.forEach(p => p.createdAt?.seconds && acts.push({ t: p.createdAt.seconds, icon: p.card ? IC("gift") : IC("camera"), photo: p.id, text: `${esc(p.byName || "Someone")} ${p.card ? "made a card" : "shared a photo"}` }));
  events.forEach(e => e.createdAt?.seconds && acts.push({ t: e.createdAt.seconds, icon: IC("calendar"), text: `${esc(e.byName || "Someone")} planned <b>${esc(e.title)}</b>` }));
  acts.sort((a, b) => b.t - a.t);
  $("home-activity").innerHTML = acts.length ? acts.slice(0, 6).map(a => `<div class="act"${a.open ? ` data-open="${esc(a.open)}"` : a.photo ? ` data-photo="${esc(a.photo)}"` : ""}><span class="ic">${a.icon}</span><div>${a.text}<small>${ago(a.t)}</small></div></div>`).join("")
    : `<p class="empty">Nothing yet. Activity from the whole family shows here.</p>`;

  const newest = [...members].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 6);
  $("home-newest").innerHTML = newest.length ? newest.map(chipHTML).join("") : `<p class="empty">No members yet.</p>`;

  $("home-recent").innerHTML = photos.length
    ? photos.slice(0, 7).map(p => `<img src="${esc(p.photo || VIDPH)}" data-photo="${esc(p.id)}" alt="">`).join("")
    : `<p class="empty" style="grid-column:1/-1">No photos yet. Add the first family memory.</p>`;
}

// ---------- Gallery: photos & videos from device or camera ----------
function fillTagSelect() {
  const sel = $("gal-tag"), cur = sel.value;
  sel.innerHTML = `<option value="">— Nobody in particular —</option>` + [...members].sort(byName).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
  sel.value = cur;
}

async function loadPhotos() {
  const snap = await getDocs(collection(db, "photos"));
  photos = [];
  snap.forEach(d => photos.push({ id: d.id, ...d.data() }));
  photos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  renderGallery();
  updateHome();
}

function renderGallery() {
  const list = photos.filter(p => galFilter === "all" || (galFilter === "video" ? p.type === "video" : p.type !== "video"));
  $("photo-grid").innerHTML = list.length ? list.map(p => {
    const vid = p.type === "video";
    const who = p.memberId && memberById(p.memberId) ? memberById(p.memberId).name : "";
    return `<div class="member-card" data-photo="${esc(p.id)}" style="--c:${vid ? "var(--violet)" : "var(--sky)"}">
      <div class="thumb${vid && !p.photo ? " vid" : ""}">
        ${p.photo ? `<img class="wide" src="${esc(p.photo)}" alt="">` : ""}
        ${vid ? `<span class="play">▶</span>` : ""}
      </div>
      <div class="name">${esc(p.caption || "")}</div>
      <div class="rel">${esc(p.byName || "")}${who ? " • " + esc(who) : ""}</div>
    </div>`;
  }).join("") : `<p style="color:var(--muted)">Nothing here yet. Add the first one!</p>`;
}

async function uploadMedia(files) {
  const m = $("gal-msg");
  m.className = "msg msg-success"; m.style.display = "block";
  let n = 0, ok = 0;
  const baseMeta = () => ({
    caption: $("gal-caption").value.trim(), memberId: $("gal-tag").value,
    by: currentUser.uid, byName: currentUserDoc.name || "", createdAt: serverTimestamp()
  });
  for (const f of files) {
    n++;
    const label = `Uploading ${n} of ${files.length}`;
    m.className = "msg msg-success"; m.innerText = label + "...";
    try {
      if (f.type.startsWith("image/")) {
        const photo = await compressImage(f, 900);
        await addDoc(collection(db, "photos"), { ...baseMeta(), type: "image", photo });
      } else continue;
      ok++;
    } catch (err) {
      m.className = "msg msg-error";
      m.innerText = "Upload failed: " + (err.message || err);
      if (ok) loadPhotos();
      return;
    }
  }
  m.className = "msg msg-success";
  m.innerText = `${ok} item(s) added!`;
  $("gal-caption").value = "";
  loadPhotos();
}
["gal-file", "gal-cam"].forEach(id => $(id).addEventListener("change", e => {
  const files = [...e.target.files];
  e.target.value = "";
  if (files.length) uploadMedia(files);
}));

// ---------- Lightbox ----------
function closeLightbox() {
  const v = $("lb-vid"); v.pause(); v.removeAttribute("src"); v.load();
  $("lightbox").classList.add("hidden");
}
document.addEventListener("click", e => {
  const ph = e.target.closest("[data-photo]");
  if (!ph) return;
  const p = photos.find(x => x.id === ph.dataset.photo);
  if (!p) return;
  const vid = p.type === "video";
  $("lb-img").classList.toggle("hidden", vid);
  $("lb-vid").classList.toggle("hidden", !vid);
  if (vid) { $("lb-vid").src = p.videoUrl; $("lb-vid").poster = p.photo || ""; } else { $("lb-img").src = p.photo; }
  const who = p.memberId && memberById(p.memberId) ? memberById(p.memberId).name : "";
  $("lb-cap").innerText = [p.caption, who && "with " + who, p.byName && "— " + p.byName].filter(Boolean).join(" ");
  $("lb-del").classList.toggle("hidden", !(isAdmin() || p.by === currentUser.uid));
  $("lb-del").dataset.id = p.id;
  $("lightbox").classList.remove("hidden");
});
$("lb-close").addEventListener("click", closeLightbox);
$("lb-del").addEventListener("click", async () => {
  if (!confirm("Delete this item?")) return;
  const p = photos.find(x => x.id === $("lb-del").dataset.id);
  try {
    await deleteDoc(doc(db, "photos", $("lb-del").dataset.id));
  } catch (err) { alert(err.message); return; }
  closeLightbox();
  await loadPhotos();
  if (viewingId && !$("section-member").classList.contains("hidden")) showProfile(viewingId);
});

// ---------- Create a family card (generated image) ----------
const THEMES = { gold: ["#0b3d28", "#1f8a62", "#f6d36b"], sunset: ["#ff7a59", "#8e3fa8", "#fff1c9"], ocean: ["#0a2a5e", "#1fb5c9", "#ffe9a8"], royal: ["#2b1b6b", "#9b8cff", "#ffd86b"] };
let cmImg = null;
function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
  const words = text.split(/\s+/).filter(Boolean); let line = "", lines = 0;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; if (++lines >= maxLines) return y; }
    else line = t;
  }
  if (line && lines < maxLines) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
function drawCard() {
  const cv = $("cm-canvas"), ctx = cv.getContext("2d"), S = 900;
  const [a, b, acc] = THEMES[$("cm-theme").value] || THEMES.gold;
  const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = .12; ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(790, 110, 220, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(90, 830, 260, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.strokeRect(28, 28, S - 56, S - 56);
  const cx = 450, cy = 290, r = 170;
  if (cmImg) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
    const sc = Math.max(2 * r / cmImg.width, 2 * r / cmImg.height), w = cmImg.width * sc, h = cmImg.height * sc;
    ctx.drawImage(cmImg, cx - w / 2, cy - h / 2, w, h); ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(cx - 80, cy - 80); ctx.scale(160 / 24, 160 / 24); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(new Path2D("M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z M12 19v3")); ctx.restore();
  }
  ctx.lineWidth = 8; ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
  ctx.fillStyle = "#fff"; ctx.font = "bold 66px Georgia, serif";
  let y = wrapText(ctx, $("cm-title").value || " ", 450, 570, 760, 76, 2);
  ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.font = "38px Georgia, serif";
  wrapText(ctx, $("cm-msg").value, 450, y + 14, 740, 52, 4);
  ctx.fillStyle = acc; ctx.font = "bold 28px 'Segoe UI', sans-serif";
  ctx.fillText("BASOGA'S LEGACY", 450, 846);
}
$("btn-open-cm").addEventListener("click", () => { $("card-maker").classList.remove("hidden"); drawCard(); $("card-maker").scrollIntoView({ behavior: "smooth" }); });
$("btn-cm-close").addEventListener("click", () => $("card-maker").classList.add("hidden"));
["cm-title", "cm-msg", "cm-theme"].forEach(id => $(id).addEventListener("input", drawCard));
["cm-photo", "cm-photo-cam"].forEach(id => $(id).addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { cmImg = await loadImg(await compressImage(f, 700)); drawCard(); } catch { say("gal-msg", "Could not read that photo.", false); }
}));
$("btn-cm-save").addEventListener("click", async () => {
  try {
    let photo = $("cm-canvas").toDataURL("image/jpeg", 0.85);
    if (photo.length > 900000) photo = $("cm-canvas").toDataURL("image/jpeg", 0.65);
    await addDoc(collection(db, "photos"), {
      type: "image", card: true, photo, caption: $("cm-title").value.trim(), memberId: $("gal-tag").value,
      by: currentUser.uid, byName: currentUserDoc.name || "", createdAt: serverTimestamp()
    });
    say("gal-msg", "Card saved to the gallery!");
    $("card-maker").classList.add("hidden");
    loadPhotos();
  } catch (err) { say("gal-msg", "Could not save the card: " + err.message, false); }
});

// ---------- My Profile ----------
let pfPhoto = null;
function fillProfile() {
  const u = currentUserDoc;
  $("pf-name").value = u.name || ""; $("pf-phone").value = u.phone || ""; $("pf-bio").value = u.bio || "";
  $("pf-preview").src = u.photo || AVATAR; pfPhoto = null;
  $("pf-member").value = u.memberId || "";
  $("home-name").innerText = u.name || "Family"; $("home-avatar").src = u.photo || AVATAR;
  $("dr-name").innerText = u.name || "Family"; $("dr-avatar").src = u.photo || AVATAR; $("dr-role").innerText = (u.role || "member").toUpperCase();
  $("user-info-display").innerText = `${u.email} • ${(u.role || "member").toUpperCase()}`;
}
function fillMemberSelect() {
  const sel = $("pf-member"), cur = (currentUserDoc && currentUserDoc.memberId) || sel.value;
  sel.innerHTML = `<option value="">— Not linked —</option>` + [...members].sort(byName).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
  sel.value = cur || "";
}
["pf-file", "pf-cam"].forEach(id => $(id).addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try { pfPhoto = await compressImage(f, 500); $("pf-preview").src = pfPhoto; } catch {}
}));
$("form-profile").addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("pf-msg");
  const data = { name: $("pf-name").value.trim(), phone: $("pf-phone").value.trim(), bio: $("pf-bio").value.trim(), memberId: $("pf-member").value };
  if (pfPhoto) data.photo = pfPhoto;
  try {
    await updateDoc(doc(db, "users", currentUser.uid), data);
    currentUserDoc = { ...currentUserDoc, ...data };
    if (data.memberId) {
      const md = { name: data.name };
      if (data.bio) md.bio = data.bio;
      if (pfPhoto) md.photo = pfPhoto;
      await updateDoc(doc(db, "members", data.memberId), md);
      loadFamilyMembers();
    }
    fillProfile();
    m.className = "msg msg-success"; m.innerText = "Profile saved!";
  } catch (err) { m.className = "msg msg-error"; m.innerText = err.message; }
  m.style.display = "block";
});
