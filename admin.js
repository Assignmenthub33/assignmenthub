const C=window.ASSIGNMENTHUB_CONFIG||{};
const ok=C.SUPABASE_URL?.startsWith("https://")&&!C.SUPABASE_URL.includes("PASTE_")&&C.SUPABASE_ANON_KEY&&!C.SUPABASE_ANON_KEY.includes("PASTE_");
const db=ok?supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₹"+Number(n||0).toFixed(0);let productCache=[],allOrders=[],activeOrderStatus="New";
$("login").onclick=async()=>{if(!db){$("admin-message").textContent="Supabase setup is not complete.";return;}const {error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error){$("admin-message").textContent=error.message;return;}await showDashboard();};
async function showDashboard(){const {data:{session}}=await db.auth.getSession();if(!session){$("login-panel").hidden=false;$("dashboard").hidden=true;return;}$("login-panel").hidden=true;$("dashboard").hidden=false;await Promise.all([loadProducts(),loadOrders(),loadExpenses()]);}
function photos(p){const a=Array.isArray(p.image_urls)?p.image_urls.filter(Boolean):[];if(!a.length&&p.image_url)a.push(p.image_url);return [...new Set(a)];}
async function loadProducts(){
 const host=$("product-admin-list");host.textContent="Loading products...";
 const {data,error}=await db.from("products").select("*").order("sort_order").order("name");
 if(error){host.textContent="Could not load products: "+error.message;return;}
 productCache=data||[];
 host.innerHTML=productCache.length?productCache.map(p=>{const imgs=photos(p);return `<article class="admin-product"><div class="admin-product-thumb">${imgs[0]?`<img src="${esc(imgs[0])}" alt="">`:"No image"}<small>${imgs.length} photo(s)</small></div><div class="admin-product-info"><strong>${esc(p.name)}</strong><span class="price">${money(p.price)}</span><small>${p.active?"Visible on website":"Hidden from website"}</small><div class="actions"><button class="btn secondary edit-product" data-id="${esc(p.id)}">Edit</button><button class="btn secondary toggle-product" data-id="${esc(p.id)}">${p.active?"Hide":"Show"}</button><button class="btn danger delete-product" data-id="${esc(p.id)}">Delete</button></div></div></article>`;}).join(""):"No products found.";
}
function renderPhotoPreview(urls=[], labels=[]){
 const host=$("product-photo-preview");if(!host)return;
 const entries=urls.map((url,i)=>`<div class="photo-preview-item"><img src="${esc(url)}" alt="Product photo ${i+1}"><small>Photo ${i+1}</small></div>`);
 const names=labels.map((name,i)=>`<div class="photo-preview-item file-preview"><div class="file-placeholder">IMG</div><small>${esc(name)}</small></div>`);
 host.innerHTML=entries.concat(names).join("")||'<span class="small">No photos selected.</span>';
}
function clearForm(){$("product-form").reset();$("product-id").value="";$("product-active").checked=true;$("product-form-title").textContent="Add new product";$("product-message").textContent="";renderPhotoPreview();}
$("cancel-edit").onclick=clearForm;
$("product-image").addEventListener("change",()=>{
 const files=[...$("product-image").files];
 if(files.length>4){$("product-message").textContent="Please select a maximum of 4 photos.";return;}
 renderPhotoPreview([],files.map(f=>f.name));
});
$("product-admin-list").addEventListener("click",async e=>{
 const b=e.target.closest("button[data-id]");if(!b)return;const p=productCache.find(x=>x.id===b.dataset.id);if(!p)return;
 if(b.classList.contains("edit-product")){
  $("product-id").value=p.id;$("product-name").value=p.name;$("product-price").value=p.price;$("product-cost").value=p.purchase_cost||0;$("product-description").value=p.description||"";$("product-active").checked=p.active;$("product-form-title").textContent="Edit product";
  $("product-message").textContent=`Editing: ${p.name}. Select new photos to replace the current gallery.`;renderPhotoPreview(photos(p));
  window.scrollTo({top:0,behavior:"smooth"});return;
 }
 if(b.classList.contains("toggle-product")){const {error}=await db.from("products").update({active:!p.active}).eq("id",p.id);if(error)alert(error.message);else await loadProducts();return;}
 if(b.classList.contains("delete-product")){if(!confirm(`Delete "${p.name}"? Existing orders will remain in order history.`))return;const {error}=await db.from("products").delete().eq("id",p.id);if(error)alert("Delete failed: "+error.message);else{clearForm();await loadProducts();}}
});
$("product-form").onsubmit=async e=>{
 e.preventDefault();const msg=$("product-message"),save=$("save-product");save.disabled=true;msg.textContent="Saving...";
 try{
  let id=$("product-id").value.trim(),name=$("product-name").value.trim(),price=Number($("product-price").value),description=$("product-description").value.trim(),active=$("product-active").checked;
  if(!name||!Number.isFinite(price)||price<0)throw new Error("Enter a valid product name and price.");
  if(!id)id="product-"+crypto.randomUUID().slice(0,8);
  const old=productCache.find(p=>p.id===id);let purchase_cost=Number($("product-cost").value||0);if(!Number.isFinite(purchase_cost)||purchase_cost<0)throw new Error("Enter a valid purchase cost.");let image_urls=photos(old||{});const files=[...$("product-image").files];
  if(files.length>4)throw new Error("You can select up to 4 new photos at a time.");
  if(files.length)image_urls=[];
  for(const file of files){
   if(file.size>5*1024*1024)throw new Error(`${file.name} is larger than 5 MB.`);
   if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPG, PNG or WebP images only.");
   const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
   const path=`${id}/${Date.now()}-${crypto.randomUUID().slice(0,6)}.${ext}`;
   const {error:upErr}=await db.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
   if(upErr)throw upErr;
   const {data:urlData}=db.storage.from("product-images").getPublicUrl(path);image_urls.push(urlData.publicUrl);
  }
  image_urls=[...new Set(image_urls)].slice(0,4);
  const image_url=image_urls[0]||null;
  const payload={id,name,price,purchase_cost,description,image_url,image_urls,active,sort_order:old?.sort_order??(productCache.length+1)*10};
  const {error}=await db.from("products").upsert(payload,{onConflict:"id"});if(error)throw error;
  msg.textContent="Product saved successfully.";clearForm();await loadProducts();
 }catch(err){msg.textContent="Error: "+(err.message||String(err));}finally{save.disabled=false;}
};
async function loadOrders(){
 const host=$("orders");host.textContent="Loading orders...";
 const {data,error}=await db.from("orders").select("id,customer_id,customer_email,customer_name,mobile,total,subtotal,delivery_charge,delivery_area,payment_method,payment_status,utr_reference,status,fulfillment,address,items,created_at,cancelled_at,cancellation_reason").order("created_at",{ascending:false});
 if(error){host.textContent="Could not load orders: "+error.message;return;}allOrders=data||[];renderOrders();await loadReports();
}
function renderOrders(){const host=$("orders");const list=allOrders.filter(o=>o.status===activeOrderStatus);document.querySelectorAll("[data-status]").forEach(b=>b.classList.toggle("active",b.dataset.status===activeOrderStatus));host.innerHTML=list.length?list.map(o=>`<article class="order-card"><b>${esc(o.id)}</b><p>${esc(o.customer_name)} · ${esc(o.mobile)} · ${esc(o.customer_email||"Guest / legacy order")}</p><p class="price">${money(o.total)} (Subtotal ${money(o.subtotal)} + Delivery ${money(o.delivery_charge)})</p><p>${esc(o.fulfillment)} ${o.delivery_area?"· "+esc(o.delivery_area):""}${o.address?" · "+esc(o.address):""}</p><p>${(o.items||[]).map(i=>`${esc(i.name||i.id)} × ${Number(i.qty||1)} @ ${money(i.price)}`).join(", ")}</p><p>Payment: ${esc(o.payment_method||"Not recorded")} · <b>${esc(o.payment_status||"Pending")}</b> ${o.utr_reference?"· UTR: "+esc(o.utr_reference):""}</p>${o.status==="Cancelled"?`<p>Cancelled: ${o.cancelled_at?new Date(o.cancelled_at).toLocaleString():"—"} · ${esc(o.cancellation_reason||"No reason provided")}</p>`:""}<label>Order status <select data-id="${esc(o.id)}" class="status"><option ${o.status==="New"?"selected":""}>New</option><option ${o.status==="Processing"?"selected":""}>Processing</option><option ${o.status==="Completed"?"selected":""}>Completed</option><option ${o.status==="Cancelled"?"selected":""}>Cancelled</option></select></label>${o.payment_method==="UPI"&&o.payment_status!=="Paid"?`<button class="btn verify-payment" data-id="${esc(o.id)}">Mark payment Paid (after bank verification)</button>`:""}</article>`).join(""):`<p>No ${activeOrderStatus.toLowerCase()} orders.</p>`;}
document.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",()=>{activeOrderStatus=b.dataset.status;renderOrders();}));
$("orders").addEventListener("change",async e=>{if(!e.target.matches(".status"))return;const {error}=await db.from("orders").update({status:e.target.value,...(e.target.value==="Cancelled"?{cancelled_at:new Date().toISOString(),cancelled_by:"Admin"}:{})}).eq("id",e.target.dataset.id);if(error)alert(error.message);else await loadOrders();});
$("orders").addEventListener("click",async e=>{const b=e.target.closest(".verify-payment");if(!b)return;if(!confirm("Confirm you have independently verified this payment in your bank / UPI app?"))return;const {error}=await db.from("orders").update({payment_status:"Paid",payment_verified_at:new Date().toISOString(),payment_verified_by:(await db.auth.getUser()).data.user.id}).eq("id",b.dataset.id);if(error)alert(error.message);else await loadOrders();});
async function loadExpenses(){const {data,error}=await db.from("expenses").select("*").order("expense_date",{ascending:false});if(error){$("expense-list").textContent=error.message;return;}$("expense-list").innerHTML=(data||[]).map(x=>`<p>${esc(x.expense_date)} · ${esc(x.category)} · ${esc(x.description)} · ${money(x.amount)} <button class="btn danger del-expense" data-id="${x.id}">Delete</button></p>`).join("")||"No expenses.";}
$("expense-form").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("expenses").insert({expense_date:$("expense-date").value||new Date().toISOString().slice(0,10),category:$("expense-category").value,description:$("expense-description").value,amount:Number($("expense-amount").value),created_by:(await db.auth.getUser()).data.user.id});$("expense-message").textContent=error?error.message:"Expense saved.";if(!error){e.target.reset();await loadReports();await loadExpenses();}};
$("expense-list").addEventListener("click",async e=>{const b=e.target.closest(".del-expense");if(!b||!confirm("Delete this expense?"))return;const {error}=await db.from("expenses").delete().eq("id",b.dataset.id);if(error)alert(error.message);else{await loadExpenses();await loadReports();}});
async function loadReports(){const paid=allOrders.filter(o=>o.payment_status==="Paid"&&o.status!=="Cancelled");const received=paid.reduce((s,o)=>s+Number(o.total||0),0);const outstanding=allOrders.filter(o=>o.payment_status!=="Paid"&&o.status!=="Cancelled").reduce((s,o)=>s+Number(o.total||0),0);const cost=paid.reduce((s,o)=>s+(o.items||[]).reduce((t,i)=>{const p=productCache.find(p=>p.id===i.id);return t+Number(p?.purchase_cost||0)*Number(i.qty||0);},0),0);const {data:ex}=await db.from("expenses").select("amount");const expenses=(ex||[]).reduce((s,x)=>s+Number(x.amount||0),0);$("report-summary").innerHTML=`<h3>Accounts summary</h3><p>Received amount: <b>${money(received)}</b></p><p>Outstanding payments: <b>${money(outstanding)}</b></p><p>Product cost (paid orders): <b>${money(cost)}</b></p><p>Expenses: <b>${money(expenses)}</b></p><p>Estimated net profit: <b>${money(received-cost-expenses)}</b></p><small>Estimate uses current product purchase costs; update costs to improve accuracy. Cancelled orders excluded.</small>`;}

$("refresh-products").onclick=loadProducts;$("refresh-orders").onclick=loadOrders;$("expense-date").value=new Date().toISOString().slice(0,10);
$("logout").onclick=async()=>{await db.auth.signOut();$("dashboard").hidden=true;$("login-panel").hidden=false;};
if(db)db.auth.getSession().then(({data})=>{if(data.session)showDashboard();});
