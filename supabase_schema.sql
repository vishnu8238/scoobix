--
-- PostgreSQL database dump
--

\restrict vHWdyPo8key8zEpVc6v5FA7GLR6FBbXvPmZBjqveuzATCwp77iSCc0bIghlYw8u

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dispatch_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispatch_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    driver_id uuid,
    assigned_by uuid,
    dispatch_method text DEFAULT 'manual'::text,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.dispatch_history OWNER TO postgres;

--
-- Name: drivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text,
    email text,
    phone text,
    vehicle_type text,
    vehicle_number text,
    license_number text,
    status text DEFAULT 'active'::text,
    rating double precision DEFAULT 5.0,
    total_deliveries integer DEFAULT 0,
    assigned_zone_id uuid,
    latitude double precision,
    longitude double precision,
    is_online boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.drivers OWNER TO postgres;

--
-- Name: gigs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gigs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    order_id uuid,
    gig_type text DEFAULT 'delivery'::text,
    status text DEFAULT 'pending'::text,
    pickup_location text,
    dropoff_location text,
    distance_km double precision,
    estimated_time_minutes integer,
    payout double precision,
    tips double precision DEFAULT 0,
    zone_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gigs OWNER TO postgres;

--
-- Name: live_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.live_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    order_id uuid,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    speed_kmh double precision,
    heading integer,
    accuracy integer,
    "timestamp" timestamp with time zone DEFAULT now()
);


ALTER TABLE public.live_tracking OWNER TO postgres;

--
-- Name: logistics_zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logistics_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    city text,
    manager_id uuid,
    polygon_coords jsonb,
    delivery_fee double precision DEFAULT 50,
    radius_km double precision DEFAULT 5,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.logistics_zones OWNER TO postgres;

--
-- Name: merchant_managers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_managers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text,
    email text,
    phone text,
    region text,
    status text DEFAULT 'active'::text,
    monthly_target integer DEFAULT 10,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.merchant_managers OWNER TO postgres;

--
-- Name: onboarding_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.onboarding_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid,
    manager_id uuid,
    status text,
    note text,
    actor_role text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.onboarding_events OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text,
    restaurant_id uuid,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    delivery_address text,
    delivery_latitude double precision,
    delivery_longitude double precision,
    pickup_latitude double precision,
    pickup_longitude double precision,
    status text DEFAULT 'pending'::text,
    assigned_driver_id uuid,
    zone_id uuid,
    total_amount double precision,
    delivery_fee double precision,
    estimated_delivery_time timestamp with time zone,
    actual_delivery_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: portal_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portal_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (TRIM(BOTH FROM lower(email))) STORED NOT NULL,
    portal text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_login_at timestamp with time zone,
    CONSTRAINT portal_access_portal_check CHECK ((portal = ANY (ARRAY['partner'::text, 'rider'::text, 'manager'::text, 'logistics'::text]))),
    CONSTRAINT portal_access_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);


ALTER TABLE public.portal_access OWNER TO postgres;

--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.restaurants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rst_code text,
    code text,
    name text,
    cuisine text,
    owner_id uuid,
    owner_name text,
    owner_email text,
    owner_phone text,
    contact_phone text,
    contact_email text,
    address text,
    city text,
    pincode text,
    latitude double precision,
    longitude double precision,
    delivery_radius double precision DEFAULT 5,
    commission double precision DEFAULT 20,
    opening_time text,
    closing_time text,
    bank_account text,
    bank_ifsc text,
    bank_name text,
    bank_holder text,
    gst_number text,
    fssai_number text,
    pan_number text,
    branch_name text,
    documents jsonb,
    logo text,
    logo_url text,
    cover_url text,
    cover_image text,
    status text DEFAULT 'pending'::text,
    onboarding_status text DEFAULT 'draft'::text,
    rejection_reason text,
    manager_id uuid,
    onboarded_by uuid,
    is_branch boolean DEFAULT false,
    parent_restaurant_id uuid,
    branch_code text,
    duplicate_flag text,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.restaurants OWNER TO postgres;

--
-- Name: subzones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subzones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    zone_id uuid,
    polygon_coords jsonb,
    manager_id uuid,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subzones OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    email_normalized text NOT NULL,
    name text DEFAULT 'New User'::text,
    phone text DEFAULT ''::text,
    avatar_url text DEFAULT ''::text,
    role text DEFAULT 'customer'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: dispatch_history dispatch_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_history
    ADD CONSTRAINT dispatch_history_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: gigs gigs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_pkey PRIMARY KEY (id);


--
-- Name: live_tracking live_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_tracking
    ADD CONSTRAINT live_tracking_pkey PRIMARY KEY (id);


--
-- Name: logistics_zones logistics_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logistics_zones
    ADD CONSTRAINT logistics_zones_pkey PRIMARY KEY (id);


--
-- Name: merchant_managers merchant_managers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_managers
    ADD CONSTRAINT merchant_managers_email_key UNIQUE (email);


--
-- Name: merchant_managers merchant_managers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_managers
    ADD CONSTRAINT merchant_managers_pkey PRIMARY KEY (id);


--
-- Name: onboarding_events onboarding_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: portal_access portal_access_email_normalized_portal_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_email_normalized_portal_key UNIQUE (email_normalized, portal);


--
-- Name: portal_access portal_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_rst_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_rst_code_key UNIQUE (rst_code);


--
-- Name: subzones subzones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subzones
    ADD CONSTRAINT subzones_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_dispatch_history_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispatch_history_order_id ON public.dispatch_history USING btree (order_id);


--
-- Name: idx_drivers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drivers_status ON public.drivers USING btree (status);


--
-- Name: idx_drivers_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drivers_zone_id ON public.drivers USING btree (assigned_zone_id);


--
-- Name: idx_gigs_driver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gigs_driver_id ON public.gigs USING btree (driver_id);


--
-- Name: idx_gigs_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gigs_zone_id ON public.gigs USING btree (zone_id);


--
-- Name: idx_live_tracking_driver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_tracking_driver_id ON public.live_tracking USING btree (driver_id);


--
-- Name: idx_merchant_managers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_managers_email ON public.merchant_managers USING btree (email);


--
-- Name: idx_merchant_managers_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_managers_user_id ON public.merchant_managers USING btree (user_id);


--
-- Name: idx_onboarding_events_manager_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_onboarding_events_manager_id ON public.onboarding_events USING btree (manager_id);


--
-- Name: idx_onboarding_events_restaurant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_onboarding_events_restaurant_id ON public.onboarding_events USING btree (restaurant_id);


--
-- Name: idx_orders_driver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_driver_id ON public.orders USING btree (assigned_driver_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_zone_id ON public.orders USING btree (zone_id);


--
-- Name: idx_portal_access_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_access_created_at ON public.portal_access USING btree (created_at DESC);


--
-- Name: idx_portal_access_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_access_email ON public.portal_access USING btree (email_normalized);


--
-- Name: idx_portal_access_portal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_access_portal ON public.portal_access USING btree (portal);


--
-- Name: idx_restaurants_manager_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_restaurants_manager_id ON public.restaurants USING btree (manager_id);


--
-- Name: idx_restaurants_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_restaurants_owner_id ON public.restaurants USING btree (owner_id);


--
-- Name: idx_restaurants_rst_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_restaurants_rst_code ON public.restaurants USING btree (rst_code);


--
-- Name: dispatch_history dispatch_history_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_history
    ADD CONSTRAINT dispatch_history_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: dispatch_history dispatch_history_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_history
    ADD CONSTRAINT dispatch_history_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: dispatch_history dispatch_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_history
    ADD CONSTRAINT dispatch_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gigs gigs_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: gigs gigs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: gigs gigs_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gigs
    ADD CONSTRAINT gigs_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.logistics_zones(id) ON DELETE SET NULL;


--
-- Name: live_tracking live_tracking_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_tracking
    ADD CONSTRAINT live_tracking_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: live_tracking live_tracking_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_tracking
    ADD CONSTRAINT live_tracking_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: logistics_zones logistics_zones_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logistics_zones
    ADD CONSTRAINT logistics_zones_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: merchant_managers merchant_managers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_managers
    ADD CONSTRAINT merchant_managers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: onboarding_events onboarding_events_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.merchant_managers(id) ON DELETE SET NULL;


--
-- Name: onboarding_events onboarding_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: orders orders_assigned_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_driver_id_fkey FOREIGN KEY (assigned_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: orders orders_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.logistics_zones(id) ON DELETE SET NULL;


--
-- Name: portal_access portal_access_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_access
    ADD CONSTRAINT portal_access_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: restaurants restaurants_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.merchant_managers(id) ON DELETE SET NULL;


--
-- Name: restaurants restaurants_onboarded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_onboarded_by_fkey FOREIGN KEY (onboarded_by) REFERENCES public.merchant_managers(id) ON DELETE SET NULL;


--
-- Name: restaurants restaurants_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: restaurants restaurants_parent_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_parent_restaurant_id_fkey FOREIGN KEY (parent_restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;


--
-- Name: subzones subzones_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subzones
    ADD CONSTRAINT subzones_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: subzones subzones_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subzones
    ADD CONSTRAINT subzones_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.logistics_zones(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: users Admins can select all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can select all users" ON public.users FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: onboarding_events Admins full access to events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins full access to events" ON public.onboarding_events TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text));


--
-- Name: restaurants Admins full access to restaurants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins full access to restaurants" ON public.restaurants TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text));


--
-- Name: dispatch_history Logistics can manage dispatch; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage dispatch" ON public.dispatch_history TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: drivers Logistics can manage drivers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage drivers" ON public.drivers TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: gigs Logistics can manage gigs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage gigs" ON public.gigs TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: orders Logistics can manage orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage orders" ON public.orders TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: subzones Logistics can manage subzones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage subzones" ON public.subzones TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: live_tracking Logistics can manage tracking; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage tracking" ON public.live_tracking TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: logistics_zones Logistics can manage zones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can manage zones" ON public.logistics_zones TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text))))))) WITH CHECK ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: dispatch_history Logistics can view dispatch; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view dispatch" ON public.dispatch_history FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: drivers Logistics can view drivers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view drivers" ON public.drivers FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: gigs Logistics can view gigs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view gigs" ON public.gigs FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: orders Logistics can view orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view orders" ON public.orders FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: subzones Logistics can view subzones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view subzones" ON public.subzones FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: live_tracking Logistics can view tracking; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view tracking" ON public.live_tracking FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: logistics_zones Logistics can view zones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Logistics can view zones" ON public.logistics_zones FOR SELECT TO authenticated USING ((((auth.jwt() ->> 'email'::text) = 'scoobix.info@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = (auth.uid())::text) AND ((users.role = 'logistics'::text) OR (users.role = 'admin'::text)))))));


--
-- Name: onboarding_events Managers can create events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can create events" ON public.onboarding_events FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: restaurants Managers can create restaurants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can create restaurants" ON public.restaurants FOR INSERT TO authenticated WITH CHECK (((manager_id = ( SELECT merchant_managers.id
   FROM public.merchant_managers
  WHERE (merchant_managers.user_id = auth.uid())
 LIMIT 1)) OR (manager_id IS NULL)));


--
-- Name: onboarding_events Managers can see their events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can see their events" ON public.onboarding_events FOR SELECT TO authenticated USING ((manager_id = ( SELECT merchant_managers.id
   FROM public.merchant_managers
  WHERE (merchant_managers.user_id = auth.uid())
 LIMIT 1)));


--
-- Name: restaurants Managers can see their restaurants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can see their restaurants" ON public.restaurants FOR SELECT TO authenticated USING ((manager_id = ( SELECT merchant_managers.id
   FROM public.merchant_managers
  WHERE (merchant_managers.user_id = auth.uid())
 LIMIT 1)));


--
-- Name: restaurants Managers can update their restaurants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can update their restaurants" ON public.restaurants FOR UPDATE TO authenticated USING ((manager_id = ( SELECT merchant_managers.id
   FROM public.merchant_managers
  WHERE (merchant_managers.user_id = auth.uid())
 LIMIT 1))) WITH CHECK ((manager_id = ( SELECT merchant_managers.id
   FROM public.merchant_managers
  WHERE (merchant_managers.user_id = auth.uid())
 LIMIT 1)));


--
-- Name: users Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = id));


--
-- Name: users Users can select their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can select their own profile" ON public.users FOR SELECT TO authenticated USING (((auth.uid())::text = id));


--
-- Name: dispatch_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dispatch_history ENABLE ROW LEVEL SECURITY;

--
-- Name: drivers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: gigs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

--
-- Name: live_tracking; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.live_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: logistics_zones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.logistics_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: merchant_managers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.merchant_managers ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

--
-- Name: subzones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subzones ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: TABLE dispatch_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dispatch_history TO anon;
GRANT ALL ON TABLE public.dispatch_history TO authenticated;
GRANT ALL ON TABLE public.dispatch_history TO service_role;
GRANT SELECT,INSERT ON TABLE public.dispatch_history TO sandbox_exec;


--
-- Name: TABLE drivers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.drivers TO anon;
GRANT ALL ON TABLE public.drivers TO authenticated;
GRANT ALL ON TABLE public.drivers TO service_role;
GRANT SELECT,INSERT ON TABLE public.drivers TO sandbox_exec;


--
-- Name: TABLE gigs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gigs TO anon;
GRANT ALL ON TABLE public.gigs TO authenticated;
GRANT ALL ON TABLE public.gigs TO service_role;
GRANT SELECT,INSERT ON TABLE public.gigs TO sandbox_exec;


--
-- Name: TABLE live_tracking; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.live_tracking TO anon;
GRANT ALL ON TABLE public.live_tracking TO authenticated;
GRANT ALL ON TABLE public.live_tracking TO service_role;
GRANT SELECT,INSERT ON TABLE public.live_tracking TO sandbox_exec;


--
-- Name: TABLE logistics_zones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.logistics_zones TO anon;
GRANT ALL ON TABLE public.logistics_zones TO authenticated;
GRANT ALL ON TABLE public.logistics_zones TO service_role;
GRANT SELECT,INSERT ON TABLE public.logistics_zones TO sandbox_exec;


--
-- Name: TABLE merchant_managers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.merchant_managers TO anon;
GRANT ALL ON TABLE public.merchant_managers TO authenticated;
GRANT ALL ON TABLE public.merchant_managers TO service_role;
GRANT SELECT,INSERT ON TABLE public.merchant_managers TO sandbox_exec;


--
-- Name: TABLE onboarding_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.onboarding_events TO anon;
GRANT ALL ON TABLE public.onboarding_events TO authenticated;
GRANT ALL ON TABLE public.onboarding_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.onboarding_events TO sandbox_exec;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT SELECT,INSERT ON TABLE public.orders TO sandbox_exec;


--
-- Name: TABLE portal_access; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.portal_access TO anon;
GRANT ALL ON TABLE public.portal_access TO authenticated;
GRANT ALL ON TABLE public.portal_access TO service_role;
GRANT SELECT,INSERT ON TABLE public.portal_access TO sandbox_exec;


--
-- Name: TABLE restaurants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.restaurants TO anon;
GRANT ALL ON TABLE public.restaurants TO authenticated;
GRANT ALL ON TABLE public.restaurants TO service_role;
GRANT SELECT,INSERT ON TABLE public.restaurants TO sandbox_exec;


--
-- Name: TABLE subzones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subzones TO anon;
GRANT ALL ON TABLE public.subzones TO authenticated;
GRANT ALL ON TABLE public.subzones TO service_role;
GRANT SELECT,INSERT ON TABLE public.subzones TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT,INSERT ON TABLE public.users TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict vHWdyPo8key8zEpVc6v5FA7GLR6FBbXvPmZBjqveuzATCwp77iSCc0bIghlYw8u

