-- Ejecutar una vez en Supabase SQL Editor despues de sync.sql.
-- Agrega el proveedor sin reemplazar la funcion usada por versiones anteriores.
begin;

alter table public.products
  add column if not exists supplier text not null default '';

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
  p_supplier text,
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
begin
  if v_owner_id is null then
    raise exception 'Debes iniciar sesion para guardar productos.';
  end if;

  for v_product in
    select saved.*
    from public.save_product(
      p_product_id,
      p_barcode,
      p_name,
      p_category,
      p_emoji,
      p_cost,
      p_price,
      p_stock,
      p_stock_min,
      p_container,
      p_location,
      p_unit
    ) as saved
  loop
    update public.products
    set supplier = coalesce(p_supplier, '')
    where id = v_product.id
      and owner_id = v_owner_id
    returning * into v_product;

    return next v_product;
  end loop;

  return;
end;
$function$;

revoke all on function public.save_product(uuid, text, text, text, text, numeric, numeric, integer, integer, text, text, text, text) from public, anon;
grant execute on function public.save_product(uuid, text, text, text, text, numeric, numeric, integer, integer, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
