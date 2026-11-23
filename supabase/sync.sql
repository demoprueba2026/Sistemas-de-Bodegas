-- Ejecutar despues de setup.sql en Supabase SQL Editor.
begin;

alter table public.products
  add column if not exists inventory_type text not null default 'sale',
  add column if not exists active boolean not null default true,
  add column if not exists stock_min integer not null default 0,
  add column if not exists container text not null default '',
  add column if not exists location text not null default '',
  add column if not exists unit text not null default 'Unidad';

create sequence if not exists public.sales_receipt_seq start with 1000;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  receipt text not null,
  payment_method text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(14, 2) not null default 0 check (total >= 0),
  profit numeric(14, 2) not null default 0,
  cash_received numeric(14, 2) not null default 0 check (cash_received >= 0),
  change_given numeric(14, 2) not null default 0 check (change_given >= 0),
  voided boolean not null default false,
  sale_date date not null default ((now() at time zone 'America/Caracas')::date),
  created_at timestamptz not null default now()
);

alter table public.sales
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists cash_received numeric(14, 2) not null default 0,
  add column if not exists change_given numeric(14, 2) not null default 0,
  add column if not exists voided boolean not null default false,
  add column if not exists sale_date date not null default ((now() at time zone 'America/Caracas')::date);

create unique index if not exists sales_owner_receipt_uidx
  on public.sales (owner_id, receipt);
create index if not exists sales_owner_date_idx
  on public.sales (owner_id, sale_date desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  legacy_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists sale_items_legacy_uidx
  on public.sale_items (sale_id, legacy_key)
  where legacy_key is not null;
create index if not exists sale_items_owner_sale_idx
  on public.sale_items (owner_id, sale_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  sale_id uuid references public.sales (id) on delete set null,
  product_name text not null,
  movement_type text not null,
  quantity integer not null check (quantity <> 0),
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_owner_date_idx
  on public.inventory_movements (owner_id, created_at desc);

-- Conserva los detalles de ventas creadas por la version anterior.
insert into public.sale_items (
  owner_id, sale_id, product_name, quantity, unit_price, unit_cost, legacy_key, created_at
)
select
  s.owner_id,
  s.id,
  coalesce(item.value->>'name', 'Producto'),
  (item.value->>'quantity')::integer,
  coalesce((item.value->>'price')::numeric, 0),
  coalesce((item.value->>'cost')::numeric, 0),
  item.ordinality::text,
  s.created_at
from public.sales as s
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(s.items) = 'array' then s.items
    else '[]'::jsonb
  end
) with ordinality as item(value, ordinality)
where coalesce(item.value->>'quantity', '') ~ '^[1-9][0-9]*$'
on conflict do nothing;

select setval(
  'public.sales_receipt_seq',
  greatest(coalesce(max(case when receipt ~ '^[0-9]+$' then receipt::bigint end), 1000), 1000),
  true
)
from public.sales;

-- Reemplaza politicas anteriores para que solo se permita consultar datos propios.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('products', 'sales', 'sale_items', 'inventory_movements')
  loop
    execute format(
      'drop policy %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end
$$;

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Users can read their products"
  on public.products for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Users can delete their products"
  on public.products for delete to authenticated
  using (owner_id = (select auth.uid()));
create policy "Users read their sales"
  on public.sales for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Users read their sale items"
  on public.sale_items for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Users read their inventory movements"
  on public.inventory_movements for select to authenticated
  using (owner_id = (select auth.uid()));

revoke insert, update on public.products from authenticated;
grant select, delete on public.products to authenticated;
revoke insert, update, delete on public.sales from authenticated;
revoke insert, update, delete on public.sale_items from authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
grant select on public.sales, public.sale_items, public.inventory_movements to authenticated;

create or replace function public.save_product(
  p_product_id uuid,
  p_barcode text,
  p_name text,
  p_category text,
  p_emoji text,
  p_cost numeric,
  p_price numeric,
  p_stock integer,
  p_stock_min integer,
  p_container text,
  p_location text,
  p_unit text
)
returns setof public.products
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_old_stock integer;
  v_stock_change integer;
begin
  if v_owner_id is null then
    raise exception 'Debes iniciar sesion para guardar productos.';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_barcode), '') is null then
    raise exception 'El nombre y el codigo del producto son obligatorios.';
  end if;
  if p_cost is null or p_cost < 0 or p_price is null or p_price < 0
    or p_stock is null or p_stock < 0 or p_stock_min is null or p_stock_min < 0 then
    raise exception 'Revisa los precios y las cantidades del producto.';
  end if;

  if p_product_id is null then
    insert into public.products (
      owner_id, barcode, name, category, emoji, cost, price, stock, stock_min,
      inventory_type, container, location, unit
    )
    values (
      v_owner_id, trim(p_barcode), trim(p_name), coalesce(nullif(trim(p_category), ''), 'Sin categoria'),
      coalesce(nullif(trim(p_emoji), ''), '📦'), p_cost, p_price, p_stock, p_stock_min,
      'sale', coalesce(p_container, ''), coalesce(p_location, ''),
      coalesce(nullif(trim(p_unit), ''), 'Unidad')
    )
    returning * into v_product;

    if p_stock > 0 then
      insert into public.inventory_movements (
        owner_id, product_id, product_name, movement_type, quantity
      )
      values (v_owner_id, v_product.id, v_product.name, 'Inventario inicial', p_stock);
    end if;
  else
    select p.* into v_product
    from public.products as p
    where p.id = p_product_id and p.owner_id = v_owner_id
    for update;

    if not found then
      raise exception 'No se encontro el producto en tu inventario.';
    end if;

    v_old_stock := v_product.stock;
    v_stock_change := p_stock - v_old_stock;

    update public.products
    set barcode = trim(p_barcode),
        name = trim(p_name),
        category = coalesce(nullif(trim(p_category), ''), 'Sin categoria'),
        emoji = coalesce(nullif(trim(p_emoji), ''), '📦'),
        cost = p_cost,
        price = p_price,
        stock = p_stock,
        stock_min = p_stock_min,
        container = coalesce(p_container, ''),
        location = coalesce(p_location, ''),
        unit = coalesce(nullif(trim(p_unit), ''), 'Unidad')
    where id = p_product_id
    returning * into v_product;

    if v_stock_change <> 0 then
      insert into public.inventory_movements (
        owner_id, product_id, product_name, movement_type, quantity
      )
      values (
        v_owner_id, v_product.id, v_product.name, 'Ajuste manual de inventario', v_stock_change
      );
    end if;
  end if;

  return next v_product;
end;
$function$;

create or replace function public.receive_stock(
  p_product_id uuid,
  p_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_stock integer;
begin
  if v_owner_id is null then
    raise exception 'Debes iniciar sesion para registrar una entrada.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;

  select p.* into v_product
  from public.products as p
  where p.id = p_product_id and p.owner_id = v_owner_id and p.active = true
  for update;

  if not found then
    raise exception 'No se encontro el producto en tu inventario.';
  end if;

  update public.products
  set stock = stock + p_quantity
  where id = p_product_id
  returning stock into v_stock;

  insert into public.inventory_movements (
    owner_id, product_id, product_name, movement_type, quantity
  )
  values (v_owner_id, p_product_id, v_product.name, 'Entrada de mercancia', p_quantity);

  return v_stock;
end;
$function$;

create or replace function public.register_sale(
  p_payment_method text,
  p_cash_received numeric,
  p_items jsonb
)
returns table (sale_id uuid, receipt text, total numeric, profit numeric)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_sale_id uuid := gen_random_uuid();
  v_receipt text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products%rowtype;
  v_total numeric(14, 2) := 0;
  v_profit numeric(14, 2) := 0;
  v_cash numeric(14, 2);
  v_items_snapshot jsonb := '[]'::jsonb;
begin
  if v_owner_id is null then
    raise exception 'Debes iniciar sesion para registrar una venta.';
  end if;
  if p_payment_method is null or p_payment_method not in (
    'Efectivo', 'Tarjeta de crédito/débito', 'Transferencia',
    'Billetera digital / Pago móvil'
  ) then
    raise exception 'El metodo de pago no es valido.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Los articulos de la venta deben ser una lista.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'Hay un articulo de venta invalido.';
    end if;

    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'El producto o la cantidad no son validos.';
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor que cero.';
    end if;
  end loop;

  -- Bloquea productos en orden fijo y agrupa lineas repetidas de un mismo articulo.
  for v_item in
    select jsonb_build_object('product_id', item.product_id::text, 'quantity', sum(item.quantity))
    from (
      select (value->>'product_id')::uuid as product_id,
             (value->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) as input(value)
    ) as item
    group by item.product_id
    order by item.product_id
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    select p.* into v_product
    from public.products as p
    where p.id = v_product_id
      and p.owner_id = v_owner_id
      and p.active = true
      and p.inventory_type = 'sale'
    for update;

    if not found then
      raise exception 'No se encontro un producto activo de tu inventario.';
    end if;
    if v_product.stock < v_quantity then
      raise exception 'No hay suficientes existencias de %.', v_product.name;
    end if;

    v_total := v_total + v_product.price * v_quantity;
    v_profit := v_profit + (v_product.price - v_product.cost) * v_quantity;
  end loop;

  v_cash := case
    when p_payment_method = 'Efectivo' then coalesce(p_cash_received, 0)
    else v_total
  end;
  if p_payment_method = 'Efectivo' and v_cash < v_total then
    raise exception 'El efectivo recibido no cubre el total.';
  end if;

  v_receipt := nextval('public.sales_receipt_seq')::text;

  insert into public.sales (
    id, owner_id, receipt, payment_method, items, total, profit, cash_received, change_given
  )
  values (
    v_sale_id, v_owner_id, v_receipt, p_payment_method, '[]'::jsonb, v_total, v_profit,
    v_cash, greatest(v_cash - v_total, 0)
  );

  for v_item in
    select jsonb_build_object('product_id', item.product_id::text, 'quantity', sum(item.quantity))
    from (
      select (value->>'product_id')::uuid as product_id,
             (value->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) as input(value)
    ) as item
    group by item.product_id
    order by item.product_id
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select p.* into v_product
    from public.products as p
    where p.id = v_product_id and p.owner_id = v_owner_id
    for update;

    update public.products
    set stock = stock - v_quantity
    where id = v_product.id;

    insert into public.sale_items (
      owner_id, sale_id, product_id, product_name, quantity, unit_price, unit_cost
    )
    values (
      v_owner_id, v_sale_id, v_product.id, v_product.name, v_quantity, v_product.price, v_product.cost
    );

    insert into public.inventory_movements (
      owner_id, product_id, sale_id, product_name, movement_type, quantity
    )
    values (
      v_owner_id, v_product.id, v_sale_id, v_product.name, 'Salida por venta', -v_quantity
    );

    v_items_snapshot := v_items_snapshot || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'quantity', v_quantity,
      'price', v_product.price,
      'cost', v_product.cost
    ));
  end loop;

  update public.sales set items = v_items_snapshot where id = v_sale_id;
  return query select v_sale_id, v_receipt, v_total, v_profit;
end;
$function$;

revoke all on function public.save_product(uuid, text, text, text, text, numeric, numeric, integer, integer, text, text, text) from public, anon;
revoke all on function public.receive_stock(uuid, integer) from public, anon;
revoke all on function public.register_sale(text, numeric, jsonb) from public, anon;
grant execute on function public.save_product(uuid, text, text, text, text, numeric, numeric, integer, integer, text, text, text) to authenticated;
grant execute on function public.receive_stock(uuid, integer) to authenticated;
grant execute on function public.register_sale(text, numeric, jsonb) to authenticated;

commit;
