-- Initial schema. Review and run in Supabase SQL Editor only after creating the project.
create extension if not exists pgcrypto;
create table if not exists public.orders (
 id text primary key default ('AH-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
 customer_name text not null,
 mobile text not null check (mobile ~ '^[0-9]{10}$'),
 fulfillment text not null check (fulfillment in ('Home Delivery','Store Pickup')),
 address text,
 items jsonb not null,
 total numeric(10,2) not null check(total>=0),
 status text not null default 'New' check(status in ('New','Processing','Completed','Cancelled')),
 created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
-- Replace this placeholder UUID with the one admin user's auth.users.id.
create policy "Only the single admin can read orders" on public.orders for select to authenticated
 using (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid);
create policy "Only the single admin can update orders" on public.orders for update to authenticated
 using (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid)
 with check (auth.uid() = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid);
-- Customer order RPC; server recalculates prices from the fixed catalogue.
create or replace function public.create_customer_order(order_payload jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare new_id text; calculated_total numeric:=0; item jsonb; qty integer; unit_price numeric;
begin
 if length(trim(coalesce(order_payload->>'customer_name',''))) < 2 then raise exception 'Invalid name'; end if;
 if coalesce(order_payload->>'mobile','') !~ '^[0-9]{10}$' then raise exception 'Invalid mobile'; end if;
 if order_payload->>'fulfillment' not in ('Home Delivery','Store Pickup') then raise exception 'Invalid delivery option'; end if;
 if order_payload->>'fulfillment'='Home Delivery' and length(trim(coalesce(order_payload->>'address',''))) < 5 then raise exception 'Delivery address required'; end if;
 if jsonb_typeof(order_payload->'items') <> 'array' or jsonb_array_length(order_payload->'items')=0 then raise exception 'Cart empty'; end if;
 for item in select * from jsonb_array_elements(order_payload->'items') loop
   qty := greatest(1,least(20,coalesce((item->>'qty')::integer,0)));
   unit_price := case item->>'id' when 'report' then 15 when 'assignment' then 60 else null end;
   if unit_price is null then raise exception 'Invalid product'; end if;
   calculated_total := calculated_total + qty*unit_price;
 end loop;
 insert into public.orders(customer_name,mobile,fulfillment,address,items,total)
 values(trim(order_payload->>'customer_name'),order_payload->>'mobile',order_payload->>'fulfillment',nullif(order_payload->>'address',''),order_payload->'items',calculated_total)
 returning id into new_id;
 return new_id;
end; $$;
grant execute on function public.create_customer_order(jsonb) to anon,authenticated;
create or replace function public.track_customer_order(p_order_id text,p_mobile text)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('status',status,'created_at',created_at) from public.orders where id=p_order_id and mobile=p_mobile limit 1;
$$;
grant execute on function public.track_customer_order(text,text) to anon,authenticated;
