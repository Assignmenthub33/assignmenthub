const C=window.ASSIGNMENTHUB_CONFIG||{};
const configured=C.SUPABASE_URL?.startsWith("https://")&&!C.SUPABASE_URL.includes("PASTE_")&&C.SUPABASE_ANON_KEY&&!C.SUPABASE_ANON_KEY.includes("PASTE_");
const db=configured?supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;
let cart=[],products=[],currentProduct=null,currentPhoto=0;
const $=id=>document.getElementById(id);
const money=n=>"₹"+Number(n||0).toFixed(0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
$("year").textContent=new Date().getFullYear();

function showPage(name){
 if(!["home","products","product-detail","writing","track","cart"].includes(name))name="home";
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active-page",p.id===name));
 document.querySelectorAll("nav [data-page]").forEach(a=>a.classList.toggle("active",a.dataset.page===name));
 if(name==="cart"){ $("checkout-form").hidden=true;renderCart(); }
 history.replaceState(null,"","#"+name);window.scrollTo({top:0,behavior:"auto"});
}
document.querySelectorAll("[data-page]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();showPage(a.dataset.page)}));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));
window.addEventListener("hashchange",()=>showPage(location.hash.slice(1)||"home"));

function productPhotos(p){
 const list=Array.isArray(p.image_urls)?p.image_urls.filter(Boolean):[];
 if(!list.length&&p.image_url)list.push(p.image_url);
 return [...new Set(list)];
}
function productCard(p){
 const photos=productPhotos(p),cover=photos[0];
 return `<article class="product product-card">
  <button class="product-card-image" type="button" data-detail="${esc(p.id)}" aria-label="View ${esc(p.name)} details">
   ${cover?`<img src="${esc(cover)}" alt="${esc(p.name)}" loading="lazy">`:"<span>Image not available</span>"}
  </button>
  <div class="product-card-body"><h3>${esc(p.name)}</h3><p class="product-card-description">${esc(p.description||"")}</p>
  <p class="price">${money(p.price)}</p><div class="product-actions">
  <button class="btn add" data-id="${esc(p.id)}">Add to cart</button><button class="btn secondary buy-now" data-id="${esc(p.id)}">Buy Now</button>
  </div></div></article>`;
}

function renderProducts(){
 const host=$("product-list");
 if(!products.length){host.innerHTML="<p>No products are available right now.</p>";return;}
 host.innerHTML=products.map(productCard).join("");
}
async function loadProducts(){
 if(!db){$("product-list").innerHTML="<p>Product database is not connected.</p>";return;}
 const {data,error}=await db.from("products").select("id,name,description,price,image_url,image_urls,active,sort_order").eq("active",true).order("sort_order").order("name");
 if(error){$("product-list").innerHTML="<p>Products could not load. Please refresh later.</p>";$("product-message").textContent=error.message;return;}
 products=data||[];renderProducts();
}
function addProduct(p,buy=false){
 const found=cart.find(x=>x.id===p.id);
 if(found)found.qty++;else cart.push({id:p.id,name:p.name,price:Number(p.price),qty:1});
 renderCart();if(buy){showPage("cart");openCheckout();}
}
function openProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 currentProduct=p;currentPhoto=0;renderProductDetail();showPage("product-detail");
}
function renderProductDetail(){
 const p=currentProduct;if(!p)return;
 const photos=productPhotos(p);
 const photo=photos[currentPhoto];
 const related=products.filter(x=>x.id!==p.id).slice(0,4);
 $("product-detail-content").innerHTML=`
  <div class="detail-layout">
   <div class="gallery">
    <div class="gallery-main">
     ${photo?`<img id="main-product-photo" src="${esc(photo)}" alt="${esc(p.name)}">`:`<div class="gallery-no-image">Image not available</div>`}
     ${photos.length>1?`<button class="gallery-arrow prev" id="photo-prev" type="button" aria-label="Previous image">‹</button><button class="gallery-arrow next" id="photo-next" type="button" aria-label="Next image">›</button>`:""}
    </div>
    ${photos.length>1?`<div class="gallery-thumbs">${photos.map((url,i)=>`<button type="button" class="gallery-thumb ${i===currentPhoto?"selected":""}" data-photo="${i}" aria-label="Show image ${i+1}"><img src="${esc(url)}" alt=""></button>`).join("")}</div>`:""}
   </div>
   <div class="detail-info"><p class="eyebrow">PRODUCT DETAILS</p><h1>${esc(p.name)}</h1><p class="price detail-price">${money(p.price)}</p>
    <p class="detail-description">${esc(p.description||"Product details will be updated soon.")}</p>
    <div class="detail-actions"><button class="btn" id="detail-add">Add to Cart</button><button class="btn secondary" id="detail-buy">Buy Now</button></div>
   </div>
  </div>
  <section class="related-section"><p class="eyebrow">YOU MAY ALSO LIKE</p><h2>Related products</h2>
   <div class="cards product-grid related-grid">${related.length?related.map(productCard).join(""):"<p>No other products available yet.</p>"}</div>
  </section>`;
 $("photo-prev")?.addEventListener("click",()=>{currentPhoto=(currentPhoto-1+photos.length)%photos.length;renderProductDetail();});
 $("photo-next")?.addEventListener("click",()=>{currentPhoto=(currentPhoto+1)%photos.length;renderProductDetail();});
 $("product-detail-content").querySelectorAll("[data-photo]").forEach(b=>b.addEventListener("click",()=>{currentPhoto=Number(b.dataset.photo);renderProductDetail();}));
 $("detail-add").onclick=()=>{addProduct(p,false);$("detail-add").textContent="Added to Cart";};
 $("detail-buy").onclick=()=>addProduct(p,true);
}
$("back-products").onclick=()=>showPage("products");
$("product-list").addEventListener("click",e=>{
 const detail=e.target.closest("[data-detail]");if(detail){openProduct(detail.dataset.detail);return;}
 const b=e.target.closest("button[data-id]");if(!b)return;const p=products.find(x=>x.id===b.dataset.id);if(p)addProduct(p,b.classList.contains("buy-now"));
});
$("product-detail-content").addEventListener("click",e=>{
 const detail=e.target.closest("[data-detail]");if(detail)openProduct(detail.dataset.detail);
 const b=e.target.closest("button[data-id]");if(b){const p=products.find(x=>x.id===b.dataset.id);if(p)addProduct(p,b.classList.contains("buy-now"));}
});

function renderCart(){
 $("cart-count").textContent=cart.reduce((s,x)=>s+x.qty,0);
 $("cart-items").innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><strong>${esc(x.name)}</strong><div class="quantity"><button type="button" data-action="minus" data-id="${esc(x.id)}">−</button><b>${x.qty}</b><button type="button" data-action="plus" data-id="${esc(x.id)}">+</button></div><strong class="price line-price">${money(x.price*x.qty)}</strong><button class="remove" type="button" data-action="remove" data-id="${esc(x.id)}">Remove</button></div>`).join(""):"Your cart is empty.";
 const sub=cart.reduce((s,x)=>s+x.price*x.qty,0);
 $("subtotal").textContent=money(sub);$("delivery-charge").textContent=money(0);$("discount").textContent=money(0);$("cart-total").textContent=money(sub);$("proceed-checkout").disabled=!cart.length;
}
$("cart-items").addEventListener("click",e=>{
 const b=e.target.closest("[data-action]");if(!b)return;const x=cart.find(v=>v.id===b.dataset.id);if(!x)return;
 if(b.dataset.action==="plus")x.qty=Math.min(20,x.qty+1);
 if(b.dataset.action==="minus")x.qty=Math.max(1,x.qty-1);
 if(b.dataset.action==="remove")cart=cart.filter(v=>v.id!==b.dataset.id);renderCart();
});
function openCheckout(){if(!cart.length)return;$("checkout-form").hidden=false;$("checkout-form").scrollIntoView({behavior:"smooth",block:"start"});}
$("proceed-checkout").onclick=openCheckout;$("back-to-cart").onclick=()=>$("checkout-form").hidden=true;
document.querySelectorAll('[name="fulfillment"]').forEach(r=>r.addEventListener("change",()=>{
 const home=document.querySelector('[name="fulfillment"]:checked')?.value==="Home Delivery";
 $("address-wrap").hidden=!home;$("address-wrap").querySelector("textarea").required=home;
}));
$("checkout-form").onsubmit=async e=>{
 e.preventDefault();const m=$("checkout-message");
 if(!db){m.textContent="Database is not connected. Live orders are disabled.";return;}
 if(!cart.length){m.textContent="Your cart is empty.";return;}
 const f=new FormData(e.target),fulfillment=f.get("fulfillment");
 if(!fulfillment){m.textContent="Select delivery or pickup.";return;}
 if(fulfillment==="Home Delivery"&&!String(f.get("address")||"").trim()){m.textContent="Enter your delivery address.";return;}
 const payload={customer_name:f.get("customer_name"),mobile:f.get("mobile"),fulfillment,address:f.get("address"),items:cart.map(x=>({id:x.id,qty:x.qty}))};
 const {data,error}=await db.rpc("create_customer_order",{order_payload:payload});
 if(error){m.textContent="Order failed: "+error.message;return;}
 m.textContent="Order received.\nOrder ID: "+data;cart=[];renderCart();e.target.reset();$("address-wrap").hidden=true;
};
$("writing-form").onsubmit=e=>{e.preventDefault();$("writing-message").textContent="Writing request is not enabled yet. Secure database and file storage are still required. No request has been sent.";};
$("track-form").onsubmit=async e=>{
 e.preventDefault();const m=$("track-message");if(!db){m.textContent="Tracking is not configured.";return;}
 const f=new FormData(e.target);const {data,error}=await db.rpc("track_customer_order",{p_order_id:f.get("order_id"),p_mobile:f.get("mobile")});
 m.textContent=error||!data?"Order not found. Check Order ID and mobile number.":"Order status: "+data.status;
};
showPage(location.hash.slice(1)||"home");renderCart();loadProducts();
