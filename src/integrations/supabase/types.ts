export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          archived: boolean | null
          category: string | null
          created_at: string | null
          device_id: string | null
          id: string
          ip: string | null
          meta: Json | null
          session_id: string | null
          severity: string | null
          subject_id: string | null
          subject_type: string | null
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          archived?: boolean | null
          category?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          ip?: string | null
          meta?: Json | null
          session_id?: string | null
          severity?: string | null
          subject_id?: string | null
          subject_type?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          archived?: boolean | null
          category?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          ip?: string | null
          meta?: Json | null
          session_id?: string | null
          severity?: string | null
          subject_id?: string | null
          subject_type?: string | null
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      dispatch_history: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          dispatch_method: string | null
          driver_id: string | null
          id: string
          order_id: string | null
          reason: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          dispatch_method?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          dispatch_method?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payout_line_items: {
        Row: {
          amount: number
          business_date: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          direction: string
          id: string
          payout_period_id: string
          source_id: string | null
          source_table: string | null
        }
        Insert: {
          amount: number
          business_date: string
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          direction: string
          id?: string
          payout_period_id: string
          source_id?: string | null
          source_table?: string | null
        }
        Update: {
          amount?: number
          business_date?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          direction?: string
          id?: string
          payout_period_id?: string
          source_id?: string | null
          source_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_payout_line_items_payout_period_id_fkey"
            columns: ["payout_period_id"]
            isOneToOne: false
            referencedRelation: "driver_payout_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payout_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          driver_id: string
          gross_earnings: number
          id: string
          net_payable: number
          notes: string | null
          period_end: string
          period_start: string
          settled_at: string | null
          settled_by: string | null
          status: string
          total_deductions: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          driver_id: string
          gross_earnings?: number
          id?: string
          net_payable?: number
          notes?: string | null
          period_end: string
          period_start: string
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          total_deductions?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          driver_id?: string
          gross_earnings?: number
          id?: string
          net_payable?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          total_deductions?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_payout_periods_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payout_settlements: {
        Row: {
          amount: number
          id: string
          method: string
          notes: string | null
          payout_period_id: string
          recorded_by: string | null
          reference: string
          settled_at: string
          status: string
        }
        Insert: {
          amount: number
          id?: string
          method: string
          notes?: string | null
          payout_period_id: string
          recorded_by?: string | null
          reference: string
          settled_at?: string
          status?: string
        }
        Update: {
          amount?: number
          id?: string
          method?: string
          notes?: string | null
          payout_period_id?: string
          recorded_by?: string | null
          reference?: string
          settled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payout_settlements_payout_period_id_fkey"
            columns: ["payout_period_id"]
            isOneToOne: true
            referencedRelation: "driver_payout_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          assigned_zone_id: string | null
          created_at: string | null
          email: string | null
          id: string
          is_online: boolean | null
          latitude: number | null
          license_number: string | null
          longitude: number | null
          name: string | null
          phone: string | null
          rating: number | null
          status: string | null
          total_deliveries: number | null
          updated_at: string | null
          user_id: string | null
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          assigned_zone_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number | null
          license_number?: string | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          assigned_zone_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number | null
          license_number?: string | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      fraud_reports: {
        Row: {
          created_at: string | null
          detected_at: string | null
          evidence: Json | null
          fingerprint: string | null
          id: string
          kind: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number | null
          severity: string | null
          signals: string[] | null
          status: string | null
          subject_id: string | null
          subject_label: string | null
          subject_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          detected_at?: string | null
          evidence?: Json | null
          fingerprint?: string | null
          id?: string
          kind?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          severity?: string | null
          signals?: string[] | null
          status?: string | null
          subject_id?: string | null
          subject_label?: string | null
          subject_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          detected_at?: string | null
          evidence?: Json | null
          fingerprint?: string | null
          id?: string
          kind?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          severity?: string | null
          signals?: string[] | null
          status?: string | null
          subject_id?: string | null
          subject_label?: string | null
          subject_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gigs: {
        Row: {
          created_at: string | null
          distance_km: number | null
          driver_id: string | null
          dropoff_location: string | null
          estimated_time_minutes: number | null
          gig_type: string | null
          id: string
          order_id: string | null
          payout: number | null
          pickup_location: string | null
          status: string | null
          tips: number | null
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          distance_km?: number | null
          driver_id?: string | null
          dropoff_location?: string | null
          estimated_time_minutes?: number | null
          gig_type?: string | null
          id?: string
          order_id?: string | null
          payout?: number | null
          pickup_location?: string | null
          status?: string | null
          tips?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          distance_km?: number | null
          driver_id?: string | null
          dropoff_location?: string | null
          estimated_time_minutes?: number | null
          gig_type?: string | null
          id?: string
          order_id?: string | null
          payout?: number | null
          pickup_location?: string | null
          status?: string | null
          tips?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gigs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "logistics_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_audit_logs: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string | null
          doc_type: string | null
          from_status: string | null
          id: string
          kyc_id: string | null
          remarks: string | null
          restaurant_id: string | null
          subject_id: string | null
          subject_type: string | null
          to_status: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          doc_type?: string | null
          from_status?: string | null
          id?: string
          kyc_id?: string | null
          remarks?: string | null
          restaurant_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          doc_type?: string | null
          from_status?: string | null
          id?: string
          kyc_id?: string | null
          remarks?: string | null
          restaurant_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_audit_logs_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "restaurant_kyc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_tracking: {
        Row: {
          accuracy: number | null
          driver_id: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          order_id: string | null
          speed_kmh: number | null
          timestamp: string | null
        }
        Insert: {
          accuracy?: number | null
          driver_id?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          order_id?: string | null
          speed_kmh?: number | null
          timestamp?: string | null
        }
        Update: {
          accuracy?: number | null
          driver_id?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string | null
          speed_kmh?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_tracking_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_zones: {
        Row: {
          city: string | null
          created_at: string | null
          delivery_fee: number | null
          id: string
          manager_id: string | null
          name: string
          polygon_coords: Json | null
          radius_km: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          id?: string
          manager_id?: string | null
          name: string
          polygon_coords?: Json | null
          radius_km?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          id?: string
          manager_id?: string | null
          name?: string
          polygon_coords?: Json | null
          radius_km?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_managers: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          monthly_target: number | null
          name: string | null
          phone: string | null
          region: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          monthly_target?: number | null
          name?: string | null
          phone?: string | null
          region?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          monthly_target?: number | null
          name?: string | null
          phone?: string | null
          region?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          actual_delivery_time: string | null
          assigned_driver_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          estimated_delivery_time: string | null
          id: string
          order_number: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
          restaurant_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          actual_delivery_time?: string | null
          assigned_driver_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_delivery_time?: string | null
          id?: string
          order_number?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          restaurant_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          actual_delivery_time?: string | null
          assigned_driver_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_delivery_time?: string | null
          id?: string
          order_number?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          restaurant_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "logistics_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_access: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          email_normalized: string
          id: string
          last_login_at: string | null
          portal: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          email_normalized?: string
          id?: string
          last_login_at?: string | null
          portal: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          email_normalized?: string
          id?: string
          last_login_at?: string | null
          portal?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      restaurant_kyc: {
        Row: {
          created_at: string | null
          doc_number: string | null
          doc_type: string | null
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          mandatory: boolean | null
          remarks: string | null
          restaurant_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          subject_id: string | null
          subject_type: string | null
          submitted_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          doc_number?: string | null
          doc_type?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          mandatory?: boolean | null
          remarks?: string | null
          restaurant_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          subject_id?: string | null
          subject_type?: string | null
          submitted_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          doc_number?: string | null
          doc_type?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          mandatory?: boolean | null
          remarks?: string | null
          restaurant_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          subject_id?: string | null
          subject_type?: string | null
          submitted_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_kyc_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          approved_at: string | null
          bank_account: string | null
          bank_holder: string | null
          bank_ifsc: string | null
          bank_name: string | null
          branch_code: string | null
          branch_name: string | null
          city: string | null
          closing_time: string | null
          code: string | null
          commission: number | null
          contact_email: string | null
          contact_phone: string | null
          cover_image: string | null
          cover_url: string | null
          created_at: string | null
          cuisine: string | null
          delivery_radius: number | null
          documents: Json | null
          duplicate_flag: string | null
          fssai_number: string | null
          gst_number: string | null
          id: string
          is_branch: boolean | null
          latitude: number | null
          logo: string | null
          logo_url: string | null
          longitude: number | null
          manager_id: string | null
          name: string | null
          onboarded_by: string | null
          onboarding_status: string | null
          opening_time: string | null
          owner_email: string | null
          owner_id: string | null
          owner_name: string | null
          owner_phone: string | null
          pan_number: string | null
          parent_restaurant_id: string | null
          pincode: string | null
          rejection_reason: string | null
          rst_code: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          branch_code?: string | null
          branch_name?: string | null
          city?: string | null
          closing_time?: string | null
          code?: string | null
          commission?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image?: string | null
          cover_url?: string | null
          created_at?: string | null
          cuisine?: string | null
          delivery_radius?: number | null
          documents?: Json | null
          duplicate_flag?: string | null
          fssai_number?: string | null
          gst_number?: string | null
          id?: string
          is_branch?: boolean | null
          latitude?: number | null
          logo?: string | null
          logo_url?: string | null
          longitude?: number | null
          manager_id?: string | null
          name?: string | null
          onboarded_by?: string | null
          onboarding_status?: string | null
          opening_time?: string | null
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          parent_restaurant_id?: string | null
          pincode?: string | null
          rejection_reason?: string | null
          rst_code?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          branch_code?: string | null
          branch_name?: string | null
          city?: string | null
          closing_time?: string | null
          code?: string | null
          commission?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image?: string | null
          cover_url?: string | null
          created_at?: string | null
          cuisine?: string | null
          delivery_radius?: number | null
          documents?: Json | null
          duplicate_flag?: string | null
          fssai_number?: string | null
          gst_number?: string | null
          id?: string
          is_branch?: boolean | null
          latitude?: number | null
          logo?: string | null
          logo_url?: string | null
          longitude?: number | null
          manager_id?: string | null
          name?: string | null
          onboarded_by?: string | null
          onboarding_status?: string | null
          opening_time?: string | null
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          parent_restaurant_id?: string | null
          pincode?: string | null
          rejection_reason?: string | null
          rst_code?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "merchant_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_onboarded_by_fkey"
            columns: ["onboarded_by"]
            isOneToOne: false
            referencedRelation: "merchant_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_parent_restaurant_id_fkey"
            columns: ["parent_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          detail: string | null
          device_id: string | null
          id: string
          ip: string | null
          meta: Json | null
          role: string | null
          severity: string | null
          title: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          detail?: string | null
          device_id?: string | null
          id?: string
          ip?: string | null
          meta?: Json | null
          role?: string | null
          severity?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          detail?: string | null
          device_id?: string | null
          id?: string
          ip?: string | null
          meta?: Json | null
          role?: string | null
          severity?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subzones: {
        Row: {
          created_at: string | null
          id: string
          manager_id: string | null
          name: string
          polygon_coords: Json | null
          status: string | null
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          polygon_coords?: Json | null
          status?: string | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          polygon_coords?: Json | null
          status?: string | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subzones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "logistics_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          email_normalized: string
          id: string
          is_active: boolean | null
          name: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          email_normalized: string
          id: string
          is_active?: boolean | null
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          email_normalized?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
