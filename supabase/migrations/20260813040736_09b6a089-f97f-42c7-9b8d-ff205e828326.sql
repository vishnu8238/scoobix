-- 1. Create Role Enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles Table for backend auth
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- 3. Grants and RLS for user_roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security function to check roles (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Create users profile table
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    name TEXT DEFAULT 'New User',
    phone TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    role TEXT DEFAULT 'customer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- 6. Grants and RLS for users
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. Policies for users
CREATE POLICY "Users can insert their own profile" ON public.users
FOR INSERT TO authenticated
WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can select their own profile" ON public.users
FOR SELECT TO authenticated
USING (auth.uid()::text = id);

CREATE POLICY "Admins can select all users" ON public.users
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Policies for user_roles (Admins can manage roles)
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 9. Seed the initial admin if known (using info email from context)
-- Note: This requires the user to exist in auth.users first, but we can't seed auth.users.
-- We'll assume the developer will manually add the admin to user_roles or we'll handle it via logic.
