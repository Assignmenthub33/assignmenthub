const C=window.ASSIGNMENTHUB_CONFIG||{};
const ok=C.SUPABASE_URL?.startsWith("https://")&&!C.SUPABASE_URL.includes("PASTE_")&&C.SUPABASE_ANON_KEY&&!C.SUPABASE_ANON_KEY.includes("PASTE_");
const db=ok?supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₹"+Number(n||0).toFixed(0);let productCache=[];
$("login").onclick=async()=>{if(!db){$("admin-message").textContent="Supabase setup is not complete.";return;}const {error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error){$("admin-message").textContent=error.message;return;}await showDashboard();};
async function showDashboard(){const {data:{session}}=await db.auth.getSession();if(!session){$("login-panel").hidden=false;$("dashboard").hidden=true;return;}$("login-panel").hidden=true;$("dashboard").hidden=false;await Promise.all([loadProducts(),loadOrders()]);}
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
  $("product-id").value=p.id;$("product-name").value=p.name;$("product-price").value=p.price;$("product-description").value=p.description||"";$("product-active").checked=p.active;$("product-form-title").textContent="Edit product";
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
  const old=productCache.find(p=>p.id===id);let image_urls=photos(old||{});const files=[...$("product-image").files];
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
  const payload={id,name,price,description,image_url,image_urls,active,sort_order:old?.sort_order??(productCache.length+1)*10};
  const {error}=await db.from("products").upsert(payload,{onConflict:"id"});if(error)throw error;
  msg.textContent="Product saved successfully.";clearForm();await loadProducts();
 }catch(err){msg.textContent="Error: "+(err.message||String(err));}finally{save.disabled=false;}
};
async function loadOrders(){
 const host=$("orders");host.textContent="Loading orders...";
 const {data,error}=await db.from("orders").select("id,customer_name,mobile,total,status,fulfillment,address,items,created_at").order("created_at",{ascending:false});
 if(error){host.textContent="Could not load orders: "+error.message;return;}
 host.innerHTML=data?.length?data.map(o=>`<article class="order-card"><b>${esc(o.id)}</b><p>${esc(o.customer_name)} · ${esc(o.mobile)}</p><p class="price">${money(o.total)}</p><p>${esc(o.fulfillment)}${o.address?" · "+esc(o.address):""}</p><p>${(o.items||[]).map(i=>`${esc(i.name||i.id)} × ${Number(i.qty||1)}`).join(", ")}</p><label>Status <select data-id="${esc(o.id)}" class="status"><option ${o.status==="New"?"selected":""}>New</option><option ${o.status==="Processing"?"selected":""}>Processing</option><option ${o.status==="Completed"?"selected":""}>Completed</option><option ${o.status==="Cancelled"?"selected":""}>Cancelled</option></select></label></article>`).join(""):"No orders yet.";
}
$("orders").addEventListener("change",async e=>{if(!e.target.matches(".status"))return;const {error}=await db.from("orders").update({status:e.target.value}).eq("id",e.target.dataset.id);if(error)alert(error.message);});
$("refresh-products").onclick=loadProducts;$("refresh-orders").onclick=loadOrders;
$("logout").onclick=async()=>{await db.auth.signOut();$("dashboard").hidden=true;$("login-panel").hidden=false;};
if(db)db.auth.getSession().then(({data})=>{if(data.session)showDashboard();});
