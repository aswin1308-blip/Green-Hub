/* ==========================================
        GREEN HUB - SCRIPT.JS
========================================== */

let cart = JSON.parse(localStorage.getItem("greenhubCart")) || [];

updateCartCount();

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

function updateCartCount(){

    const icon=document.querySelector(".fa-cart-shopping");

    if(!icon) return;

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

        icon.parentElement.style.position="relative";

        icon.parentElement.appendChild(badge);

    }

    badge.innerText=cart.length;

}

/* ==========================================
        ADD TO CART
========================================== */

const addButtons=document.querySelectorAll("button");

addButtons.forEach(btn=>{

    if(btn.innerText.trim()=="Add to Cart"){

        btn.addEventListener("click",function(){

            let card=this.closest(".product-card");

            if(!card){

                showToast("Added to Cart");

                return;

            }

            let name=card.querySelector("h3").innerText;

            let price=card.querySelector("p").innerText;

            let image=card.querySelector("img").src;

            cart.push({

                name,

                price,

                image,

                qty:1

            });

            localStorage.setItem("greenhubCart",JSON.stringify(cart));

            updateCartCount();

            showToast(name+" added to cart");

        });

    }

});

/* ==========================================
        BUY NOW
========================================== */

document.querySelectorAll("button").forEach(btn=>{

    if(btn.innerText.trim()=="Buy Now"){

        btn.onclick=function(){

            showToast("Redirecting to Checkout...");

            setTimeout(()=>{

                window.location.href="checkout.html";

            },1000);

        }

    }

});

/* ==========================================
        REMOVE FROM CART
========================================== */

document.querySelectorAll("button").forEach(btn=>{

    if(btn.innerText.trim()=="Remove"){

        btn.onclick=function(){

            this.closest("tr").remove();

            showToast("Item Removed");

        }

    }

});

/* ==========================================
        BUTTON RIPPLE
========================================== */

document.querySelectorAll("button").forEach(button=>{

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
        LOGIN VALIDATION
========================================== */

const loginForm=document.querySelector(".login-box form");

if(loginForm){

loginForm.addEventListener("submit",function(e){

e.preventDefault();

const email=this.querySelector('input[type="email"]').value.trim();

const password=this.querySelector('input[type="password"]').value.trim();

if(email==="" || password===""){

showToast("Please fill all fields");

return;

}

if(password.length<6){

showToast("Password must be at least 6 characters");

return;

}

showToast("Login Successful");

setTimeout(()=>{

window.location.href="index.html";

},1000);

});

}

/* ==========================================
        REGISTER VALIDATION
========================================== */

const registerForm=document.querySelector(".register-box form");

if(registerForm){

registerForm.addEventListener("submit",function(e){

e.preventDefault();

const inputs=this.querySelectorAll("input");

const name=inputs[0].value.trim();
const email=inputs[1].value.trim();
const mobile=inputs[2].value.trim();
const password=inputs[3].value.trim();
const confirm=inputs[4].value.trim();

if(name===""||email===""||mobile===""||password===""||confirm===""){

showToast("Please complete all fields");

return;

}

if(mobile.length!=10){

showToast("Enter a valid mobile number");

return;

}

if(password.length<6){

showToast("Password should contain at least 6 characters");

return;

}

if(password!==confirm){

showToast("Passwords do not match");

return;

}

showToast("Registration Successful");

setTimeout(()=>{

window.location.href="login.html";

},1200);

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
        PROFILE UPDATE
========================================== */

const profileForm=document.querySelector(".profile-details form");

if(profileForm){

profileForm.addEventListener("submit",function(e){

e.preventDefault();

showToast("Profile Updated Successfully");

});

}

/* ==========================================
        PAYMENT VALIDATION
========================================== */

const paymentForm=document.querySelector(".payment form");

if(paymentForm){

paymentForm.addEventListener("submit",function(e){

e.preventDefault();

const method=this.querySelector('input[type="radio"]:checked');

if(!method){

showToast("Select a payment method");

return;

}

showToast("Order Placed Successfully");

setTimeout(()=>{

window.location.href="orders.html";

},1500);

});

}
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
        CART QUANTITY
========================================== */

document.querySelectorAll('input[type="number"]').forEach(input => {

    input.addEventListener("change", function () {

        if (this.value < 1) {

            this.value = 1;

        }

        calculateCart();

    });

});

/* ==========================================
        CART TOTAL
========================================== */

function calculateCart() {

    const table = document.querySelector(".cart table");

    if (!table) return;

    let subtotal = 0;

    const rows = table.querySelectorAll("tr");

    rows.forEach((row, index) => {

        if (index === 0) return;

        const priceCell = row.cells[2];
        const qtyInput = row.querySelector("input");

        if (!priceCell || !qtyInput) return;

        const price = parseInt(priceCell.innerText.replace(/[₹,]/g, ""));
        const qty = parseInt(qtyInput.value);

        const total = price * qty;

        row.cells[4].innerText = "₹" + total;

        subtotal += total;

    });

    const summary = document.querySelector(".summary");

    if (summary) {

        const p = summary.querySelectorAll("p");
        const h3 = summary.querySelector("h3");

        if (p.length >= 3) {

            p[0].innerHTML = "Items : <strong>" + cart.length + "</strong>";
            p[1].innerHTML = "Subtotal : ₹" + subtotal;
            p[2].innerHTML = "Delivery : ₹50";

        }

        if (h3) {

            h3.innerHTML = "Total : ₹" + (subtotal + 50);

        }

    }

}

calculateCart();

/* ==========================================
        WISHLIST
========================================== */

let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];

document.querySelectorAll(".fa-heart").forEach(icon => {

    icon.style.cursor = "pointer";

    icon.addEventListener("click", function () {

        this.style.color = "red";

        showToast("Added to Wishlist");

        wishlist.push("Plant");

        localStorage.setItem("wishlist", JSON.stringify(wishlist));

    });

});

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

document.querySelectorAll("nav a").forEach(link => {

    if (link.getAttribute("href") === currentPage) {

        link.style.color = "#8bc34a";
        link.style.fontWeight = "bold";

    }

});

/* ==========================================
        IMAGE ZOOM
========================================== */

document.querySelectorAll("img").forEach(img => {

    if (img.hasAttribute("data-nozoom")) return;

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
        BUTTON LOADING
========================================== */

document.querySelectorAll("button").forEach(btn => {

    btn.addEventListener("click", function () {

        if (
            this.innerText === "Add to Cart" ||
            this.innerText === "Buy Now" ||
            this.innerText === "Login" ||
            this.innerText === "Register"
        ) {

            const original = this.innerText;

            this.innerText = "Please Wait...";

            this.disabled = true;

            setTimeout(() => {

                this.innerText = original;
                this.disabled = false;

            }, 1000);

        }

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