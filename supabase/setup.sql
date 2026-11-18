-- Configuracion inicial para Supabase.
-- El usuario debe existir primero en Authentication > Users con este mismo UUID.
-- Este script no crea ni modifica contrasenas de Supabase Auth.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'admin' check (role in ('admin', 'cashier')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  barcode text not null,
  name text not null,
  category text not null default 'Sin categoría',
  emoji text not null default '📦',
  cost numeric(14, 2) not null default 0 check (cost >= 0),
  price numeric(14, 2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  stock_min integer not null default 0 check (stock_min >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, barcode)
);

do $$
begin
  if not exists (
    select 1
    from auth.users
    where id = 'fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid
  ) then
    raise exception 'No existe el usuario de Supabase Auth fd9346a2-07f2-4ef2-871f-5f7fdc619e93. Créalo primero en Authentication > Users.';
  end if;
end
$$;

insert into public.profiles (id, username, role)
values ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, 'admin', 'admin')
on conflict (id) do update
set username = excluded.username,
    role = excluded.role;

insert into public.products (
  owner_id, barcode, name, category, emoji, cost, price, stock, stock_min
)
values
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110012', 'Leche entera 1 L', 'Lácteos', '🥛', 18.50, 25.00, 6, 8),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110029', 'Pan de caja', 'Panadería', '🍞', 28.00, 39.00, 14, 5),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110036', 'Café molido 250 g', 'Abarrotes', '☕', 54.00, 74.00, 22, 6),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110043', 'Agua natural 1.5 L', 'Bebidas', '💧', 9.00, 15.00, 4, 10),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110050', 'Arroz 1 kg', 'Abarrotes', '🍚', 22.00, 31.00, 32, 8),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110067', 'Detergente 1 kg', 'Limpieza', '🧼', 39.00, 55.00, 12, 4),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110074', 'Yogur natural', 'Lácteos', '🥣', 12.00, 18.00, 3, 6),
  ('fd9346a2-07f2-4ef2-871f-5f7fdc619e93'::uuid, '7501000110081', 'Manzana roja (kg)', 'Frutas', '🍎', 28.00, 42.00, 18, 5)
on conflict (owner_id, barcode) do nothing;

alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "Admin can read own profile" on public.profiles;
create policy "Admin can read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can read their products" on public.products;
create policy "Users can read their products"
  on public.products for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Users can add their products" on public.products;
create policy "Users can add their products"
  on public.products for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users can update their products" on public.products;
create policy "Users can update their products"
  on public.products for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users can delete their products" on public.products;
create policy "Users can delete their products"
  on public.products for delete
  to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;

commit;
