/* ==========================================
        GREEN HUB - SCRIPT.JS
========================================== */

try {

    updateCartCount(ghGuestCartCount());

    ghRefreshCartBadge();

} catch (error) {

    console.error("Cart badge init failed:", error);

}

/* ==========================================
        TOAST MESSAGE
========================================== */

function showToast(message){

    let toast=document.createElement("div");

    toast.innerText=message;

    toast.style.position="fixed";
    toast.style.bottom="30px";
    toast.style.right="30px";
    toast.style.background="#2e7d32";
    toast.style.color="white";
    toast.style.padding="15px 25px";
    toast.style.borderRadius="10px";
    toast.style.fontWeight="bold";
    toast.style.boxShadow="0 8px 20px rgba(0,0,0,.3)";
    toast.style.zIndex="9999";
    toast.style.opacity="0";
    toast.style.transition=".4s";

    document.body.appendChild(toast);

    setTimeout(()=>{
        toast.style.opacity="1";
    },100);

    setTimeout(()=>{
        toast.style.opacity="0";

        setTimeout(()=>{
            toast.remove();
        },500);

    },2500);

}

/* ==========================================
        CART COUNT
========================================== */

function updateCartCount(count){

    const value = Number(count) || 0;

    const legacyIcon = document.querySelector(".icons .fa-cart-shopping");

    if(!legacyIcon) {

        document.querySelectorAll(".gh-cart-badge").forEach(badge => {

            badge.textContent = value > 99 ? "99+" : String(value);

            badge.classList.toggle("gh-show", value > 0);

        });

        return;

    }

    let badge=document.querySelector(".cart-badge");

    if(!badge){

        badge=document.createElement("span");

        badge.className="cart-badge";

        badge.style.position="absolute";
        badge.style.top="-8px";
        badge.style.right="-10px";
        badge.style.background="red";
        badge.style.color="white";
        badge.style.fontSize="12px";
        badge.style.width="20px";
        badge.style.height="20px";
        badge.style.borderRadius="50%";
        badge.style.display="flex";
        badge.style.alignItems="center";
        badge.style.justifyContent="center";

        legacyIcon.parentElement.style.position="relative";

        legacyIcon.parentElement.appendChild(badge);

    }

    badge.innerText = value;

    badge.style.display = value > 0 ? "flex" : "none";

}
/* ==========================================
        CART BUTTONS (handled centrally in cart.js)
========================================== */

/* ==========================================
        BUTTON RIPPLE
========================================== */

document.querySelectorAll("button").forEach(button=>{

// Skip premium components — legacy ripple breaks their rounded chips,
// clips the cart badge (overflow:hidden) and fights .gh-btn styles.
if (button.matches(".gh-icon-btn, .gh-hamburger, .gh-modal-close, .gh-drawer-close, .gh-backtop, .gh-theme-toggle, .gh-search-clear, .gh-search-close, .gh-cart-remove, .gh-wish-btn, .gh-qty button, .gh-news-pop-close, .gh-btn")) return;

if (button.closest(".gh-header, .gh-drawer, .gh-drawer-cart, .gh-modal, .gh-qv, .gh-news-pop, .gh-search-overlay")) return;

button.addEventListener("click",function(e){

const circle=document.createElement("span");

const size=Math.max(this.clientWidth,this.clientHeight);

circle.style.width=size+"px";

circle.style.height=size+"px";

circle.style.position="absolute";

circle.style.background="rgba(255,255,255,.4)";

circle.style.borderRadius="50%";

circle.style.transform="scale(0)";

circle.style.left=(e.offsetX-size/2)+"px";

circle.style.top=(e.offsetY-size/2)+"px";

circle.style.animation="ripple .6s linear";

circle.style.pointerEvents="none";

this.style.position="relative";

this.style.overflow="hidden";

this.appendChild(circle);

setTimeout(()=>{

circle.remove();

},600);

});

});

/* ==========================================
        PAGE LOADED
========================================== */

window.onload=function(){

console.log("Green Hub Loaded Successfully");

};
/* ==========================================
        MOBILE MENU (hamburger)
========================================== */

const hamburger = document.querySelector(".hamburger");

if (hamburger) {

    hamburger.addEventListener("click", () => {

        const nav = document.querySelector("header nav");

        if (nav) nav.classList.toggle("open");

    });

}

/* ==========================================
        LOGIN (backend auth)
========================================== */

const loginForm = document.querySelector(".login-box form");

if (loginForm) {

    const loginErrorEl = document.getElementById("login-error");

    const failLogin = (message) => {

        if (loginErrorEl) {

            loginErrorEl.textContent = message;

            loginErrorEl.hidden = false;

        }

        showToast(message);

    };

    loginForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const emailInput = this.querySelector("#login-email") || this.querySelector('input[type="email"]');

        const passwordInput = this.querySelector("#login-password") || this.querySelector('input[type="password"]');

        if (!emailInput || !passwordInput) {

            failLogin("Could not find the login form fields. Please reload the page.");

            return;

        }

        const email = emailInput.value.trim();

        const password = passwordInput.value.trim();

        if (email === "" || password === "") {

            showToast("Please fill all fields");

            return;

        }

        if (loginErrorEl) loginErrorEl.hidden = true;

        const submitBtn = this.querySelector('button[type="submit"]');

        const originalText = submitBtn ? submitBtn.innerText : "";

        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Please Wait..."; }

        try {

            const data = await ghApiRequest("/api/auth/login", {

                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({ email, password })

            });

            if (!data.token) throw new Error("Login failed. Please try again.");

            ghSetSession(data.token, data.user);

            await ghSyncGuestCartToServer();

            showToast("Login Successful");

            const params = new URLSearchParams(window.location.search);

            const redirect = params.get("redirect");

            setTimeout(() => {

                window.location.href = redirect || "index.html";

            }, 800);

        } catch (error) {

            console.error("Login failed:", error);

            failLogin(error.message || "Invalid email or password");

            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
        }

    });

}

/* ==========================================
        REGISTER (backend auth)
========================================== */

const registerForm = document.querySelector(".register-box form");

if (registerForm) {

    const registerErrorEl = document.getElementById("register-error");

    const failRegister = (message) => {

        if (registerErrorEl) {

            registerErrorEl.textContent = message;

            registerErrorEl.hidden = false;

        }

        showToast(message);

    };

    registerForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const nameInput = this.querySelector("#register-name") || this.querySelector('input[type="text"]');

        const emailInput = this.querySelector("#register-email") || this.querySelector('input[type="email"]');

        const mobileInput = this.querySelector("#register-mobile") || this.querySelector('input[type="tel"]');

        const passwordInput = this.querySelector("#register-password") || this.querySelector('input[type="password"]');

        const confirmInput = this.querySelector("#register-confirm");

        if (!nameInput || !emailInput || !mobileInput || !passwordInput || !confirmInput) {

            failRegister("Could not find the registration form fields. Please reload the page.");

            return;

        }

        const name = nameInput.value.trim();

        const email = emailInput.value.trim();

        const mobile = mobileInput.value.trim();

        const password = passwordInput.value.trim();

        const confirm = confirmInput.value.trim();

        if (name === "" || email === "" || mobile === "" || password === "" || confirm === "") {

            failRegister("Please complete all fields");

            return;

        }

        if (mobile.length !== 10) {

            failRegister("Enter a valid mobile number");

            return;

        }

        if (password.length < 6) {

            failRegister("Password should contain at least 6 characters");

            return;

        }

        if (password !== confirm) {

            failRegister("Passwords do not match");

            return;

        }

        if (registerErrorEl) registerErrorEl.hidden = true;

        const submitBtn = this.querySelector('button[type="submit"]');

        const originalText = submitBtn ? submitBtn.innerText : "";

        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Please Wait..."; }

        try {

            const data = await ghApiRequest("/api/auth/register", {

                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({ name, email, password, phone: mobile })

            });

            if (!data.token) throw new Error("Registration failed. Please try again.");

            ghSetSession(data.token, data.user);

            await ghSyncGuestCartToServer();

            showToast("Registration Successful");

            const params = new URLSearchParams(window.location.search);

            const redirect = params.get("redirect");

            setTimeout(() => {

                window.location.href = redirect || "index.html";

            }, 800);

        } catch (error) {

            console.error("Registration failed:", error);

            failRegister(error.message || "Registration failed. Please try again.");

            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
        }

    });

}

/* ==========================================
        AUTH UI (show logged-in user + logout)
========================================== */

function ghRenderAuthUI() {

    if (typeof ghIsLoggedIn !== "function" || !ghIsLoggedIn()) return;

    const user = ghGetUser();

    const loginLink = document.querySelector('header nav a[href="login.html"]');

    if (!loginLink) return;

    const name = (user && (user.name || user.email)) || "Account";

    const first = String(name).trim().split(/\s+/)[0] || "Account";

    loginLink.textContent = first;

    loginLink.setAttribute("href", "profile.html");

    loginLink.title = user && user.email ? user.email : "";

    const logout = document.createElement("a");

    logout.href = "#";

    logout.textContent = "Logout";

    logout.title = "Log out of Green Hub";

    logout.addEventListener("click", function (e) {

        e.preventDefault();

        ghClearSession();

        showToast("Logged out");

        window.location.reload();

    });

    loginLink.parentNode.insertBefore(logout, loginLink.nextSibling);

}

ghRenderAuthUI();

/* ==========================================
        USER ICON IN HEADER (name/email chip)
========================================== */

function ghRenderUserIcon() {

    const userIcon = document.querySelector(".icons .fa-user");

    if (!userIcon) return;

    const iconsGroup = userIcon.closest(".icons");

    if (!iconsGroup) return;

    if (typeof ghIsLoggedIn !== "function" || !ghIsLoggedIn()) {

        userIcon.style.cursor = "pointer";

        userIcon.addEventListener("click", function () {

            window.location.href = "login.html";

        });

        return;

    }

    const user = ghGetUser();

    const name = (user && (user.name || user.email)) || "Account";

    const email = (user && user.email) || "";

    const chip = document.createElement("a");

    chip.className = "gh-user-chip";

    chip.href = "profile.html";

    chip.title = email || "My Profile";

    chip.innerHTML = '<i class="fa-solid fa-user"></i><span></span>';

    chip.querySelector("span").textContent = name;

    userIcon.replaceWith(chip);

}

ghRenderUserIcon();

/* ==========================================
        PROFILE PAGE LOGOUT
========================================== */

const profileLogout = document.getElementById("profile-logout");

if (profileLogout) {

    profileLogout.addEventListener("click", function (e) {

        e.preventDefault();

        ghClearSession();

        showToast("Logged out");

        setTimeout(() => {

            window.location.href = "login.html";

        }, 600);

    });

}

/* ==========================================
        CONTACT FORM
========================================== */

const contactForm=document.querySelector(".contact-form form");

if(contactForm){

contactForm.addEventListener("submit",function(e){

e.preventDefault();

let valid=true;

this.querySelectorAll("input,textarea").forEach(field=>{

if(field.value.trim()===""){

valid=false;

}

});

if(!valid){

showToast("Please complete the contact form");

return;

}

showToast("Message Sent Successfully");

this.reset();

});

}

/* ==========================================
        NEWSLETTER
========================================== */

const newsletter=document.querySelector(".newsletter");

if(newsletter){

const emailInput=newsletter.querySelector("input");
const button=newsletter.querySelector("button");

button.addEventListener("click",()=>{

const email=emailInput.value.trim();

if(email===""){

showToast("Enter your email");

return;

}

if(!email.includes("@")){

showToast("Enter a valid email");

return;

}

showToast("Subscribed Successfully");

emailInput.value="";

});

}

/* ==========================================
        PROFILE UPDATE (saves to MongoDB via /api/auth/me)
========================================== */

const profileForm=document.querySelector(".profile-details form");

if(profileForm){

    const profileName=document.getElementById("profile-name");
    const profileEmail=document.getElementById("profile-email");
    const profilePhone=document.getElementById("profile-phone");
    const profileAddress=document.getElementById("profile-address");
    const displayName=document.getElementById("profile-display-name");

    // Load the logged-in customer's latest profile from MongoDB
    async function loadProfile(){
        if(typeof ghIsLoggedIn!=="function"||!ghIsLoggedIn())return;

        try{
            const data=await ghApiRequest("/api/auth/me");
            const u=data.user||{};
            if(profileName)profileName.value=u.name||"";
            if(profileEmail)profileEmail.value=u.email||"";
            if(profilePhone)profilePhone.value=u.phone||"";
            if(profileAddress)profileAddress.value=u.address||"";
            if(displayName)displayName.textContent=u.name||"Customer";
        }catch(error){
            console.error("Failed to load profile:",error);
            showToast(error.message||"Could not load your profile.");
        }
    }

    loadProfile();

    profileForm.addEventListener("submit",async function(e){

        e.preventDefault();

        if(typeof ghIsLoggedIn!=="function"||!ghIsLoggedIn()){
            showToast("Please log in first");
            return;
        }

        const name=profileName?profileName.value.trim():"";
        const email=profileEmail?profileEmail.value.trim():"";
        const phone=profilePhone?profilePhone.value.trim():"";
        const address=profileAddress?profileAddress.value.trim():"";

        if(name===""||email===""){
            showToast("Name and email are required");
            return;
        }

        const submitBtn=this.querySelector('button[type="submit"]');
        const originalText=submitBtn?submitBtn.innerText:"";

        if(submitBtn){submitBtn.disabled=true;submitBtn.innerText="Saving...";}

        try{

            const data=await ghApiRequest("/api/auth/me",{

                method:"PUT",

                headers:{"Content-Type":"application/json"},

                body:JSON.stringify({name,email,phone,address})

            });

            if(data.user&&typeof ghSetSession==="function"){
                ghSetSession(ghGetToken(),data.user);
            }

            showToast("Profile Updated Successfully");

            if(displayName)displayName.textContent=name;

        }catch(error){

            console.error("Profile update failed:",error);

            showToast(error.message||"Could not update your profile.");

        }finally{

            if(submitBtn){submitBtn.disabled=false;submitBtn.innerText=originalText;}

        }

    });

}

/* ==========================================
        PAYMENT (handled centrally in checkout.js)
========================================== */
/* ==========================================
        LIVE PRODUCT SEARCH
========================================== */

const searchSection = document.querySelector(".search-section");

if (searchSection) {

    const input = searchSection.querySelector("input");
    const cards = document.querySelectorAll(".product-card");

    input.addEventListener("keyup", function () {

        const value = this.value.toLowerCase();

        cards.forEach(card => {

            const name = card.querySelector("h3").innerText.toLowerCase();

            if (name.includes(value)) {

                card.style.display = "block";

            } else {

                card.style.display = "none";

            }

        });

    });

}

/* ==========================================
        CART QUANTITY + TOTALS (handled in cart-page.js / checkout.js)
========================================== */

/* ==========================================
        WISHLIST (navbar heart -> wishlist page)
========================================== */

document.querySelectorAll(".icons .fa-heart").forEach(icon => {

    // The premium header/drawer render their own wishlist navigation.
    if (icon.closest(".gh-header, .gh-drawer, .gh-drawer-cart")) return;

    icon.style.cursor = "pointer";

    icon.addEventListener("click", function () {

        ghGoToWishlist();

    });

});

function ghGoToWishlist() {

    if (typeof ghIsLoggedIn === "function" && ghIsLoggedIn()) {

        window.location.href = "wishlist.html";

    } else {

        window.location.href = "login.html?redirect=" + encodeURIComponent("wishlist.html");

    }

}

/* ==========================================
        CART ICON NAVIGATION
========================================== */

document.querySelectorAll(".fa-cart-shopping").forEach(icon => {

    // The premium header renders its own cart drawer / navigation.
    if (icon.closest(".gh-header, .gh-drawer, .gh-drawer-cart")) return;

    icon.style.cursor = "pointer";

    icon.addEventListener("click", function () {

        ghGoToCart();

    });

});

function ghGoToCart() {

    window.location.href = "cart.html";

}

/* ==========================================
        CATEGORY FILTER
========================================== */

document.querySelectorAll(".category-container button").forEach(button => {

    button.addEventListener("click", function () {

        const category = this.innerText.toLowerCase();

        const cards = document.querySelectorAll(".product-card");

        cards.forEach(card => {

            const title = card.querySelector("h3").innerText.toLowerCase();

            if (
                category.includes("indoor") &&
                (title.includes("snake") || title.includes("money") || title.includes("peace"))
            ) {

                card.style.display = "block";

            }

            else if (
                category.includes("fruit") &&
                title.includes("mango")
            ) {

                card.style.display = "block";

            }

            else if (
                category.includes("flower") &&
                title.includes("rose")
            ) {

                card.style.display = "block";

            }

            else if (
                category.includes("medicinal") &&
                title.includes("aloe")
            ) {

                card.style.display = "block";

            }

            else if (category.includes("outdoor")) {

                card.style.display = "block";

            }

            else {

                if (
                    !category.includes("outdoor") &&
                    !category.includes("indoor") &&
                    !category.includes("flower") &&
                    !category.includes("fruit") &&
                    !category.includes("medicinal")
                ) {

                    card.style.display = "block";

                } else {

                    if (
                        !(category.includes("indoor") && (title.includes("snake") || title.includes("money") || title.includes("peace"))) &&
                        !(category.includes("fruit") && title.includes("mango")) &&
                        !(category.includes("flower") && title.includes("rose")) &&
                        !(category.includes("medicinal") && title.includes("aloe")) &&
                        !category.includes("outdoor")
                    ) {

                        card.style.display = "none";

                    }

                }

            }

        });

    });

});

/* ==========================================
        SCROLL TO TOP
========================================== */

const topButton = document.createElement("button");

topButton.innerHTML = "↑";

topButton.style.position = "fixed";
topButton.style.right = "20px";
topButton.style.bottom = "20px";
topButton.style.width = "50px";
topButton.style.height = "50px";
topButton.style.borderRadius = "50%";
topButton.style.border = "none";
topButton.style.background = "#2e7d32";
topButton.style.color = "white";
topButton.style.fontSize = "22px";
topButton.style.cursor = "pointer";
topButton.style.display = "none";
topButton.style.zIndex = "999";

document.body.appendChild(topButton);

window.addEventListener("scroll", () => {

    if (window.scrollY > 300) {

        topButton.style.display = "block";

    } else {

        topButton.style.display = "none";

    }

});

topButton.addEventListener("click", () => {

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

});
/* ==========================================
        PAGE LOADER
========================================== */

window.addEventListener("load", () => {

    document.body.style.opacity = "0";

    setTimeout(() => {

        document.body.style.transition = "opacity .8s";

        document.body.style.opacity = "1";

    }, 100);

});

/* ==========================================
        ACTIVE NAVIGATION
========================================== */
const currentPage = window.location.pathname.split("/").pop();

if (!document.querySelector(".gh-nav")) {

    document.querySelectorAll("nav a").forEach(link => {

        if (link.getAttribute("href") === currentPage) {

            link.style.color = "#8bc34a";

            link.style.fontWeight = "bold";

        }

    });

}

/* ==========================================
        IMAGE ZOOM
========================================== */

document.querySelectorAll("img").forEach(img => {

    if (img.hasAttribute("data-nozoom")) return;

    if (img.closest(".gh-header, .gh-drawer, .gh-drawer-cart, .gh-modal, .gh-qv, .gh-news-pop, .gh-footer")) return;

    img.style.cursor = "pointer";

    img.addEventListener("mouseenter", () => {

        img.style.transform = "scale(1.08)";
        img.style.transition = ".4s";

    });

    img.addEventListener("mouseleave", () => {

        img.style.transform = "scale(1)";

    });

});

/* ==========================================
        BACKGROUND FADE
========================================== */

window.addEventListener("scroll", () => {

    const scroll = window.scrollY;

    document.body.style.backgroundPositionY = -(scroll * 0.1) + "px";

});

/* ==========================================
        PRODUCT HOVER GLOW
========================================== */

document.querySelectorAll(".product-card").forEach(card => {

    card.addEventListener("mouseenter", () => {

        card.style.boxShadow = "0 20px 40px rgba(46,125,50,.25)";

    });

    card.addEventListener("mouseleave", () => {

        card.style.boxShadow = "";

    });

});

/* ==========================================
        RANDOM WELCOME MESSAGE
========================================== */

const greetings = [
    "Welcome to Green Hub 🌿",
    "Enjoy Shopping 🌱",
    "Fresh Plants Delivered 🌼",
    "Happy Gardening 🌳"
];

setTimeout(() => {

    showToast(greetings[Math.floor(Math.random() * greetings.length)]);

}, 1500);

/* ==========================================
        FOOTER YEAR
========================================== */

document.querySelectorAll("footer p").forEach(p => {

    if (p.innerText.includes("©")) {

        p.innerHTML = "© " + new Date().getFullYear() + " Green Hub. All Rights Reserved.";

    }

});

/* ==========================================
        KEYBOARD SHORTCUT
========================================== */

document.addEventListener("keydown", function (e) {

    if (e.key === "/") {

        const search = document.querySelector(".search-section input");

        if (search) {

            e.preventDefault();

            search.focus();

            showToast("Search Activated");

        }

    }

});

/* ==========================================
        MY ORDERS (customer orders page)
========================================== */

function ghStatusColor(status) {

    const s=String(status||"").toLowerCase();

    if(s==="delivered")return "#2e7d32";

    if(s==="shipped"||s==="processing")return "#f9a825";

    if(s==="cancelled")return "#c62828";

    return "#1565c0";

}

function ghCancelSuccessFx(button,statusTd,extraMsg) {

    if(statusTd){statusTd.textContent="Cancelled";statusTd.style.color="#c62828";}

    if(button){button.disabled=true;button.textContent="Cancelled";button.style.opacity=".55";}

    if(extraMsg)setTimeout(function(){window.alert(extraMsg);},120);

}

function ghCancelOrder(orderId, button, statusTd) {

    if(!window.confirm("Are you sure you want to cancel this order?"))return;

    if(button)button.disabled=true;

    if(button)button.textContent="Cancelling...";

    window.ghApiRequest("/api/orders/"+encodeURIComponent(orderId)+"/cancel",{method:"PATCH"})

        .then(function(data){

            showToast(data&&data.message?data.message:"Order cancelled successfully");

            var extra="";

            if(data&&data.refundRequired){

                extra="Your payment has been captured. A refund will be processed shortly.";

            }

            ghCancelSuccessFx(button,statusTd,extra);

        })

        .catch(function(error){

            if(button){button.disabled=false;button.textContent="Cancel Order";}

            showToast((error&&error.message)||"Could not cancel your order. Please try again.");

        });

}

const ordersTableBody=document.getElementById("orders-table-body");

if(ordersTableBody){

(async function loadMyOrders(){

    const gate=document.getElementById("orders-gate");

    const content=document.getElementById("orders-content");

    if(typeof ghIsLoggedIn!=="function"||!ghIsLoggedIn()){

        if(gate)gate.style.display="block";

        if(content)content.style.display="none";

        return;

    }

    if(content)content.style.display="block";

    if(gate)gate.style.display="none";

    let messageRow="";

    try{

        const data=await ghApiRequest("/api/orders/mine");

        const orders=data.orders||[];

        const countEl=document.getElementById("summary-orders-count");

        const totalEl=document.getElementById("summary-total-spent");

        if(countEl)countEl.textContent=String(orders.length);

        let spent=0;

        orders.forEach((o)=>{spent+=Number(o.total)||0;});

        if(totalEl)totalEl.textContent=ghMoney(spent);

        if(orders.length===0){

            messageRow="No orders yet.";

            const tr=document.createElement("tr");

            const td=document.createElement("td");

            td.colSpan=7;

            td.style.textAlign="center";

            td.textContent=messageRow;

            tr.appendChild(td);

            ordersTableBody.appendChild(tr);

            return;

        }

        orders.forEach((order)=>{

            const tr=document.createElement("tr");

            const idTd=document.createElement("td");

            idTd.dataset.label="Order Number";

            idTd.textContent="#"+String(order._id||"").slice(-8).toUpperCase();

            const productsTd=document.createElement("td");

            productsTd.dataset.label="Products";

            productsTd.textContent=(order.products||[]).map((p)=>p.name||"Product").join(", ");

            const qtyTd=document.createElement("td");

            qtyTd.dataset.label="Quantity";

            const totalQty=(order.products||[]).reduce((s,p)=>s+(parseInt(p.quantity,10)||0),0);

            qtyTd.textContent=String(totalQty);

            const totalTd=document.createElement("td");

            totalTd.dataset.label="Total";

            totalTd.textContent=ghMoney(order.total);

            const statusTd=document.createElement("td");

            statusTd.dataset.label="Status";

            statusTd.textContent=order.status||"Pending";

            statusTd.style.color=ghStatusColor(order.status);

            const dateTd=document.createElement("td");

            dateTd.dataset.label="Date";

            dateTd.textContent=new Date(order.createdAt).toLocaleDateString();

            const actionTd=document.createElement("td");

            actionTd.dataset.label="Action";

            if(order.status==="Pending"){

                const cancelBtn=document.createElement("button");

                cancelBtn.type="button";

                cancelBtn.textContent="Cancel Order";

                cancelBtn.className="gh-cancel-order-btn";

                cancelBtn.setAttribute("aria-label","Cancel order "+String(order._id||""));

                cancelBtn.addEventListener("click",function(event){

                    event.stopPropagation();

                    ghCancelOrder(String(order._id),cancelBtn,statusTd);

                });

                actionTd.appendChild(cancelBtn);

            }else{

                actionTd.textContent="—";

            }

            tr.append(idTd,productsTd,qtyTd,totalTd,statusTd,dateTd,actionTd);

            ordersTableBody.appendChild(tr);

        });

    }catch(error){

        console.error("Failed to load orders:",error);

        const tr=document.createElement("tr");

        const td=document.createElement("td");

        td.colSpan=7;

        td.textContent=error.message||"Could not load your orders.";

        tr.appendChild(td);

        ordersTableBody.appendChild(tr);

    }

})();

}

/* ==========================================
        CONSOLE MESSAGE
========================================== */

console.log(
`
🌿 Green Hub
Frontend Completed Successfully

HTML ✔
CSS ✔
JavaScript ✔

Designed by Team Green Hub
`
);