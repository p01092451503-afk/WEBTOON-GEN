ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS credits_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS credit_cost integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.debit_tenant_credits(_tenant_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
  _balance integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    SELECT credit_balance INTO _balance FROM public.tenants WHERE id = _tenant_id;
    RETURN _balance;
  END IF;

  SELECT credits_enabled, credit_balance INTO _enabled, _balance
  FROM public.tenants WHERE id = _tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  IF _enabled IS NOT TRUE THEN
    RETURN _balance;
  END IF;

  IF _balance < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  UPDATE public.tenants
    SET credit_balance = credit_balance - _amount
    WHERE id = _tenant_id
    RETURNING credit_balance INTO _balance;

  RETURN _balance;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_tenant_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_tenant_credits(uuid, integer) TO service_role;